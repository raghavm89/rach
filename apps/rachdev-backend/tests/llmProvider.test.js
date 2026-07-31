'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { gateway, models } = require('@rach/llm');

test('the gateway registers the on-prem vllm provider alongside anthropic', () => {
  assert.ok(gateway.PROVIDERS.anthropic, 'anthropic provider missing');
  assert.ok(gateway.PROVIDERS.vllm, 'vllm provider missing');
});

test('Sarvam models resolve to the vllm provider (on-prem sovereign path)', () => {
  assert.equal(models.resolveModel('sarvam-105b').provider, 'vllm');
  assert.equal(models.resolveModel('sarvam-30b').provider, 'vllm');
});

test('the default (Claude) model still resolves to anthropic', () => {
  assert.equal(models.resolveModel().provider, 'anthropic');
  assert.equal(models.resolveModel('claude-haiku-4-5-20251001').provider, 'anthropic');
});

test('the vllm adapter is stubbed and rejects clearly in the POC build', async () => {
  await assert.rejects(
    () => gateway.PROVIDERS.vllm.streamChat({ model: 'sarvam-105b', messages: [] }),
    /not wired in the POC build/,
  );
});

test('an unknown model is rejected', () => {
  assert.throws(() => models.resolveModel('nope-1b'), /Unknown or disallowed model/);
});
