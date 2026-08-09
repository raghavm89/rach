'use strict';

/**
 * Self-serve signup toggle.
 *
 * RachDev is provisioned like Google Workspace: an organization admin adds
 * users (POST /api/users). Public self-service account creation — both
 * email/password registration and OAuth auto-provisioning — is OFF unless
 * PUBLIC_SIGNUP_ENABLED is explicitly set truthy. Read at call time so it can
 * be flipped without a rebuild.
 */
function publicSignupEnabled() {
  const v = String(process.env.PUBLIC_SIGNUP_ENABLED || '').toLowerCase();
  return v === 'true' || v === '1' || v === 'yes';
}

const SIGNUP_DISABLED_MESSAGE =
  'Self-service signup is disabled. RachDev accounts are created by your organization admin — please contact them for access.';

module.exports = { publicSignupEnabled, SIGNUP_DISABLED_MESSAGE };
