'use strict';

/**
 * Stateful-image guardrail (go-live audit P0 #1): the container path has no persistent volume, so
 * database images would silently lose their data. The classifier must catch real data stores while
 * NOT over-blocking stateless look-alikes (postgrest) or ordinary app images.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyStatefulImage, assertContainerImageAllowed, imageName } = require('../src/lib/statefulImage');

test('imageName strips registry, tag and digest to the image name', () => {
  assert.equal(imageName('postgres:16'), 'postgres');
  assert.equal(imageName('docker.io/library/postgres:16-alpine'), 'postgres');
  assert.equal(imageName('registry.example.com:5000/team/redis@sha256:abcd'), 'redis');
  assert.equal(imageName('bitnami/postgresql'), 'postgresql');
});

test('classifies known databases / stateful stores as stateful', () => {
  for (const img of ['postgres:16', 'postgresql', 'mysql:8', 'mariadb', 'mongo:7', 'mongodb',
    'redis:7-alpine', 'valkey/valkey', 'clickhouse/clickhouse-server', 'redis-stack:latest',
    'timescale/timescaledb:latest-pg16', 'elasticsearch:8.13.0', 'rabbitmq:3-management',
    'minio/minio', 'cockroachdb/cockroach', 'postgres-16']) {
    assert.equal(classifyStatefulImage(img).stateful, true, `${img} should be stateful`);
  }
});

test('does NOT over-block stateless images (postgrest, app images)', () => {
  for (const img of ['postgrest/postgrest:v12', 'node:20-alpine', 'nginx', 'myorg/web-api:1.2.3',
    'ghcr.io/acme/frontend', 'caddy:2', 'python:3.12-slim', 'redisinsight-lite']) {
    assert.equal(classifyStatefulImage(img).stateful, false, `${img} should be allowed`);
  }
});

test('assertContainerImageAllowed throws on a DB image on the container path', () => {
  assert.throws(
    () => assertContainerImageAllowed({ image: 'postgres:16', computeTarget: 'shared', sourceType: 'docker_image' }),
    (e) => e.code === 'stateful_image_not_supported' && e.status === 400,
  );
});

test('assertContainerImageAllowed is a no-op off the container path / for non-docker / stateless', () => {
  // VM path: has a real disk.
  assert.doesNotThrow(() => assertContainerImageAllowed({ image: 'postgres:16', computeTarget: 'dedicated', sourceType: 'docker_image' }));
  // GitHub-repo build, not a user DB image.
  assert.doesNotThrow(() => assertContainerImageAllowed({ image: 'postgres:16', computeTarget: 'shared', sourceType: 'github_repo' }));
  // Stateless image on the container path.
  assert.doesNotThrow(() => assertContainerImageAllowed({ image: 'nginx', computeTarget: 'shared', sourceType: 'docker_image' }));
});
