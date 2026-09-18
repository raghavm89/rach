'use strict';

/**
 * Minimal, dependency-free S3-compatible object store for database backups.
 *
 * Speaks AWS Signature v4 over Node's core `https`/`http` — works with AWS S3, Cloudflare R2,
 * Backblaze B2 (S3 API), MinIO, etc. Path-style addressing (endpoint/bucket/key) so it works
 * against MinIO and R2 without DNS games.
 *
 * Config (env):
 *   BACKUP_S3_ENDPOINT     e.g. https://s3.us-east-1.amazonaws.com or https://<acct>.r2.cloudflarestorage.com
 *   BACKUP_S3_BUCKET       bucket name
 *   BACKUP_S3_REGION       region label (default us-east-1)
 *   BACKUP_S3_ACCESS_KEY   access key id
 *   BACKUP_S3_SECRET_KEY   secret access key
 *   BACKUP_S3_PREFIX       optional key prefix (default "backups")
 *
 * Uploads stream from a file (UNSIGNED-PAYLOAD) so large dumps never buffer in memory.
 */

const crypto = require('crypto');
const fs = require('fs');
const { URL } = require('url');

const EMPTY_SHA256 = crypto.createHash('sha256').update('').digest('hex');
const SERVICE = 's3';

// ── Pure SigV4 primitives (unit-tested) ──────────────────────────────────────
const sha256hex = (data) => crypto.createHash('sha256').update(data).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data, 'utf8').digest();

// The SigV4 derived signing key (returns hex for easy testing against AWS vectors).
function signingKey(secret, dateStamp, region, service = SERVICE) {
  const kDate = hmac('AWS4' + secret, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  const kSigning = hmac(kService, 'aws4_request');
  return kSigning;
}
const signingKeyHex = (secret, dateStamp, region, service = SERVICE) =>
  signingKey(secret, dateStamp, region, service).toString('hex');

// Encode a path, preserving "/" between segments (S3 canonical URI rules).
function encodePath(path) {
  return path.split('/').map((seg) => encodeURIComponent(seg)).join('/');
}
const amzDate = (d = new Date()) => d.toISOString().replace(/[:-]|\.\d{3}/g, '');

// ── Config ───────────────────────────────────────────────────────────────────
function cfg() {
  return {
    endpoint: process.env.BACKUP_S3_ENDPOINT || '',
    bucket: process.env.BACKUP_S3_BUCKET || '',
    region: process.env.BACKUP_S3_REGION || 'us-east-1',
    accessKey: process.env.BACKUP_S3_ACCESS_KEY || '',
    secretKey: process.env.BACKUP_S3_SECRET_KEY || '',
    prefix: (process.env.BACKUP_S3_PREFIX || 'backups').replace(/^\/+|\/+$/g, ''),
  };
}
const isConfigured = () => {
  const c = cfg();
  return Boolean(c.endpoint && c.bucket && c.accessKey && c.secretKey);
};
const keyWithPrefix = (key) => {
  const p = cfg().prefix;
  return p ? `${p}/${key}` : key;
};

// Build the Authorization header for one request. Signed headers are the minimal deterministic
// set (host, x-amz-content-sha256, x-amz-date); extra headers ride unsigned.
function authorize({ method, host, canonicalUri, canonicalQuery = '', payloadHash, now = new Date() }) {
  const c = cfg();
  const amz = amzDate(now);
  const dateStamp = amz.slice(0, 8);
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalHeaders =
    `host:${host}\n` +
    `x-amz-content-sha256:${payloadHash}\n` +
    `x-amz-date:${amz}\n`;
  const canonicalRequest = [method, canonicalUri, canonicalQuery, canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/${c.region}/${SERVICE}/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amz, scope, sha256hex(canonicalRequest)].join('\n');
  const sig = crypto.createHmac('sha256', signingKey(c.secretKey, dateStamp, c.region)).update(stringToSign, 'utf8').digest('hex');
  const authHeader = `AWS4-HMAC-SHA256 Credential=${c.accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${sig}`;
  return { amz, authHeader, payloadHash };
}

function client() {
  const c = cfg();
  const u = new URL(c.endpoint);
  return require(u.protocol === 'http:' ? 'http' : 'https');
}
function hostFor() { return new URL(cfg().endpoint).host; }
function uriFor(key) { return '/' + encodePath(`${cfg().bucket}/${keyWithPrefix(key)}`); }

function request({ method, key, payloadHash, headers = {}, bodyStream = null, contentLength }) {
  return new Promise((resolve, reject) => {
    const c = cfg();
    const u = new URL(c.endpoint);
    const canonicalUri = uriFor(key);
    const { amz, authHeader } = authorize({ method, host: u.host, canonicalUri, payloadHash });
    const h = {
      Host: u.host,
      'x-amz-date': amz,
      'x-amz-content-sha256': payloadHash,
      Authorization: authHeader,
      ...headers,
    };
    if (contentLength != null) h['Content-Length'] = contentLength;
    const req = client().request(
      { method, hostname: u.hostname, port: u.port || undefined, path: canonicalUri, headers: h },
      (res) => {
        const chunks = [];
        res.on('data', (d) => chunks.push(d));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          if (res.statusCode >= 200 && res.statusCode < 300) resolve({ statusCode: res.statusCode, headers: res.headers, body });
          else reject(new Error(`S3 ${method} ${key} → ${res.statusCode}: ${body.toString().slice(0, 300)}`));
        });
      }
    );
    req.on('error', reject);
    if (bodyStream) bodyStream.pipe(req); else req.end();
  });
}

// ── Public API ────────────────────────────────────────────────────────────────
async function putObjectFromFile(key, filePath, contentType = 'application/octet-stream') {
  const { size } = fs.statSync(filePath);
  await request({
    method: 'PUT', key, payloadHash: 'UNSIGNED-PAYLOAD',
    headers: { 'Content-Type': contentType }, contentLength: size,
    bodyStream: fs.createReadStream(filePath),
  });
  return { key: keyWithPrefix(key), size };
}

async function getObjectToFile(key, destPath) {
  const c = cfg();
  const u = new URL(c.endpoint);
  const canonicalUri = uriFor(key);
  const { amz, authHeader } = authorize({ method: 'GET', host: u.host, canonicalUri, payloadHash: EMPTY_SHA256 });
  await new Promise((resolve, reject) => {
    const req = client().request(
      { method: 'GET', hostname: u.hostname, port: u.port || undefined, path: canonicalUri,
        headers: { Host: u.host, 'x-amz-date': amz, 'x-amz-content-sha256': EMPTY_SHA256, Authorization: authHeader } },
      (res) => {
        if (res.statusCode !== 200) { res.resume(); return reject(new Error(`S3 GET ${key} → ${res.statusCode}`)); }
        const out = fs.createWriteStream(destPath);
        res.pipe(out);
        out.on('finish', () => out.close(resolve));
        out.on('error', reject);
      }
    );
    req.on('error', reject);
    req.end();
  });
  return destPath;
}

async function deleteObject(key) {
  await request({ method: 'DELETE', key, payloadHash: EMPTY_SHA256 });
  return true;
}

// Presigned GET URL (query-string SigV4) for a time-limited download link.
function presignGet(key, expiresSeconds = 300, now = new Date()) {
  const c = cfg();
  const u = new URL(c.endpoint);
  const amz = amzDate(now);
  const dateStamp = amz.slice(0, 8);
  const scope = `${dateStamp}/${c.region}/${SERVICE}/aws4_request`;
  const canonicalUri = uriFor(key);
  const q = new URLSearchParams({
    'X-Amz-Algorithm': 'AWS4-HMAC-SHA256',
    'X-Amz-Credential': `${c.accessKey}/${scope}`,
    'X-Amz-Date': amz,
    'X-Amz-Expires': String(expiresSeconds),
    'X-Amz-SignedHeaders': 'host',
  });
  const canonicalQuery = q.toString();
  const canonicalHeaders = `host:${u.host}\n`;
  const canonicalRequest = ['GET', canonicalUri, canonicalQuery, canonicalHeaders, 'host', 'UNSIGNED-PAYLOAD'].join('\n');
  const stringToSign = ['AWS4-HMAC-SHA256', amz, scope, sha256hex(canonicalRequest)].join('\n');
  const sig = crypto.createHmac('sha256', signingKey(c.secretKey, dateStamp, c.region)).update(stringToSign, 'utf8').digest('hex');
  return `${u.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${sig}`;
}

module.exports = {
  isConfigured, putObjectFromFile, getObjectToFile, deleteObject, presignGet, keyWithPrefix,
  // pure helpers exported for tests
  _internal: { sha256hex, signingKeyHex, encodePath, amzDate, EMPTY_SHA256 },
};
