-- 125_baas_backups.sql
-- Managed-Postgres backups + restores for BaaS projects (trust track). Logical backups:
-- pg_dump -Fc of each project database → object storage, with tiered retention and
-- restore-into-a-new-database. (Continuous WAL PITR is a later, cluster-side phase.)
--
--   baas_backups   — one row per backup attempt (scheduled or on-demand)
--   baas_restores  — one row per restore attempt (always into a NEW database)

CREATE TABLE IF NOT EXISTS baas_backups (
  id           BIGSERIAL PRIMARY KEY,
  project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL DEFAULT 'scheduled',   -- 'scheduled' | 'manual'
  status       TEXT NOT NULL DEFAULT 'pending',     -- pending | running | completed | failed
  db_name      TEXT NOT NULL,                        -- the source database (baas_<ref>)
  object_key   TEXT,                                 -- storage key of the .dump (null until uploaded)
  size_bytes   BIGINT,
  error        TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  expires_at   TIMESTAMPTZ,                          -- retention horizon (pruned after this)
  created_by   INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_baas_backups_project ON baas_backups (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_baas_backups_expiry ON baas_backups (expires_at)
  WHERE status = 'completed' AND expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS baas_restores (
  id           BIGSERIAL PRIMARY KEY,
  project_id   INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  backup_id    BIGINT REFERENCES baas_backups(id) ON DELETE SET NULL,
  status       TEXT NOT NULL DEFAULT 'pending',     -- pending | running | completed | failed
  target_db    TEXT NOT NULL,                        -- the NEW database restored into
  error        TEXT,
  started_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_by   INTEGER,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_baas_restores_project ON baas_restores (project_id, created_at DESC);

-- Reversal:
--   DROP TABLE IF EXISTS baas_restores;
--   DROP TABLE IF EXISTS baas_backups;
