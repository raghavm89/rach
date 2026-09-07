'use strict';

/**
 * Public-host safety (security prerequisite for per-app ingress). Pure: reserved-subdomain
 * denylist, platform-host validation, and custom-domain rejection. The DB uniqueness claim
 * (Service.ensurePublicHost) is exercised on the controller/integration path.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../src/lib/publicHost');

test('reserved platform subdomains cannot become a platform host; normal names can', () => {
  for (const r of ['api', 'app', 'dashboard', 'admin', 'auth', 'billing', 'www', 'gateway']) {
    assert.equal(H.platformHostForSlug(r), null, `${r} must be reserved`);
    assert.equal(H.isReservedLabel(r), true);
  }
  assert.equal(H.platformHostForSlug('test'), 'test.rachbase.app'); // not reserved
  assert.equal(H.platformHostForSlug('my-cool-app'), 'my-cool-app.rachbase.app');
});

test('platformHostForSlug rejects invalid DNS labels', () => {
  assert.equal(H.platformHostForSlug('Has Space'), null);
  assert.equal(H.platformHostForSlug('-leadinghyphen'), null);
  assert.equal(H.platformHostForSlug(''), null);
});

test('isValidPlatformHost only accepts non-reserved <label>.rachbase.app', () => {
  assert.equal(H.isValidPlatformHost('test.rachbase.app'), true);
  assert.equal(H.isValidPlatformHost('api.rachbase.app'), false);      // reserved
  assert.equal(H.isValidPlatformHost('test.evil.com'), false);         // wrong domain
  assert.equal(H.isValidPlatformHost('a.b.rachbase.app'), false);      // not a single label
});

test('assertSafeCustomDomain accepts external FQDNs, rejects rachbase.app + junk', () => {
  assert.equal(H.assertSafeCustomDomain('app.acme.com'), 'app.acme.com');
  assert.equal(H.assertSafeCustomDomain('https://App.Acme.com/'), 'app.acme.com'); // normalized
  assert.throws(() => H.assertSafeCustomDomain('test.rachbase.app'), /platform-managed/); // can't hijack platform domain
  assert.throws(() => H.assertSafeCustomDomain('rachbase.app'), /platform-managed/);
  assert.throws(() => H.assertSafeCustomDomain('not a domain'), /valid hostname/);
  assert.throws(() => H.assertSafeCustomDomain(''), /empty/);
});
