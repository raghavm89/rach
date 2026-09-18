-- Site registry: one row per SpaceArk site-controller the BFF can talk to. Replaces the
-- single global SITE_API_URL env — a tenant's `tenants.site_id` selects its row here, so
-- the BFF can address many sites. Only the api_url + (public) trust anchor + audience/issuer
-- live here; the PARTNER identity (mTLS client cert/key + OAuth private key) stays in the
-- secret store / env and is shared across sites. `ca_pem` is a public certificate, safe to
-- store; it is the CA the BFF trusts for THIS site's server cert (null → the shared MTLS_CA).

CREATE TABLE IF NOT EXISTS sites (
  site_id    TEXT PRIMARY KEY,
  api_url    TEXT NOT NULL,                       -- e.g. https://api.site1.paas.arkamicrostacks.com/v1
  audience   TEXT,                                -- JWT aud; null → spaceark-site-api:<site_id>
  issuer     TEXT,                                -- JWT iss (optional; must match the token)
  ca_pem     TEXT,                                -- per-site server CA to trust (public); null → env MTLS_CA
  enabled    BOOLEAN NOT NULL DEFAULT TRUE,       -- soft-disable a site without deleting its row
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
