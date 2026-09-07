'use strict';

/**
 * Secret hygiene (go-live audit P0 #9): validateEnv must reject placeholder/default and truncated
 * secrets, not just the handful of exact `your_*` strings it used to. Tests the pure predicate.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { secretProblem } = require('@rach/core').validateEnv;

test('placeholder / default values are rejected', () => {
  for (const v of ['change_me_shared_secret', 'CHANGE_ME', 'changeme', 'your_razorpay_key_secret',
    'placeholder', 'test_secret', 'test-secret', 'secret', 'password', 'example_value_here_1234']) {
    assert.equal(secretProblem(v), 'placeholder', `expected ${v} → placeholder`);
  }
});

test('truncated / too-short secrets are rejected', () => {
  assert.equal(secretProblem('chan'), 'too_short');      // the duplicate-line stub
  assert.equal(secretProblem('abc123'), 'too_short');
  assert.equal(secretProblem('123456789012345'), 'too_short'); // 15 chars
});

test('a real-looking secret passes', () => {
  assert.equal(secretProblem('rzp_live_7Kd93Lm2QpZx8Vt4Nb'), null);
  assert.equal(secretProblem('a'.repeat(48)), null);
  assert.equal(secretProblem('S3cure-Random-Token-9f2b8c'), null);
});

test('absent / empty is not this check\'s problem (REQUIRED handles it)', () => {
  assert.equal(secretProblem(undefined), null);
  assert.equal(secretProblem(null), null);
  assert.equal(secretProblem(''), null);
});
