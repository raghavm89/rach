-- Optional workspace/company name captured at signup. When present, verifyEmail
-- provisions a tenant with this name and makes the new user its tenant_admin;
-- when absent the user is created tenantless (and stays that way until an admin
-- assigns a tenant).

ALTER TABLE pending_registrations
  ADD COLUMN IF NOT EXISTS workspace_name TEXT;
