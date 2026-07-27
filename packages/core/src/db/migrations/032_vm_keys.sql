-- 032_vm_keys.sql
-- Per-VM SSH keypairs (control-plane held). Each VM gets its own keypair so a
-- leaked key compromises one VM, not the fleet. The private key is stored
-- ENCRYPTED (AES-256-GCM envelope, see services/keyCrypto.js) — never plaintext.
--
-- Lifecycle:
--   pending   → generated at order time, public key emailed to ARKA, VM not yet created
--   active    → ARKA installed the public key and returned the vm_id; ready to use
--   rotating  → a replacement keypair is being rolled over (verify-before-delete)
--   revoked   → superseded/retired; kept for audit
--
-- The keypair is linked to vm_id once ARKA hands the VM back. order_id ties the
-- pending keys to the order that created them (a VM order for qty N mints N keys).

CREATE TABLE IF NOT EXISTS vm_keys (
  id                    SERIAL PRIMARY KEY,
  order_id              INTEGER REFERENCES vm_expansion_requests(id) ON DELETE SET NULL,
  vm_id                 TEXT,                       -- null until activated
  user_id               INTEGER REFERENCES users(id) ON DELETE SET NULL,
  tenant_id             INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  public_key            TEXT NOT NULL,              -- OpenSSH authorized_keys format
  private_key_encrypted TEXT NOT NULL,             -- base64 iv:tag:ciphertext (AES-256-GCM)
  fingerprint           TEXT NOT NULL,              -- SHA256 of the public key, for reference
  ssh_user              TEXT NOT NULL DEFAULT 'rachops',
  status                TEXT NOT NULL DEFAULT 'pending',  -- pending | active | rotating | revoked
  key_version           INTEGER NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  activated_at          TIMESTAMPTZ,
  rotated_at            TIMESTAMPTZ
);

-- One ACTIVE key per VM (partial unique index — pending/rotating/revoked may coexist).
CREATE UNIQUE INDEX IF NOT EXISTS uniq_vm_keys_active_vm
  ON vm_keys(vm_id) WHERE status = 'active' AND vm_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vm_keys_vm     ON vm_keys(vm_id);
CREATE INDEX IF NOT EXISTS idx_vm_keys_order  ON vm_keys(order_id);
CREATE INDEX IF NOT EXISTS idx_vm_keys_status ON vm_keys(status);
