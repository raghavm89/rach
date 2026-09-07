'use strict';

/**
 * Site transport: plain HTTP is refused for non-private hosts unless explicitly opted in, so a
 * production site can never silently run with the partner JWT in cleartext (https:// path is
 * unaffected — it always uses mTLS).
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const client = require('../src/services/siteClient');

test('isPrivateHost: loopback + RFC1918 are private; public IPs and hostnames are not', () => {
  for (const h of ['localhost', '127.0.0.1', '10.0.30.10', '192.168.1.5', '172.16.0.1', '172.31.255.255']) {
    assert.equal(client.isPrivateHost(h), true, `${h} should be private`);
  }
  for (const h of ['51.81.133.241', '8.8.8.8', '172.32.0.1', 'api.rachbase.app']) {
    assert.equal(client.isPrivateHost(h), false, `${h} should NOT be private`);
  }
});

test('assertInsecureAllowed: private hosts are always allowed', () => {
  assert.doesNotThrow(() => client.assertInsecureAllowed('127.0.0.1'));
  assert.doesNotThrow(() => client.assertInsecureAllowed('10.0.30.10'));
});

test('assertInsecureAllowed: a public host is REFUSED without the opt-in', () => {
  delete process.env.SITE_ALLOW_INSECURE_HTTP;
  assert.throws(() => client.assertInsecureAllowed('51.81.133.241'), /refusing plain HTTP/);
});

test('assertInsecureAllowed: a public host is allowed only with SITE_ALLOW_INSECURE_HTTP=1', () => {
  process.env.SITE_ALLOW_INSECURE_HTTP = '1';
  assert.doesNotThrow(() => client.assertInsecureAllowed('51.81.133.241'));
  delete process.env.SITE_ALLOW_INSECURE_HTTP;
});
