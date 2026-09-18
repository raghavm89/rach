# Sprint 3 — Kiran (Inventory), the prescribe→stock→shortage loop

Status: Done and tested. Approved prescription → **stock decrement** → **shortage alert** for the store manager, who stages a reorder. Deliberately **rules-based** (stock + thresholds), per the architecture — no LLM in the hot path, so it's deterministic and reliable.

## What was built

**Backend**
- `packages/core/src/db/migrations/057_inventory.sql` — `drug_stock` (per-org, case-insensitive unique drug), `stock_transactions` (ledger of dispense/restock), `reorder_alerts` (open|ordered|dismissed).
- `apps/rachdev-backend/src/services/inventory.js` — pure, unit-tested helpers: `parsePrescription` (e.g. "Metformin 500mg #30" → drug+qty, matched to stock), `suggestReorder` (bring stock above threshold), `buildAlertMessage`.
- `apps/rachdev-backend/src/controllers/inventoryController.js` + `routes/inventory.js` (`/api/inventory`, role `store_manager`/admins):
  - `GET/POST /stock` — list / add-or-update a drug (qty + reorder threshold).
  - `POST /dispense` — `{ drug, qty }` or `{ prescription }` → decrement (transactional, `FOR UPDATE`); if it crosses the threshold, raise one open `reorder_alert` with a suggested quantity.
  - `POST /restock` — add stock; auto-resolves open alerts once above threshold.
  - `GET /alerts` · `POST /alerts/:id/resolve` — `{ status: 'ordered' | 'dismissed' }`.
- Agent Monitor: **Kiran** now reports real data (dispenses today/total, last run) and **open shortage alerts** appear in the health panel.

**Frontend** (`apps/rachdev-web/src/app/dashboard/clinical/inventory/page.tsx`)
- **Shortage alerts** panel (Mark ordered / Dismiss).
- **Dispense a prescription** box → decrements stock, tells you if an alert was raised.
- **Drug stock** table (qty, reorder-at, Low/OK status, inline restock) + add-drug form.
- Shared `inventory` API added to `@rach/ui`.

Human-in-the-loop: Kiran **stages** a reorder (the alert) — a person marks it ordered. It never auto-purchases.

## Verify
- Backend **47/47** node:test (incl. prescription parse, reorder math, controller, migration).
- `rachdev-web` **0 real type errors**. RachBase **untouched**.

Demo: as `store_manager`, add a drug (e.g. Metformin, qty 12, reorder at 10) → Dispense "Metformin #5" → stock 7 ≤ 10 → shortage alert appears → Mark ordered / Restock.

## Roadmap status
All three POC agents are now live: **Nora (Scribe)**, **Ava (Reception)**, **Kiran (Inventory)**. Remaining Phase-1 items: Control Tower live feed (Atlas), the Audit view over notes/encounters/stock actions, and (production) the on-prem/PHI-guardrail work.
