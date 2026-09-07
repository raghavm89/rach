'use strict';

/**
 * SSRF guard for tenant-supplied probe URLs (endpoint monitoring).
 *
 * Any tenant with a monitoring slot chooses an arbitrary URL that the CONTROL PLANE then
 * fetches on a schedule — previously with any method (PUT/DELETE included) and no target
 * checks, making the prober a state-changing oracle against everything the control plane
 * can reach: cloud metadata (169.254.169.254), the shared SeaweedFS filer, Grafana, the
 * site-controller (go-live audit H3). This module rejects targets that resolve to private,
 * loopback, link-local, or otherwise reserved addresses; the controller additionally
 * restricts methods to GET/HEAD.
 *
 * Residual risk (accepted for now, documented): DNS rebinding — we resolve-and-check, then
 * fetch by name, so a TOCTOU flip between the two is possible. Closing it fully means
 * pinning the connection to the vetted IP (custom Agent) or an egress-isolated prober
 * network segment; both are on the post-launch list. This guard removes the entire static
 * target class, which is what the finding exploited.
 */

const net = require('net');
const dns = require('dns');

// Is this literal IP address inside a private/reserved range?
function isPrivateAddress(addr) {
  const ip = String(addr || '').trim().toLowerCase();
  const v = net.isIP(ip);
  if (v === 4) {
    const p = ip.split('.').map(Number);
    const n = ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3];
    const inRange = (base, bits) => (n >>> (32 - bits)) === (base >>> (32 - bits));
    return (
      inRange(0x00000000, 8)  ||  // 0.0.0.0/8       "this network"
      inRange(0x0A000000, 8)  ||  // 10.0.0.0/8      private
      inRange(0x64400000, 10) ||  // 100.64.0.0/10   CGNAT
      inRange(0x7F000000, 8)  ||  // 127.0.0.0/8     loopback
      inRange(0xA9FE0000, 16) ||  // 169.254.0.0/16  link-local (incl. cloud metadata)
      inRange(0xAC100000, 12) ||  // 172.16.0.0/12   private
      inRange(0xC0A80000, 16) ||  // 192.168.0.0/16  private
      inRange(0xC6120000, 15) ||  // 198.18.0.0/15   benchmarking
      inRange(0xE0000000, 4)  ||  // 224.0.0.0/4     multicast
      inRange(0xF0000000, 4)      // 240.0.0.0/4     reserved + broadcast
    );
  }
  if (v === 6) {
    // Expand to 8 numeric groups and classify NUMERICALLY. String-prefix checks were
    // bypassable (audit #3, F3, executed): WHATWG URL serializes `[::ffff:127.0.0.1]` as
    // the HEX form `::ffff:7f00:1`, which a dotted-only regex sails past — handing the
    // prober loopback/metadata/RFC1918 access over the v4-mapped range on dual-stack hosts.
    const g = expandV6(ip);
    if (!g) return true; // net.isIP said v6 but we can't parse it → fail closed
    const zero = (from, to) => g.slice(from, to).every((n) => n === 0);
    const embedded = `${(g[6] >> 8) & 0xff}.${g[6] & 0xff}.${(g[7] >> 8) & 0xff}.${g[7] & 0xff}`;
    if (zero(0, 5) && g[5] === 0xffff) return isPrivateAddress(embedded); // ::ffff:0:0/96 v4-mapped (hex OR dotted)
    if (zero(0, 6)) return true;              // ::/96 — unspecified, loopback, deprecated v4-compatible
    if (g[0] === 0x64 && g[1] === 0xff9b) return true; // 64:ff9b::/32 — NAT64/translation prefixes (RFC 6052/8215)
    if ((g[0] & 0xffc0) === 0xfe80) return true;       // fe80::/10 link-local
    if ((g[0] & 0xfe00) === 0xfc00) return true;       // fc00::/7 ULA
    return false;
  }
  return false; // not an IP literal
}

// Expand an IPv6 literal (optionally with a trailing dotted IPv4) into 8 uint16 groups.
// Returns null when it doesn't parse — callers treat that as private (fail closed).
function expandV6(ip) {
  let s = ip;
  const v4 = /^(.*:)(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(s);
  if (v4) {
    const p = [Number(v4[2]), Number(v4[3]), Number(v4[4]), Number(v4[5])];
    if (p.some((n) => n > 255)) return null;
    s = `${v4[1]}${((p[0] << 8) | p[1]).toString(16)}:${((p[2] << 8) | p[3]).toString(16)}`;
  }
  const parts = s.split('::');
  if (parts.length > 2) return null;
  const head = parts[0] ? parts[0].split(':') : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(':') : [];
  const fill = parts.length === 2 ? 8 - head.length - tail.length : 0;
  if (fill < 0 || (parts.length === 1 && head.length !== 8)) return null;
  const groups = [...head, ...Array(fill).fill('0'), ...tail];
  if (groups.length !== 8) return null;
  const nums = groups.map((h) => (/^[0-9a-f]{1,4}$/.test(h) ? parseInt(h, 16) : NaN));
  return nums.some(Number.isNaN) ? null : nums;
}

/**
 * Assert a monitor URL points at a PUBLIC http(s) target. Resolves DNS names and rejects
 * if ANY answer is private/reserved (an attacker controls their own zone, so one poisoned
 * A record among many is enough). Throws { status: 400, code: 'ssrf_blocked' } on refusal.
 *
 * @param {string} rawUrl
 * @param {object} [deps]  { lookup } — injectable resolver for tests
 */
async function assertPublicTarget(rawUrl, deps = {}) {
  const fail = (msg) => {
    const e = new Error(msg);
    e.status = 400;
    e.code = 'ssrf_blocked';
    return e;
  };
  let url;
  try { url = new URL(String(rawUrl || '')); } catch { throw fail('Invalid URL.'); }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw fail('Only http(s) URLs can be monitored.');
  const host = url.hostname.replace(/^\[|\]$/g, ''); // strip IPv6 brackets
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw fail('Monitors must target a public hostname.');
  }
  if (net.isIP(host)) {
    if (isPrivateAddress(host)) throw fail('Monitors must target a public address.');
    return url;
  }
  const lookup = deps.lookup || dns.promises.lookup;
  let answers;
  try { answers = await lookup(host, { all: true, verbatim: true }); }
  catch { throw fail('Hostname does not resolve.'); }
  if (!answers.length || answers.some((a) => isPrivateAddress(a.address))) {
    throw fail('Monitors must target a public address.');
  }
  return url;
}

module.exports = { isPrivateAddress, assertPublicTarget };
