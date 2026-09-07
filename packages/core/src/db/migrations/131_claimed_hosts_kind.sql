-- 131_claimed_hosts_kind.sql
-- Normalize the custom-domain claim kind. Migration 128 backfilled pre-existing custom
-- domains as kind='custom', but the runtime briefly wrote 'vm_custom' for new claims —
-- and claim()'s ownership check requires kind equality, so an owner re-adding their own
-- pre-existing domain got a 409. The runtime now writes 'custom'; converge old rows.

UPDATE claimed_hosts SET kind = 'custom' WHERE kind = 'vm_custom';

-- Reversal: none needed (kind is informational; 'custom' is the canonical value).
