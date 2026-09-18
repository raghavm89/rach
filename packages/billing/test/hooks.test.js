'use strict';

/**
 * Subscription-event hooks — multi-listener, unconditional, best-effort. This is how
 * RachBase's Pro container lifecycle receives renewal/halt/cancel events for
 * subscriptions the billing package doesn't own a row for.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const hooks = require('../src/hooks');

test('onSubscriptionEvent fans out to every listener and unsubscribe removes one', async () => {
  const seen = [];
  const off1 = hooks.onSubscriptionEvent((ctx) => seen.push(['a', ctx.event]));
  hooks.onSubscriptionEvent((ctx) => seen.push(['b', ctx.event]));

  await hooks.fireSubscriptionEvent({ razorpaySubId: 'sub_1', event: 'charged' });
  assert.deepEqual(seen, [['a', 'charged'], ['b', 'charged']]);

  off1();
  await hooks.fireSubscriptionEvent({ razorpaySubId: 'sub_1', event: 'halted' });
  assert.deepEqual(seen, [['a', 'charged'], ['b', 'charged'], ['b', 'halted']]);
});

test('a throwing listener does not block the others — but the failure PROPAGATES afterwards', async () => {
  const seen = [];
  hooks.onSubscriptionEvent(() => { throw new Error('boom'); });
  hooks.onSubscriptionEvent((ctx) => seen.push(ctx.event));
  // Every listener still runs (multi-listener fan-out preserved) …
  await assert.rejects(
    hooks.fireSubscriptionEvent({ razorpaySubId: 'sub_2', event: 'cancelled' }),
    // … and the aggregate failure surfaces so the webhook releases its claim and Razorpay
    // retries — a swallowed error here used to drop lifecycle events permanently (audit #3, F4).
    (e) => { assert.match(e.message, /1 listener\(s\) failed.*boom/); assert.equal(e.failures.length, 1); return true; },
  );
  assert.deepEqual(seen, ['cancelled']);
});
