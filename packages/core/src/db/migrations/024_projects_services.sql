-- 024_projects_services.sql
-- Railway-style Project → Service → Environment → Deployment model.
-- Subscription/quota billing: services are bounded by the tenant's plan, not metered.

CREATE TABLE IF NOT EXISTS projects (
  id          SERIAL PRIMARY KEY,
  tenant_id   INTEGER NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE IF NOT EXISTS environments (
  id          SERIAL PRIMARY KEY,
  project_id  INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,                 -- production | staging | preview/<pr>
  is_default  BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS services (
  id             SERIAL PRIMARY KEY,
  project_id     INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  source_type    TEXT NOT NULL DEFAULT 'github_repo',   -- github_repo | docker_image
  repo_full_name TEXT,
  branch         TEXT DEFAULT 'main',
  image          TEXT,
  -- service sizing = number of units; each unit = 0.5 vCPU / 0.5 GB / 0.5 GB @ $15/mo
  units          INTEGER      NOT NULL DEFAULT 1,
  cpu            NUMERIC(4,2) NOT NULL DEFAULT 0.5,   -- per unit
  memory_mb      INTEGER      NOT NULL DEFAULT 512,   -- per unit (0.5 GB)
  disk_gb        NUMERIC(4,2) NOT NULL DEFAULT 0.5,   -- per unit
  replicas       INTEGER      NOT NULL DEFAULT 1,
  compute_target TEXT         NOT NULL DEFAULT 'shared',  -- shared | dedicated
  vm_id          TEXT,                                     -- dedicated target (nullable)
  status         TEXT         NOT NULL DEFAULT 'created', -- created|building|deploying|online|crashed|stopped
  created_by     INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (project_id, name)
);

CREATE TABLE IF NOT EXISTS deployments (
  id             SERIAL PRIMARY KEY,
  service_id     INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  environment_id INTEGER REFERENCES environments(id) ON DELETE SET NULL,
  commit_sha     TEXT,
  image_tag      TEXT,
  status         TEXT NOT NULL DEFAULT 'queued',          -- queued|building|success|failed
  triggered_by   TEXT DEFAULT 'manual',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_tenant     ON projects(tenant_id);
CREATE INDEX IF NOT EXISTS idx_environments_project ON environments(project_id);
CREATE INDEX IF NOT EXISTS idx_services_project    ON services(project_id);
CREATE INDEX IF NOT EXISTS idx_deployments_service ON deployments(service_id);
