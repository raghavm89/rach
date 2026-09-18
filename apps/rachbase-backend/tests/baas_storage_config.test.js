'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/lib/baasStorageConfig');

test('withDefaults + patch coerce types and clamp', () => {
  assert.equal(C.withDefaults({}).file_size_limit_bytes, 52_428_800);
  const c = C.applyPatch({}, { image_transformation: 1, s3_enabled: true, file_size_limit_bytes: '1048576', region: ' ap-south-1 ' });
  assert.equal(c.image_transformation, true);
  assert.equal(c.s3_enabled, true);
  assert.equal(c.file_size_limit_bytes, 1048576);
  assert.equal(c.region, 'ap-south-1');
  assert.equal(C.applyPatch(c, { file_size_limit_bytes: -5 }).file_size_limit_bytes, 0);
});

test('toStorageEnv exposes the runtime subset', () => {
  const env = C.toStorageEnv(C.applyPatch({}, { s3_enabled: true, file_size_limit_bytes: 500, region: 'us-west-1' }));
  assert.equal(env.S3_ENABLED, 'true');
  assert.equal(env.FILE_SIZE_LIMIT, '500');
  assert.equal(env.S3_REGION, 'us-west-1');
  assert.equal(env.IMAGE_TRANSFORM, 'false');
});
