# Audit — Credit Usage (consumption) Flow

Scope: how credits are **spent** (not purchased). Path:
`agent chat controller → @rach/llm gateway.chat → @rach/billing credits.deductCredits`.
Two callers share the same pattern: `apps/rachdev-backend/.../agentController.js`
and `apps/rachbase-backend/.../agentRuntimeController.js`.

## The flow (as built)

1. Controller gates: `balance = getOrCreateBalance(tenant)`, then
   `if (balance <= 0) return 402`.
2. Saves the **user** message.
3. Calls `gateway.chat({ …, onText })`, which:
   - streams the **full** model response to the client via `onText` (SSE), then
   - `deductCredits(tenant, user, billedTokens)` — `billedTokens = round(totalTokens × model.credit_multiplier)`; `credits = ceil(billedTokens / 1000)`.
4. On success: saves the **assistant** message (with `tokens_used`, `credits_used`), emits `done`.

## What's solid

- `deductCredits` is well built: `SELECT … FOR UPDATE` row lock, single
  transaction for balance + ledger, balance guard (no negatives unless
  `allowOverdraft`), and `addCredits` is idempotent on `razorpay_payment_id`.
- Usage/history endpoints and the dashboard read the ledger correctly
  (`total_purchased`, `total_used`, `total_tokens`, per-session breakdown).

---

## Findings

### 🔴 H1 — Weak gate + charge-after-stream ⇒ free usage for low-balance tenants
The gate is `balance <= 0`, and credits are deducted **after** the whole
response has already been streamed to the user. So a tenant with *any* positive
balance (even **1 credit**) can trigger an arbitrarily expensive call:
the answer streams in full, then `deductCredits` hits the balance guard
(`balance < required`) and **throws** — the response was already delivered, and
**no charge and no ledger row** are recorded. Repeatable: keep balance at 1 and
every call is delivered free. This is the most important issue.

### 🔴 H2 — On deduction/provider failure, session state is corrupted
The **user** message is saved before the call (step 2), but the **assistant**
message is only saved *after* `gateway.chat` returns (step 4). If `gateway.chat`
throws — deduction failure (H1) or a provider error mid-stream — the assistant
insert is skipped. The session is left with a dangling user message and no
reply; on reload the chat shows a question with no answer.

### 🟠 M1 — No cap on generation size relative to balance
`maxTokens` defaults to the model's `max_tokens_default` (e.g. thousands of
tokens). Nothing bounds it to what the tenant can afford, so the worst-case
call always exceeds a small balance → guaranteed to hit H1. The response should
be **capped to the affordable budget** before generating.

### 🟠 M2 — TOCTOU race on concurrent calls
`getOrCreateBalance` (gate) → `gateway.chat` → `deductCredits` is not atomic
across the model call. Concurrent requests all pass `balance > 0`, all stream
responses, and `deductCredits` serializes (FOR UPDATE) so only some succeed —
the rest deliver free (H1). No pre-call reservation exists.

### 🟠 M3 — Dual accounting can diverge
Usage is recorded twice: in `credit_transactions` (by `deductCredits`) and in
`agent_chat_messages.credits_used` (by the controller). On partial failure
(deduction succeeds, message insert fails, or vice-versa) the two disagree. The
usage summary reads the ledger; per-session reads the message rows — so they can
show different totals.

### 🟡 L1 — 402 gives balance but no cost estimate
The insufficient-credits response returns the balance but not how many credits
the call needs, so the user can't tell how much to top up. No proactive
low-balance warning before a call fails.

### 🟡 L2 — Minimum 1 credit per call
`ceil(billedTokens / 1000)` means any call costs at least 1 credit. Reasonable,
but worth documenting so tiny calls aren't a surprise.

---

## Recommendations (in priority order)

1. **Cap generation to the affordable budget (fixes H1 + M1).** Before calling,
   compute `affordableTokens = floor(balance × 1000 / model.credit_multiplier)`
   and pass `maxTokens = min(requestedMax, affordableTokens)`. The tenant can
   never be delivered more than they can pay for; the post-call deduction then
   always succeeds.
2. **Reserve or gate on worst-case (defense in depth for M2).** Gate on
   `balance >= ceil(maxTokens × multiplier / 1000)`, or reserve that many credits
   before the call and settle actual usage after. Prevents concurrent
   over-delivery.
3. **Safety net: `allowOverdraft: true` on the gateway deduction.** If a call
   still overshoots, record the usage and let the balance go slightly negative
   (a recoverable debt) instead of losing the charge and the ledger entry
   entirely. Pair with (1) so overdraft is rare.
4. **Persist the assistant message regardless (fixes H2).** Save the reply text
   before/independently of the deduction (e.g. deduct in a `finally`, or insert
   the assistant row in the same try that streamed it), so a charging failure
   doesn't corrupt the session.
5. **Single source of truth for usage (M3).** Prefer the ledger; derive
   per-session usage from it (or reconcile), so the two views can't diverge.
6. **UX (L1):** return `required` credits in the 402 and surface a low-balance
   banner before the call fails.

## Note
This audit is read-only — no code was changed. Want me to implement the top fix
(cap `maxTokens` to the affordable budget) in both agent controllers, plus the
assistant-message persistence fix? Those two close the free-usage hole and the
session-corruption bug with a small, contained change.
