'use strict';

/**
 * secretbox — authenticated encryption for connector credentials at rest.
 *
 * AES-256-GCM. The 32-byte key is derived (SHA-256) from
 * INTEGRATIONS_ENCRYPTION_KEY so any sufficiently-long secret works, but it MUST
 * be set and stable — rotating it makes existing ciphertext undecryptable.
 * Format: base64(iv):base64(authTag):base64(ciphertext).
 */

const crypto = require('crypto');

function key() {
  const secret = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!secret || String(secret).length < 16) {
    throw new Error('INTEGRATIONS_ENCRYPTION_KEY is not set (need a stable secret of 16+ chars)');
  }
  return crypto.createHash('sha256').update(String(secret)).digest(); // 32 bytes
}

/** Encrypt a UTF-8 string. */
function encrypt(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}:${tag.toString('base64')}:${enc.toString('base64')}`;
}

/** Decrypt a string produced by encrypt(). Throws on tamper / wrong key. */
function decrypt(payload) {
  const [ivB, tagB, dataB] = String(payload).split(':');
  if (!ivB || !tagB || !dataB) throw new Error('malformed ciphertext');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB, 'base64')), decipher.final()]).toString('utf8');
}

/** Convenience for credential objects. */
const encryptJson = (obj) => encrypt(JSON.stringify(obj || {}));
const decryptJson = (payload) => JSON.parse(decrypt(payload));

module.exports = { encrypt, decrypt, encryptJson, decryptJson };
