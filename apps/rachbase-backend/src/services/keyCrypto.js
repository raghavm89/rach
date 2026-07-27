'use strict';

/**
 * Per-VM SSH keypair generation + private-key encryption at rest.
 *
 * Keypairs are ed25519 in OpenSSH format (public = authorized_keys line,
 * private = OpenSSH PEM). Private keys are NEVER stored or logged in plaintext —
 * they are sealed with AES-256-GCM (authenticated encryption) under a master key
 * derived from the environment.
 *
 * Master key: set RACHBASE_KEY_ENC_SECRET (a long random passphrase) in the
 * backend env. It is stretched to a 32-byte key with scrypt. In production this
 * should ideally come from a KMS/secrets manager; the interface here (seal /
 * open) stays the same if you swap the key source later.
 */

const crypto = require('crypto');
const { utils: sshUtils } = require('ssh2');

// ---------------------------------------------------------------------------
// Master key
// ---------------------------------------------------------------------------

const SCRYPT_SALT = 'rachbase.vm_keys.v1'; // fixed salt is fine: input is a high-entropy secret
let _masterKey = null;

function masterKey() {
  if (_masterKey) return _masterKey;
  const secret = process.env.RACHBASE_KEY_ENC_SECRET;
  if (!secret || secret.length < 16) {
    const err = new Error('VM key encryption not configured: set RACHBASE_KEY_ENC_SECRET (>=16 chars)');
    err.status = 503;
    throw err;
  }
  _masterKey = crypto.scryptSync(secret, SCRYPT_SALT, 32);
  return _masterKey;
}

// ---------------------------------------------------------------------------
// Keypair generation
// ---------------------------------------------------------------------------

/**
 * Generate an ed25519 keypair in OpenSSH format.
 * @returns {{ publicKey: string, privateKey: string, fingerprint: string }}
 *   publicKey  — "ssh-ed25519 AAAA... <comment>" (authorized_keys line)
 *   privateKey — OpenSSH PEM (plaintext; caller must seal before storing)
 *   fingerprint— "SHA256:..." (matches `ssh-keygen -lf`)
 */
function generateKeypair(comment = 'rachbase') {
  const kp = sshUtils.generateKeyPairSync('ed25519', { comment });
  const publicKey = kp.public.trim();
  return {
    publicKey,
    privateKey: kp.private,
    fingerprint: fingerprintOf(publicKey),
  };
}

/** SSH SHA256 fingerprint of an OpenSSH public-key line. */
function fingerprintOf(publicKeyLine) {
  const parts = publicKeyLine.trim().split(/\s+/);
  const blob = Buffer.from(parts[1], 'base64'); // the base64 key body
  const digest = crypto.createHash('sha256').update(blob).digest('base64').replace(/=+$/, '');
  return `SHA256:${digest}`;
}

// ---------------------------------------------------------------------------
// Envelope encryption (AES-256-GCM)
// ---------------------------------------------------------------------------

/** Seal plaintext → "b64(iv):b64(tag):b64(ciphertext)". */
function seal(plaintext) {
  const key = masterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/** Open a sealed blob back to plaintext. Throws if tampered or wrong key. */
function open(blob) {
  const key = masterKey();
  const [ivB64, tagB64, ctB64] = String(blob).split(':');
  if (!ivB64 || !tagB64 || !ctB64) throw new Error('Malformed sealed key');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
}

/** True when the master key is configured (used to gate features gracefully). */
function isConfigured() {
  try { masterKey(); return true; } catch { return false; }
}

module.exports = { generateKeypair, fingerprintOf, seal, open, isConfigured };
