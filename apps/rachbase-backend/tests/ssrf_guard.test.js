'use strict';

/**
 * SSRF guard for tenant-supplied monitor URLs (go-live audit H3). Pure unit tests —
 * DNS is injected, nothing is fetched.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { isPrivateAddress, assertPublicTarget } = require('../src/lib/ssrfGuard');

test('isPrivateAddress: private/reserved v4 ranges are caught', () => {
  for (const ip of [
    '10.0.0.1', '172.16.0.1', '172.31.255.255', '192.168.1.1', '127.0.0.1', '0.0.0.0',
    '169.254.169.254', // cloud metadata — the classic SSRF target
    '100.64.0.1', '198.18.0.1', '224.0.0.1', '255.255.255.255',
  ]) assert.equal(isPrivateAddress(ip), true, ip);
});

test('isPrivateAddress: public v4 stays allowed', () => {
  for (const ip of ['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '169.253.0.1', '100.63.0.1', '203.0.114.1'])
    assert.equal(isPrivateAddress(ip), false, ip);
});

test('isPrivateAddress: v6 loopback/link-local/ULA and v4-mapped are caught', () => {
  for (const ip of ['::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1', '::ffff:10.0.0.1', '::ffff:169.254.169.254'])
    assert.equal(isPrivateAddress(ip), true, ip);
  assert.equal(isPrivateAddress('2606:4700::1111'), false);
  assert.equal(isPrivateAddress('::ffff:8.8.8.8'), false);
});

test('isPrivateAddress: HEX-form v4-mapped and NAT64 are caught (audit #3 F3 — WHATWG URL serializes mapped v4 as hex)', () => {
  // The executed bypass: new URL('http://[::ffff:127.0.0.1]/').hostname === '[::ffff:7f00:1]'.
  for (const ip of [
    '::ffff:7f00:1',                 // 127.0.0.1 in hex-mapped form
    '::ffff:a9fe:a9fe',              // 169.254.169.254 (cloud metadata)
    '::ffff:a00:1',                  // 10.0.0.1
    '0:0:0:0:0:ffff:c0a8:101',       // 192.168.1.1, unabbreviated
    '64:ff9b::7f00:1',               // NAT64 well-known prefix (RFC 6052)
    '64:ff9b:1::a',                  // NAT64 local-use (RFC 8215)
    '::8.8.8.8',                     // deprecated v4-compatible ::/96 — blocked wholesale
  ]) assert.equal(isPrivateAddress(ip), true, ip);
  // Public embedded v4 through the mapped range stays allowed (it IS just that public IP).
  assert.equal(isPrivateAddress('::ffff:808:808'), false);   // 8.8.8.8 hex form
});

test('assertPublicTarget blocks the executed URL-serialization bypass end to end', async () => {
  const noLookup = { lookup: async () => { throw new Error('lookup must not be called'); } };
  await assert.rejects(assertPublicTarget('http://[::ffff:127.0.0.1]/', noLookup), (e) => e.code === 'ssrf_blocked');
  await assert.rejects(assertPublicTarget('http://[::ffff:7f00:1]/', noLookup), (e) => e.code === 'ssrf_blocked');
  await assert.rejects(assertPublicTarget('http://[64:ff9b::a9fe:a9fe]/', noLookup), (e) => e.code === 'ssrf_blocked');
});

const resolveTo = (...addrs) => async () => addrs.map((address) => ({ address, family: address.includes(':') ? 6 : 4 }));

test('assertPublicTarget: public hostname passes; private resolution is refused', async () => {
  await assertPublicTarget('https://example.com/health', { lookup: resolveTo('93.184.216.34') });
  await assert.rejects(assertPublicTarget('https://internal.example.com/', { lookup: resolveTo('10.1.2.3') }),
    (e) => e.code === 'ssrf_blocked');
});

test('assertPublicTarget: ONE private answer among many poisons the whole target', async () => {
  await assert.rejects(
    assertPublicTarget('https://sneaky.example.com/', { lookup: resolveTo('93.184.216.34', '169.254.169.254') }),
    (e) => e.code === 'ssrf_blocked');
});

test('assertPublicTarget: IP literals, localhost names, and non-http schemes are refused statically', async () => {
  const noLookup = { lookup: async () => { throw new Error('lookup must not be called'); } };
  await assert.rejects(assertPublicTarget('http://169.254.169.254/latest/meta-data/', noLookup), (e) => e.code === 'ssrf_blocked');
  await assert.rejects(assertPublicTarget('http://[::1]:8080/', noLookup), (e) => e.code === 'ssrf_blocked');
  await assert.rejects(assertPublicTarget('http://localhost:9090/', noLookup), (e) => e.code === 'ssrf_blocked');
  await assert.rejects(assertPublicTarget('http://filer.svc.cluster.internal/', noLookup), (e) => e.code === 'ssrf_blocked');
  await assert.rejects(assertPublicTarget('ftp://example.com/', noLookup), (e) => e.code === 'ssrf_blocked');
  await assert.rejects(assertPublicTarget('not a url', noLookup), (e) => e.code === 'ssrf_blocked');
  // Public IP literal is fine without DNS.
  await assertPublicTarget('https://8.8.8.8/health', noLookup);
});

test('assertPublicTarget: unresolvable hostname is refused', async () => {
  await assert.rejects(
    assertPublicTarget('https://does-not-exist.example/', { lookup: async () => { throw new Error('ENOTFOUND'); } }),
    (e) => e.code === 'ssrf_blocked');
});
