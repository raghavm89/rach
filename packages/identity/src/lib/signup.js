'use strict';

/**
 * Self-serve signup toggle.
 *
 * RachDev runs a product-led motion: anyone can sign up, gets free credits, and
 * builds/tests an agent before paying. Public self-service signup is therefore
 * ON by default. Set PUBLIC_SIGNUP_ENABLED=false to fall back to the
 * admin-provisioned ("Google Workspace") model where an admin adds users via
 * POST /api/users. Read at call time so it can be flipped without a rebuild.
 */
function publicSignupEnabled() {
  const v = String(process.env.PUBLIC_SIGNUP_ENABLED ?? '').toLowerCase();
  if (v === 'false' || v === '0' || v === 'no') return false;
  return true; // default on
}

const SIGNUP_DISABLED_MESSAGE =
  'Self-service signup is disabled. RachDev accounts are created by your organization admin — please contact them for access.';

module.exports = { publicSignupEnabled, SIGNUP_DISABLED_MESSAGE };
