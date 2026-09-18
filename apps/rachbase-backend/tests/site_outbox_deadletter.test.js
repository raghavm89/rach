'use strict';

/**
 * Outbox hardening (pure logic): a permanent failure (4xx / exhausted retries) must be
 * dead-lettered, not retried forever, and the real HTTP reason must be preserved. These
 * unit-test the classification + reason extraction that drive drainOnce (no DB).
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { isRetryableStatus, MAX_ATTEMPTS } = require('../src/services/siteOutbox');
const { classifyDelivery, reasonFrom } = require('../src/services/siteOutboxWorker');

test('isRetryableStatus: network + 408/429 + 5xx retry; other 4xx are permanent', () => {
  assert.equal(isRetryableStatus(null), true);   // network / no response
  assert.equal(isRetryableStatus(408), true);
  assert.equal(isRetryableStatus(429), true);
  assert.equal(isRetryableStatus(500), true);
  assert.equal(isRetryableStatus(503), true);
  assert.equal(isRetryableStatus(400), false);   // bad request / validation
  assert.equal(isRetryableStatus(404), false);
  assert.equal(isRetryableStatus(409), false);
  assert.equal(isRetryableStatus(422), false);   // e.g. CRD schema rejection surfaced as 4xx
});

test('classifyDelivery: ack delivers; permanent fails fast; transient retries until exhausted', () => {
  assert.equal(classifyDelivery({ ack: true }), 'delivered');
  assert.equal(classifyDelivery({ ack: false, status: 400, attempts: 1 }), 'fail');  // permanent → fail fast
  assert.equal(classifyDelivery({ ack: false, status: 500, attempts: 1 }), 'retry'); // transient → retry
  assert.equal(classifyDelivery({ ack: false, status: null, attempts: 1 }), 'retry'); // network → retry
  assert.equal(classifyDelivery({ ack: false, status: 500, attempts: MAX_ATTEMPTS }), 'fail'); // exhausted → fail
  assert.equal(classifyDelivery({ ack: false, status: null, attempts: MAX_ATTEMPTS }), 'fail');
});

test('reasonFrom preserves the real status + error message (not a generic "no ack")', () => {
  assert.equal(reasonFrom({ status: 500, body: { message: '.spec.host: field not declared in schema' } }),
    'HTTP 500: .spec.host: field not declared in schema');
  assert.equal(reasonFrom({ status: 400, body: { error: 'bad request' } }), 'HTTP 400: bad request');
  assert.equal(reasonFrom({ status: 503, body: null }), 'HTTP 503');
  assert.equal(reasonFrom(null), 'HTTP ?');
});
