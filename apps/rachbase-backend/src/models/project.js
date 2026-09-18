'use strict';

const crypto = require('crypto');
const { pool } = require('@rach/core');
const keyCrypto = require('../services/keyCrypto');
const baas = require('@rach/baas');
const authCfg = require('../lib/baasAuthConfig');
const storageCfg = require('../lib/baasStorageConfig');
const publicHost = require('../lib/publicHost');
const hostRegistry = require('../services/hostRegistry');

const BAAS_DOMAIN = process.env.APPS_DOMAIN || 'rachbase.app';

// Env var names: POSIX-ish, same rule as the VM path (deploymentController.ENV_KEY_RE).
const ENV_KEY_RE = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

function slugify(name) {
  return String(name).toLowerCase().trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'project';
}

const Project = {
  async countByTenant(tenantId) {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM projects WHERE tenant_id = $1', [tenantId]);
    return rows[0].c;
  },

  async create({ tenantId, name, createdBy }) {
    let slug = slugify(name);
    // ensure unique slug per tenant
    const { rows: dupe } = await pool.query('SELECT 1 FROM projects WHERE tenant_id=$1 AND slug=$2', [tenantId, slug]);
    if (dupe.length) slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;

    const { rows } = await pool.query(
      `INSERT INTO projects (tenant_id, name, slug, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [tenantId, name, slug, createdBy || null]
    );
    const project = rows[0];
    // every project gets a default "production" environment
    await pool.query(
      `INSERT INTO environments (project_id, name, is_default) VALUES ($1, 'production', TRUE)`,
      [project.id]
    );
    return project;
  },

  async listByTenant(tenantId) {
    const { rows } = await pool.query(
      `SELECT p.*,
              (SELECT COUNT(*)::int FROM services s WHERE s.project_id = p.id) AS service_count,
              (SELECT COUNT(*)::int FROM services s WHERE s.project_id = p.id AND s.status = 'online') AS online_count
       FROM projects p WHERE p.tenant_id = $1 ORDER BY p.updated_at DESC`,
      [tenantId]
    );
    return rows;
  },

  async findScoped(id, tenantId) {
    const { rows } = await pool.query('SELECT * FROM projects WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    return rows[0] || null;
  },

  async findBySlug(slug, tenantId) {
    const { rows } = await pool.query('SELECT * FROM projects WHERE slug = $1 AND tenant_id = $2', [slug, tenantId]);
    return rows[0] || null;
  },

  // How many of a tenant's projects have BaaS enabled (for plan-limit enforcement).
  async countBaasEnabled(tenantId) {
    const { rows } = await pool.query('SELECT COUNT(*)::int AS c FROM projects WHERE tenant_id = $1 AND baas_enabled = TRUE', [tenantId]);
    return rows[0].c;
  },

  // Tenant-level BaaS overview: every project with its ref/url + enabled flag (keys are fetched
  // per-project on demand, not listed here).
  async listBaas(tenantId) {
    const { rows } = await pool.query(
      'SELECT id, name, ref, baas_enabled FROM projects WHERE tenant_id = $1 ORDER BY updated_at DESC', [tenantId]);
    return rows.map((r) => ({ id: r.id, name: r.name, ref: r.ref, baas_enabled: r.baas_enabled, url: r.ref ? `https://${r.ref}.${BAAS_DOMAIN}` : null }));
  },

  // Look up a project by its public BaaS ref (used by the gateway to resolve <ref>.rachbase.app).
  async findByRef(ref) {
    const { rows } = await pool.query('SELECT * FROM projects WHERE ref = $1', [ref]);
    return rows[0] || null;
  },

  // Store the sealed per-project DB connection string (from baasDb provisioning).
  async setDbUrl(projectId, url) {
    const { rows } = await pool.query(
      'UPDATE projects SET db_url_enc = $2, updated_at = NOW() WHERE id = $1 RETURNING *',
      [projectId, url ? keyCrypto.seal(url) : null]);
    return rows[0];
  },

  // The unsealed per-project DB URL (for the Auth/PostgREST deploy env), or null.
  dbUrl(project) {
    if (!project?.db_url_enc) return null;
    try { return keyCrypto.open(project.db_url_enc); } catch { return null; }
  },

  // The unsealed per-project JWT secret — ONLY for injecting into the backend containers'
  // env at deploy time (PROJECT_JWT_SECRET). Never returned to the client.
  baasSecret(project) {
    if (!project?.jwt_secret_enc) return null;
    try { return keyCrypto.open(project.jwt_secret_enc); } catch { return null; }
  },

  // Turn a project into a BaaS project (Phase 3). Idempotent: the ref + per-project secret are
  // generated ONCE and preserved on re-enable (so existing keys stay valid). The secret is
  // sealed at rest (managed-service model). Returns the updated row.
  async enableBaas(projectId) {
    const { rows: cur } = await pool.query(
      'SELECT id, ref, jwt_secret_enc, sign_priv_enc FROM projects WHERE id = $1', [projectId]);
    const p = cur[0];
    if (!p) return null;
    const ref = p.ref || `p${crypto.randomBytes(8).toString('hex')}`;              // DNS-safe: letter + 16 hex
    const secretEnc = p.jwt_secret_enc || keyCrypto.seal(baas.generateSecret());
    // ES256 signing keypair for end-user session tokens (asymmetric). Generated once, preserved.
    let signPrivEnc = p.sign_priv_enc, signPub = null, signKid = null;
    if (!signPrivEnc) {
      const kp = baas.signing.generateSigningKeypair();
      signPrivEnc = keyCrypto.seal(kp.privatePem); signPub = kp.publicPem; signKid = kp.kid;
    }
    const { rows } = await pool.query(
      `UPDATE projects SET ref = $2, baas_enabled = TRUE, jwt_secret_enc = $3,
              sign_priv_enc = $4,
              sign_pub = COALESCE($5, sign_pub), sign_kid = COALESCE($6, sign_kid), updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [projectId, ref, secretEnc, signPrivEnc, signPub, signKid]
    );
    // Register the BaaS public host <ref>.rachbase.app in the global registry so no VM auto-domain
    // or container can later claim (and hijack) it (audit P0 #7). ref is a random p<16hex>, so this
    // is idempotent for this project and practically never collides.
    const tenantId = (await pool.query('SELECT tenant_id FROM projects WHERE id = $1', [projectId])).rows[0]?.tenant_id ?? null;
    await hostRegistry.claim({ hostname: `${ref}.${BAAS_DOMAIN}`, tenantId, kind: 'baas', ref: projectId }).catch(() => {});
    return rows[0];
  },

  // The unsealed ES256 signing keypair — private PEM ONLY for the Auth container's deploy env,
  // public PEM + kid for verifiers/JWKS. Returns null when not provisioned.
  signingKeypair(project) {
    if (!project?.sign_priv_enc || !project.sign_pub) return null;
    let privatePem = null;
    try { privatePem = keyCrypto.open(project.sign_priv_enc); } catch { return null; }
    return { privatePem, publicPem: project.sign_pub, kid: project.sign_kid || null };
  },

  // The project's JWKS document (public key only) — served for token verification.
  jwksFor(project) {
    if (!project?.sign_pub) return { keys: [] };
    try { return baas.signing.jwks(baas.signing.publicJwkFromPem(project.sign_pub, project.sign_kid)); }
    catch { return { keys: [] }; }
  },

  // ── Auth configuration (Supabase-parity) — control-plane, editable pre-deploy ──
  // Full config (defaults ⊕ stored), with OAuth secrets redacted for the client.
  async authConfig(projectId) {
    const { rows } = await pool.query('SELECT auth_config FROM projects WHERE id = $1', [projectId]);
    if (!rows.length) return null;
    return authCfg.redactSecrets(rows[0].auth_config || {});
  },

  // Apply a patch (deep-merge known sections; preserve unspecified OAuth secrets) and persist.
  // Returns the redacted, merged config.
  async setAuthConfig(projectId, patch) {
    const { rows: cur } = await pool.query('SELECT auth_config FROM projects WHERE id = $1', [projectId]);
    if (!cur.length) return null;
    const merged = authCfg.applyPatch(cur[0].auth_config || {}, patch, { seal: keyCrypto.seal });
    const { rows } = await pool.query(
      'UPDATE projects SET auth_config = $2, updated_at = NOW() WHERE id = $1 RETURNING auth_config',
      [projectId, JSON.stringify(merged)]);
    return authCfg.redactSecrets(rows[0].auth_config);
  },

  // The Auth-container env derived from a project's stored auth config (for the deploy bundle).
  authEnv(project) {
    return authCfg.toAuthEnv(project?.auth_config || {}, { open: keyCrypto.open });
  },

  // ── BaaS backend compute size (nano/micro/small) — applied to all 3 backend containers ──
  baasComputeSize(project) { return project?.baas_compute_size || 'nano'; },
  async setBaasComputeSize(projectId, size) {
    const { rows } = await pool.query(
      'UPDATE projects SET baas_compute_size = $2, updated_at = NOW() WHERE id = $1 RETURNING baas_compute_size',
      [projectId, size]);
    return rows[0]?.baas_compute_size || null;
  },

  // Park a pending pay-first upsize: the size is applied only after /baas/compute/verify.
  async beginBaasResize(projectId, { orderId, size }) {
    const { rows } = await pool.query(
      `UPDATE projects SET baas_pending_resize_order_id = $2, baas_pending_resize_size = $3, updated_at = NOW()
         WHERE id = $1 RETURNING *`,
      [projectId, orderId, size]);
    return rows[0] || null;
  },
  async clearBaasResize(projectId) {
    await pool.query(
      'UPDATE projects SET baas_pending_resize_order_id = NULL, baas_pending_resize_size = NULL, updated_at = NOW() WHERE id = $1',
      [projectId]);
  },

  // ── Storage configuration (Settings + S3) — control-plane, editable pre-deploy ──
  async storageConfig(projectId) {
    const { rows } = await pool.query('SELECT storage_config FROM projects WHERE id = $1', [projectId]);
    return rows.length ? storageCfg.withDefaults(rows[0].storage_config || {}) : null;
  },
  async setStorageConfig(projectId, patch) {
    const { rows: cur } = await pool.query('SELECT storage_config FROM projects WHERE id = $1', [projectId]);
    if (!cur.length) return null;
    const merged = storageCfg.applyPatch(cur[0].storage_config || {}, patch);
    const { rows } = await pool.query(
      'UPDATE projects SET storage_config = $2, updated_at = NOW() WHERE id = $1 RETURNING storage_config',
      [projectId, JSON.stringify(merged)]);
    return storageCfg.withDefaults(rows[0].storage_config);
  },
  storageEnv(project) { return storageCfg.toStorageEnv(project?.storage_config || {}); },

  // ── S3 access keys — access_key_id is public; the secret is shown once (hash stored) ──
  async createS3Key(projectId, name) {
    const accessKeyId = 'RB' + crypto.randomBytes(9).toString('hex').toUpperCase();      // 20 chars
    const secret = crypto.randomBytes(24).toString('base64url');
    const hash = crypto.createHash('sha256').update(secret).digest('hex');
    const { rows } = await pool.query(
      `INSERT INTO baas_s3_keys (project_id, name, access_key_id, secret_hash)
       VALUES ($1, $2, $3, $4) RETURNING id, name, access_key_id, created_at`,
      [projectId, String(name || '').trim().slice(0, 100), accessKeyId, hash]);
    return { ...rows[0], secret_access_key: secret };                                     // shown once
  },
  async listS3Keys(projectId) {
    const { rows } = await pool.query(
      'SELECT id, name, access_key_id, created_at FROM baas_s3_keys WHERE project_id = $1 ORDER BY created_at DESC', [projectId]);
    return rows;
  },
  async deleteS3Key(projectId, keyId) {
    const { rowCount } = await pool.query('DELETE FROM baas_s3_keys WHERE id = $1 AND project_id = $2', [keyId, projectId]);
    return rowCount > 0;
  },

  // Public BaaS config for a project row: ref, base URL, and the anon/service_role keys minted
  // from the per-project secret. Returns null when BaaS isn't enabled. Never returns the secret.
  baasConfig(project) {
    if (!project?.baas_enabled || !project.jwt_secret_enc || !project.ref) return null;
    const secret = keyCrypto.open(project.jwt_secret_enc);
    return {
      ref: project.ref,
      url: `https://${project.ref}.${BAAS_DOMAIN}`,
      anon_key: baas.mintAnonKey(secret, project.ref),
      service_role_key: baas.mintServiceKey(secret, project.ref),
    };
  },

  // ── Opaque API keys (Supabase's current model): publishable + revocable secret keys ──
  // Stored in baas_api_keys (SHA-256 hash for lookup; publishable plaintext kept since it's
  // public). Unlike the legacy JWT keys above, each is revocable individually + audited.

  // Ensure the project has an active publishable key; create one if missing. Returns the row.
  async ensurePublishableKey(projectId) {
    const { rows: ex } = await pool.query(
      `SELECT * FROM baas_api_keys WHERE project_id = $1 AND type = 'publishable' AND revoked_at IS NULL LIMIT 1`,
      [projectId]);
    if (ex.length) return ex[0];
    const { key, hash, last4 } = baas.apikeys.generateKey('publishable');
    const { rows } = await pool.query(
      `INSERT INTO baas_api_keys (project_id, type, name, key_hash, key_public, last4)
       VALUES ($1, 'publishable', 'default', $2, $3, $4) RETURNING *`,
      [projectId, hash, key, last4]);
    return rows[0];
  },

  // Mint a new secret key. The plaintext is returned ONCE (only the hash is persisted).
  async createSecretKey(projectId, name) {
    const { key, hash, last4 } = baas.apikeys.generateKey('secret');
    const clean = String(name || 'secret').trim().slice(0, 60) || 'secret';
    const { rows } = await pool.query(
      `INSERT INTO baas_api_keys (project_id, type, name, key_hash, last4)
       VALUES ($1, 'secret', $2, $3, $4) RETURNING id, type, name, last4, created_at, revoked_at`,
      [projectId, clean, hash, last4]);
    return { ...rows[0], key };           // key: plaintext, shown once
  },

  // List a project's API keys (no secret material). Publishable includes its public plaintext.
  async listApiKeys(projectId) {
    const { rows } = await pool.query(
      `SELECT id, type, name, last4, key_public, created_at, revoked_at, last_used_at
         FROM baas_api_keys WHERE project_id = $1
        ORDER BY (type = 'publishable') DESC, created_at ASC`,
      [projectId]);
    return rows.map((r) => ({
      id: r.id, type: r.type, name: r.name, last4: r.last4,
      key: r.type === 'publishable' ? r.key_public : null,   // publishable is public; secret shown once
      created_at: r.created_at, revoked_at: r.revoked_at, last_used_at: r.last_used_at,
    }));
  },

  // Revoke one key (scoped to the project). Returns true if a row was revoked.
  async revokeApiKey(projectId, keyId) {
    const { rowCount } = await pool.query(
      `UPDATE baas_api_keys SET revoked_at = NOW() WHERE id = $1 AND project_id = $2 AND revoked_at IS NULL`,
      [keyId, projectId]);
    return rowCount > 0;
  },

  // Introspect a presented key for a project ref (the gateway's validation path). Returns
  // { valid, role, type } — role is 'anon' | 'service_role'. Touches last_used_at on a hit.
  async introspectKey(ref, key) {
    const type = baas.apikeys.typeOfKey(key);
    if (!ref || !type) return { valid: false };
    const hash = baas.apikeys.hashKey(key);
    const { rows } = await pool.query(
      `UPDATE baas_api_keys k SET last_used_at = NOW()
         FROM projects p
        WHERE k.project_id = p.id AND p.ref = $1 AND k.key_hash = $2 AND k.revoked_at IS NULL
        RETURNING k.type`,
      [ref, hash]);
    if (!rows.length) return { valid: false };
    return { valid: true, type: rows[0].type, role: baas.apikeys.roleForType(rows[0].type) };
  },
};

const Environment = {
  async listByProject(projectId) {
    const { rows } = await pool.query('SELECT * FROM environments WHERE project_id = $1 ORDER BY is_default DESC, id ASC', [projectId]);
    return rows;
  },
};

const Service = {
  // count all services owned by a tenant (across their projects) — for plan quota
  async countByTenant(tenantId) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS c
       FROM services s JOIN projects p ON p.id = s.project_id
       WHERE p.tenant_id = $1`,
      [tenantId]
    );
    return rows[0].c;
  },

  // A new service starts as a DRAFT with 0 paid units — it goes online only after
  // the first unit is paid for (pay-to-online).
  async create({ projectId, name, sourceType, repoFullName, branch, image, computeTarget, vmId, createdBy }) {
    const { rows } = await pool.query(
      `INSERT INTO services
         (project_id, name, source_type, repo_full_name, branch, image, units, status, compute_target, vm_id, created_by)
       VALUES ($1,$2,$3,$4,$5,$6, 0, 'draft', $7, $8, $9) RETURNING *`,
      [projectId, name, sourceType || 'github_repo', repoFullName || null, branch || 'main', image || null,
       computeTarget || 'shared', vmId || null, createdBy || null]
    );
    return rows[0];
  },

  // ── Env vars + run command (parity with the VM path) ────────────────────────
  // The run command the user set; NULL → run the image's built-in ENTRYPOINT/CMD.
  async setStartCommand(serviceId, startCommand) {
    const cmd = startCommand == null || String(startCommand).trim() === '' ? null : String(startCommand);
    const { rows } = await pool.query(
      `UPDATE services SET start_command = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [serviceId, cmd]
    );
    return rows[0];
  },

  // The app's public host: the user's custom domain if set, else <service-slug>.rachbase.app.
  // The platform's provisioned URL derives from this (SpaceArk owns the actual edge route).
  hostFor(service, appsDomain = process.env.APPS_DOMAIN || 'rachbase.app') {
    const custom = service && service.custom_domain && String(service.custom_domain).trim();
    if (custom) return custom.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
    if (service && service.public_host) return service.public_host; // globally-unique claimed host
    return `${slugify(service.name)}.${appsDomain}`;                 // fallback before a host is claimed
  },

  // Claim a GLOBALLY-UNIQUE public host for the service (idempotent). Prefers the readable
  // `<slug>.rachbase.app`; if that slug is reserved/taken by another tenant, falls back to the
  // guaranteed-unique `svc-<id>.rachbase.app`. The DB unique index is the real enforcement.
  async ensurePublicHost(service) {
    if (service.public_host) return service.public_host;
    const guaranteed = `svc-${service.id}.${publicHost.APPS_DOMAIN}`;
    const preferred = publicHost.platformHostForSlug(slugify(service.name)) || guaranteed;
    // Resolve the tenant so the global claim is attributed correctly.
    const tenantId = (await pool.query('SELECT tenant_id FROM projects WHERE id = $1', [service.project_id])).rows[0]?.tenant_id ?? null;
    for (const host of [preferred, guaranteed]) {
      // Reserve in the GLOBAL registry first (audit P0 #7) — this rejects a slug already owned by a
      // VM auto-domain, another container, a BaaS ref, or a custom domain, not just this table.
      const reg = await hostRegistry.claim({ hostname: host, tenantId, kind: 'container', ref: service.id });
      if (!reg.claimed) continue; // taken cross-namespace → fall through to the guaranteed svc-<id>
      try {
        const { rows } = await pool.query(
          `UPDATE services SET public_host = $2, updated_at = NOW()
             WHERE id = $1 AND public_host IS NULL
               AND NOT EXISTS (SELECT 1 FROM services WHERE public_host = $2)
             RETURNING public_host`,
          [service.id, host]);
        if (rows.length) return rows[0].public_host;
        const cur = (await pool.query('SELECT public_host FROM services WHERE id = $1', [service.id])).rows[0];
        if (cur && cur.public_host) return cur.public_host; // already claimed (race / prior deploy)
        await hostRegistry.release({ hostname: host }).catch(() => {}); // didn't take it → don't hold it
      } catch (e) {
        await hostRegistry.release({ hostname: host }).catch(() => {});
        if (e.code !== '23505') throw e; // not a unique-violation → real error
        // host taken between the check and write → try the next (guaranteed) candidate
      }
    }
    return guaranteed;
  },

  // The container's listen port (default 8080 when unset). Threaded to the App CRD.
  portFor(service) {
    const p = service && Number(service.port);
    return Number.isInteger(p) && p >= 1 && p <= 65535 ? p : 8080;
  },

  // Set/clear the container port (null clears → default 8080). Caller validates the range.
  async setPort(serviceId, port) {
    const p = port == null || port === '' ? null : Number(port);
    const { rows } = await pool.query(
      `UPDATE services SET port = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [serviceId, Number.isInteger(p) ? p : null]
    );
    return rows[0];
  },

  // Set/clear the custom domain (null/'' clears → falls back to the platform host). A non-empty
  // domain is validated: it must be a real external hostname, never a rachbase.app subdomain or
  // a reserved/platform host (throws → caller returns 400). Ownership is verified before routing.
  async setCustomDomain(serviceId, domain) {
    const raw = domain == null ? '' : String(domain).trim();
    const d = raw === '' ? null : publicHost.assertSafeCustomDomain(raw); // throws on unsafe input
    const { rows: srows } = await pool.query(
      'SELECT s.custom_domain, p.tenant_id FROM services s JOIN projects p ON p.id = s.project_id WHERE s.id = $1',
      [serviceId]);
    const prev = srows[0]?.custom_domain || null;
    const tenantId = srows[0]?.tenant_id ?? null;
    // Reserve the new domain globally (audit P0 #7) so two services can't both route the same host.
    if (d) {
      const reg = await hostRegistry.claim({ hostname: d, tenantId, kind: 'custom', ref: serviceId });
      if (!reg.claimed) throw Object.assign(new Error('That domain is already claimed by another service.'), { status: 409 });
    }
    const { rows } = await pool.query(
      `UPDATE services SET custom_domain = $2, updated_at = NOW() WHERE id = $1 RETURNING *`,
      [serviceId, d]
    );
    // Free the previous custom domain's reservation if it changed/cleared.
    if (prev && hostRegistry.norm(prev) !== hostRegistry.norm(d || '')) {
      await hostRegistry.release({ hostname: prev }).catch(() => {});
    }
    return rows[0];
  },

  // Decrypted env for a deploy: [{ key, value }] (secrets included — like the VM env file).
  async getEnv(serviceId) {
    const { rows } = await pool.query(
      'SELECT key, value_enc FROM service_env WHERE service_id = $1 ORDER BY key', [serviceId]
    );
    return rows.map((r) => {
      try { return { key: r.key, value: keyCrypto.open(r.value_enc) }; }
      catch { return { key: r.key, value: '' }; }
    });
  },

  // Env for the editor API: [{ key, value, is_secret }] (decrypted; UI masks secrets).
  async getEnvMasked(serviceId) {
    const { rows } = await pool.query(
      'SELECT key, value_enc, is_secret FROM service_env WHERE service_id = $1 ORDER BY key', [serviceId]
    );
    return rows.map((r) => {
      let value = '';
      try { value = keyCrypto.open(r.value_enc); } catch { /* unreadable → blank */ }
      return { key: r.key, value, is_secret: r.is_secret };
    });
  },

  // Replace the whole env set (simple editor semantics). Requires keyCrypto configured.
  // Returns the number of vars stored. Invalid/duplicate keys are dropped.
  async setEnv(serviceId, vars) {
    const seen = new Set();
    const clean = [];
    for (const v of (Array.isArray(vars) ? vars : []).slice(0, 200)) {
      const key = String(v?.key ?? '').trim();
      if (!ENV_KEY_RE.test(key) || seen.has(key)) continue;
      seen.add(key);
      clean.push({ key, value: String(v?.value ?? ''), is_secret: v?.is_secret !== false });
    }
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM service_env WHERE service_id = $1', [serviceId]);
      for (const v of clean) {
        await client.query(
          `INSERT INTO service_env (service_id, key, value_enc, is_secret) VALUES ($1, $2, $3, $4)`,
          [serviceId, v.key, keyCrypto.seal(v.value), v.is_secret]
        );
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
    return clean.length;
  },

  // Store the auto-detected app type + default deploy image (best-effort, at create time).
  async setDetected(serviceId, { appType, image }) {
    const { rows } = await pool.query(
      `UPDATE services SET app_type = $2, image = COALESCE($3, image), updated_at = NOW() WHERE id = $1 RETURNING *`,
      [serviceId, appType || null, image || null],
    );
    return rows[0];
  },

  // How many billable containers a tenant already runs on the SHARED (Pro) path —
  // i.e. services past the draft/pending stage. Excludes `excludeServiceId` (the one
  // being brought online now) so its own charge is priced against the others.
  async countBillableShared(tenantId, excludeServiceId = 0) {
    const { rows } = await pool.query(
      `SELECT COUNT(*)::int AS c
         FROM services s JOIN projects p ON p.id = s.project_id
        WHERE p.tenant_id = $1
          AND s.compute_target = 'shared'
          AND s.status NOT IN ('draft','pending_payment')
          AND s.id <> $2`,
      [tenantId, excludeServiceId]
    );
    return rows[0].c;
  },

  // Record the pending Razorpay order + chosen compute size while checkout is open,
  // so verify can tie the payment back to this service. Draft → pending_payment.
  async beginCheckout(serviceId, { orderId, computeSize }) {
    const { rows } = await pool.query(
      `UPDATE services
          SET compute_size = $2, pending_order_id = $3, status = 'pending_payment', updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [serviceId, computeSize, orderId]
    );
    return rows[0];
  },

  // Bring a container online (payment cleared, or free app slot). Idempotent; clears
  // the pending order. `units` is set to 1 so per-service compute displays cleanly.
  // Flip a live service to 'deploying' the moment a deploy is enqueued, so the header matches
  // the in-flight deploy row. Only for already-provisioned services (not draft/pending_payment);
  // the status worker promotes it to online/crashed when the app op reconciles.
  async markDeploying(serviceId) {
    const { rows } = await pool.query(
      `UPDATE services SET status = 'deploying', updated_at = NOW()
         WHERE id = $1 AND status IN ('online', 'crashed', 'stopped', 'deploying') RETURNING *`,
      [serviceId]);
    return rows[0] || null;
  },

  async markOnline(serviceId, computeSize) {
    const { rows } = await pool.query(
      `UPDATE services
          SET status = 'online', units = 1, compute_size = COALESCE($2, compute_size),
              pending_order_id = NULL, updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [serviceId, computeSize || null]
    );
    return rows[0];
  },

  async setStatus(serviceId, status) {
    await pool.query('UPDATE services SET status = $1, updated_at = NOW() WHERE id = $2', [status, serviceId]);
  },

  // Record a pending UPSIZE while its one-time delta checkout is open. The container stays
  // ONLINE at its current size; only the target (order + size) is parked for verify.
  async beginResize(serviceId, { orderId, size }) {
    const { rows } = await pool.query(
      `UPDATE services
          SET pending_resize_order_id = $2, pending_resize_size = $3, updated_at = NOW()
        WHERE id = $1 RETURNING *`,
      [serviceId, orderId, size]
    );
    return rows[0];
  },

  // Clear a pending upsize (after it verifies, or when superseded by a new attempt).
  async clearResize(serviceId) {
    await pool.query(
      `UPDATE services SET pending_resize_order_id = NULL, pending_resize_size = NULL, updated_at = NOW() WHERE id = $1`,
      [serviceId]
    );
  },

  async listByProject(projectId) {
    const { rows } = await pool.query('SELECT * FROM services WHERE project_id = $1 ORDER BY id ASC', [projectId]);
    return rows;
  },

  async findScoped(id, tenantId) {
    const { rows } = await pool.query(
      `SELECT s.* FROM services s JOIN projects p ON p.id = s.project_id
       WHERE s.id = $1 AND p.tenant_id = $2`,
      [id, tenantId]
    );
    return rows[0] || null;
  },

  // Delete a service (deployments cascade). Removes it from the billable-container
  // count, so the tenant is no longer charged for it going forward.
  async delete(id) {
    const { rowCount } = await pool.query('DELETE FROM services WHERE id = $1', [id]);
    return rowCount > 0;
  },

  // Stop every shared (Pro) container a tenant runs — used when cancelling Pro. Returns
  // the affected service rows so the caller can tear them down on the site.
  async stopAllShared(tenantId) {
    const { rows } = await pool.query(
      `UPDATE services s
          SET status = 'stopped', pending_order_id = NULL, updated_at = NOW()
         FROM projects p
        WHERE p.id = s.project_id AND p.tenant_id = $1
          AND s.compute_target = 'shared' AND s.status <> 'stopped'
        RETURNING s.id, s.name, s.project_id`,
      [tenantId]
    );
    return rows;
  },
};

const Deployment = {
  async create({ serviceId, environmentId, commitSha, imageTag, triggeredBy, status, operationId = null }) {
    const { rows } = await pool.query(
      `INSERT INTO deployments (service_id, environment_id, commit_sha, image_tag, triggered_by, status, operation_id)
       VALUES ($1,$2,$3,$4,$5, COALESCE($6, 'queued'), $7) RETURNING *`,
      [serviceId, environmentId || null, commitSha || null, imageTag || null, triggeredBy || 'manual', status || null, operationId]
    );
    return rows[0];
  },

  // Reflect a site operation's terminal outcome onto its deploy-history row (keyed by
  // operation_id, so concurrent deploys each resolve correctly). status = 'success' | 'failed'.
  async setStatusByOperation(operationId, status) {
    if (!operationId) return false;
    const { rowCount } = await pool.query(
      'UPDATE deployments SET status = $2 WHERE operation_id = $1 AND status <> $2',
      [operationId, status]);
    return rowCount > 0;
  },

  // Record a direct-image deploy (test/BYOI path — no build). One row per (service, image);
  // pressing Deploy again bumps the existing row instead of spamming duplicates.
  async upsertForImage({ serviceId, imageTag, triggeredBy = 'manual', status = 'success' }) {
    if (imageTag) {
      const { rows } = await pool.query(
        `UPDATE deployments SET created_at = NOW(), triggered_by = $3, status = $4
           WHERE service_id = $1 AND image_tag = $2 AND commit_sha IS NULL RETURNING *`,
        [serviceId, imageTag, triggeredBy, status]);
      if (rows.length) return rows[0];
    }
    return Deployment.create({ serviceId, imageTag, triggeredBy, status });
  },

  async listByService(serviceId) {
    // Attach the site failure reason (joined by operation_id) so the UI can show WHY a deploy
    // failed — e.g. a rejected App CRD field — instead of a bare red dot. The reason may live on
    // the outbox row (delivery error) or the operation record (terminal reason); take either.
    const { rows } = await pool.query(
      `SELECT d.*, COALESCE(o.last_error, op.reason) AS error_reason, op.state AS op_state
         FROM deployments d
         LEFT JOIN site_outbox o     ON o.operation_id  = d.operation_id
         LEFT JOIN site_operations op ON op.operation_id = d.operation_id
        WHERE d.service_id = $1
        ORDER BY d.created_at DESC LIMIT 50`,
      [serviceId]);
    return rows;
  },

  // Delete one deploy history row, scoped to its service (caller checks the service is the
  // tenant's). Used to clear queued/stale deploys from the panel.
  async deleteScoped(id, serviceId) {
    const { rowCount } = await pool.query('DELETE FROM deployments WHERE id = $1 AND service_id = $2', [id, serviceId]);
    return rowCount > 0;
  },

  // Record a deploy, but keep ONE row per (service, commit): redeploying the same commit
  // bumps the existing row to the top instead of adding a duplicate history entry.
  async upsertForCommit({ serviceId, commitSha, triggeredBy = 'manual' }) {
    if (commitSha) {
      const { rows } = await pool.query(
        `UPDATE deployments SET created_at = NOW(), triggered_by = $3
           WHERE service_id = $1 AND commit_sha = $2 RETURNING *`,
        [serviceId, commitSha, triggeredBy]);
      if (rows.length) return rows[0];
    }
    return Deployment.create({ serviceId, commitSha, triggeredBy });
  },
};

module.exports = { Project, Environment, Service, Deployment, slugify };
