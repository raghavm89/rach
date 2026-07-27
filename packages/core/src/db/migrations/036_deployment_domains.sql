-- 036_deployment_domains.sql
-- Domains attached to a service (PaaS phase 3). Hostnames are globally unique
-- (first-come-first-served). Custom domains now; auto `name.rachbase.com`
-- (is_auto = true) added in phase 4. Caddy on the VM routes hostname → port.

CREATE TABLE IF NOT EXISTS deployment_domains (
  id          SERIAL PRIMARY KEY,
  service_id  INTEGER NOT NULL REFERENCES deployment_services(id) ON DELETE CASCADE,
  hostname    TEXT NOT NULL UNIQUE,
  is_auto     BOOLEAN NOT NULL DEFAULT false,
  status      TEXT NOT NULL DEFAULT 'provisioning',  -- provisioning | live | failed
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deployment_domains_service ON deployment_domains(service_id);
