-- Support tickets + threaded messages. Raised by customers (or the support bot
-- on their behalf), tracked through a lifecycle, and answered by support/admin.
-- Scoped by tenant_id + user_id; role decides visibility at the query layer.

CREATE TABLE IF NOT EXISTS tickets (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject      TEXT    NOT NULL,
  body         TEXT,
  -- open | in_progress | waiting_on_customer | resolved | closed
  status       TEXT    NOT NULL DEFAULT 'open',
  -- low | normal | high | urgent
  priority     TEXT    NOT NULL DEFAULT 'normal',
  -- billing | deployment | vm | account | other
  category     TEXT    NOT NULL DEFAULT 'other',
  -- 'human' (raised by the customer) or 'bot' (raised by the support assistant)
  source       TEXT    NOT NULL DEFAULT 'human',
  assigned_to  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  closed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tickets_tenant ON tickets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tickets_user   ON tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id           SERIAL PRIMARY KEY,
  ticket_id    INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  -- customer | support | bot
  author_type  TEXT    NOT NULL,
  author_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  body         TEXT    NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket ON ticket_messages(ticket_id);
