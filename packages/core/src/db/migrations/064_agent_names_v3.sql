-- ── 064_agent_names_v3.sql ───────────────────────────────────────────────────
-- Reconcile the healthcare agent display names to the Armed Forces deck (v3):
-- Scribe 'Nora' → 'Naina', Reception 'Ava' → 'Asha'. Internal keys are unchanged.
-- Only touches the platform templates (tenant_id NULL) that still carry the old
-- name, so tenant-customised names are preserved. Inventory 'Kiran' is kept
-- (it is not one of the deck's seven agents).

UPDATE agent_definitions SET name = 'Naina', updated_at = NOW()
 WHERE tenant_id IS NULL AND key = 'scribe'    AND name = 'Nora';

UPDATE agent_definitions SET name = 'Asha', updated_at = NOW()
 WHERE tenant_id IS NULL AND key = 'reception' AND name = 'Ava';
