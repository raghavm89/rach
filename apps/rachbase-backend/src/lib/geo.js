'use strict';

/**
 * Request → ISO-3166 alpha-2 country, via geoip-lite on the client IP. Shared helper
 * so GST/currency and the "hide GSTIN outside India" UI use one definition. Returns
 * null for loopback/private ranges or an unknown IP (caller decides the fallback).
 */

const geoip = require('geoip-lite');

function clientIp(req) {
  // `req.ip` is Express's answer AFTER the app-level `trust proxy` hop count is applied:
  // the real client behind the trusted proxy, and the raw socket peer when there is none.
  // Parsing x-forwarded-for ourselves (the old behavior) trusted a CLIENT-SUPPLIED header
  // unconditionally — a spoofable input that fed invoice tax country and the GSTIN UI
  // (go-live audit M5/M1). XFF must only ever be interpreted via TRUST_PROXY.
  return req.ip || req.socket?.remoteAddress || '';
}

function countryFromReq(req) {
  const ip = clientIp(req);
  if (!ip || ip === '::1' || ip.startsWith('127.') || ip.startsWith('192.168.') || ip.startsWith('10.')) return null;
  return geoip.lookup(ip)?.country ?? null;
}

module.exports = { clientIp, countryFromReq };
