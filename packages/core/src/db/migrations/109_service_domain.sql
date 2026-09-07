-- Optional per-service custom domain for shared containers (parity with the VM path). When
-- set, it's the app's public host; otherwise the platform provisions <service-slug>.rachbase.app.
-- The actual DNS/TLS/edge route is SpaceArk's (a handoff); this just records the desired host.

ALTER TABLE services ADD COLUMN IF NOT EXISTS custom_domain TEXT;
