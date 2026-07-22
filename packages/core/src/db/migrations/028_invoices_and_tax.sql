-- Migration 028: tax registrations + invoices
--
-- Context: before this migration the product COLLECTED a GSTIN (profile page,
-- checkout form) and told customers "GSTIN will appear on your tax invoices" —
-- but no tax was ever calculated and no invoice was ever produced.
--
-- Design notes:
--   * All money is stored as BIGINT in the currency's MINOR unit (paise/cents).
--     Never float.
--   * Tax rates are stored in BASIS POINTS (1800 = 18.00%) for the same reason.
--   * Invoices snapshot the seller and buyer at issue time. A tax invoice is a
--     legal document: it must not change when someone later edits their profile.
--   * Invoice numbers are sequential and gapless per series per financial year,
--     which Indian GST rules require.

-- ── Where we are registered to collect tax ───────────────────────────────────
-- No rows = collect nothing. That is the deliberate default: charging tax you
-- are not registered to collect is worse than charging none.
CREATE TABLE IF NOT EXISTS tax_registrations (
  id                  SERIAL       PRIMARY KEY,
  country_code        CHAR(2)      NOT NULL,              -- ISO-3166-1 alpha-2: 'IN', 'US'
  region_code         VARCHAR(10),                        -- state/province; NULL = country-wide
  registration_number VARCHAR(64),                        -- GSTIN, US state permit id
  -- Which engine prices this jurisdiction:
  --   'manual'     — use rate_bps below (fine for India's flat 18% on SaaS)
  --   'stripe_tax' — delegate to Stripe Tax
  --   'taxjar'     — delegate to TaxJar
  provider            VARCHAR(20)  NOT NULL DEFAULT 'manual',
  rate_bps            INT,                                -- only for provider='manual'
  tax_name            VARCHAR(40),                        -- 'GST', 'Sales Tax'
  is_active           BOOLEAN      NOT NULL DEFAULT TRUE,
  effective_from      DATE         NOT NULL DEFAULT CURRENT_DATE,
  effective_to        DATE,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- One active registration per jurisdiction. COALESCE so country-wide rows
-- (region_code IS NULL) still collide correctly.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_reg_jurisdiction
  ON tax_registrations (country_code, COALESCE(region_code, ''))
  WHERE is_active;


-- ── Gapless invoice numbering ────────────────────────────────────────────────
-- A plain SERIAL is not sufficient: sequences leak numbers on rollback, and GST
-- requires an unbroken series. Allocation takes a row lock instead.
CREATE TABLE IF NOT EXISTS invoice_sequences (
  series      VARCHAR(20) NOT NULL,
  fiscal_year VARCHAR(9)  NOT NULL,   -- Indian FY, e.g. '2026-27'
  last_number INT         NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (series, fiscal_year)
);


-- ── Invoices ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
  id                       SERIAL       PRIMARY KEY,
  invoice_number           VARCHAR(50)  NOT NULL UNIQUE,
  fiscal_year              VARCHAR(9)   NOT NULL,

  tenant_id                INT          REFERENCES tenants(id) ON DELETE SET NULL,
  user_id                  INT          NOT NULL REFERENCES users(id) ON DELETE RESTRICT,

  -- issued → paid | void. Invoices are never deleted or edited; corrections
  -- are issued as a separate credit note.
  status                   VARCHAR(20)  NOT NULL DEFAULT 'issued',

  currency                 CHAR(3)      NOT NULL,
  subtotal_minor           BIGINT       NOT NULL,
  tax_total_minor          BIGINT       NOT NULL DEFAULT 0,
  total_minor              BIGINT       NOT NULL,

  -- Immutable point-in-time snapshots. Do not join to users/tenants for
  -- rendering — that would retroactively rewrite issued invoices.
  seller_json              JSONB        NOT NULL,
  buyer_json               JSONB        NOT NULL,

  -- Full tax decision: provider used, jurisdiction, rates, component breakdown.
  tax_json                 JSONB        NOT NULL DEFAULT '{}'::jsonb,
  place_of_supply          VARCHAR(64),
  -- intra_state | inter_state | export_zero_rated | no_registration | exempt
  tax_treatment            VARCHAR(32),

  -- Payment linkage (any may be null for a manually raised invoice)
  razorpay_order_id        VARCHAR(64),
  razorpay_payment_id      VARCHAR(64),
  razorpay_subscription_id VARCHAR(64),
  expansion_request_id     INT,

  pdf_path                 TEXT,
  notes                    TEXT,

  issued_at                TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT invoices_totals_consistent
    CHECK (total_minor = subtotal_minor + tax_total_minor),
  CONSTRAINT invoices_status_valid
    CHECK (status IN ('issued', 'paid', 'void'))
);

CREATE INDEX IF NOT EXISTS idx_invoices_user     ON invoices (user_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant   ON invoices (tenant_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_payment  ON invoices (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;

-- One invoice per captured payment — makes issuance idempotent under webhook
-- retries and double-clicked checkouts.
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_payment_unique
  ON invoices (razorpay_payment_id)
  WHERE razorpay_payment_id IS NOT NULL;


-- ── Line items ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoice_line_items (
  id               SERIAL      PRIMARY KEY,
  invoice_id       INT         NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  line_no          INT         NOT NULL,
  description      TEXT        NOT NULL,
  sac_code         VARCHAR(10),                       -- India SAC; 998315 for cloud hosting
  quantity         INT         NOT NULL DEFAULT 1,
  unit_price_minor BIGINT      NOT NULL,
  subtotal_minor   BIGINT      NOT NULL,
  tax_rate_bps     INT         NOT NULL DEFAULT 0,
  tax_amount_minor BIGINT      NOT NULL DEFAULT 0,
  -- [{ name: 'CGST', rate_bps: 900, amount_minor: 900 }, ...]
  tax_breakdown    JSONB       NOT NULL DEFAULT '[]'::jsonb,
  total_minor      BIGINT      NOT NULL,

  UNIQUE (invoice_id, line_no)
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines ON invoice_line_items (invoice_id);


-- ── Seeding ──────────────────────────────────────────────────────────────────
-- Intentionally empty. Insert your registrations explicitly, e.g. for India:
--
--   INSERT INTO tax_registrations
--     (country_code, region_code, registration_number, provider, rate_bps, tax_name)
--   VALUES ('IN', NULL, '<your 15-char GSTIN>', 'manual', 1800, 'GST');
--
-- Until such a row exists, the engine charges zero and records the treatment as
-- 'no_registration' on the invoice, so the reason is auditable after the fact.
