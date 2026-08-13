'use strict';

/**
 * Role registry — the single source of truth for RachDev's roles on the backend.
 *
 * Mirrors the frontend industry-module registry (apps/rachdev-web/src/config/
 * dashboard/registry.ts): platform roles are industry-independent; every vertical
 * declares its OWN roles and the reusable authorization GROUPS its routes use.
 * Adding a vertical (or changing who can do what) is a change HERE — not edits
 * scattered across a dozen route files or a hand-maintained global enum.
 *
 * Each group array already includes the platform admins that always have access
 * (`tenant_admin` = Org Admin, `admin` = platform), so route files read cleanly:
 *   const { HEALTHCARE } = require('@rach/identity').roles;
 *   router.get('/', authorize(...HEALTHCARE.clinician), handler);
 */

// Industry-independent platform roles.
const PLATFORM_ROLES = ['admin', 'tenant_admin', 'tenant_user', 'developer'];

// The admins implicitly granted on every workspace route.
const ADMINS = ['tenant_admin', 'admin'];
const withAdmins = (...roles) => [...roles, ...ADMINS];

// Per-vertical role definitions + the authorization groups the routes use.
const INDUSTRIES = {
  healthcare: {
    roles: ['doctor', 'reception', 'store_manager'],
    groups: {
      clinician: withAdmins('doctor'),                              // doctor-only actions
      frontdesk: withAdmins('reception', 'doctor'),                 // reception + clinicians
      store:     withAdmins('store_manager'),                       // inventory
      anyStaff:  withAdmins('reception', 'doctor', 'store_manager'),// any clinical staff
      viewer:    withAdmins('doctor', 'reception'),                 // read notes
      signer:    ['doctor', 'admin'],                               // sign-off: doctor or platform admin only
    },
  },
  hr: {
    roles: ['hr_executive', 'hr_director', 'project_manager', 'employee'],
    groups: {
      staff:    withAdmins('hr_executive', 'hr_director', 'project_manager'),
      director: withAdmins('hr_director'),
      employee: withAdmins('employee'),
    },
  },
};

// Flattened allowlist for validation + the DB `user_role` enum parity.
const ALL_ROLES = [
  ...PLATFORM_ROLES,
  ...Object.values(INDUSTRIES).flatMap((v) => v.roles),
];

// Convenience named exports for route files.
const HEALTHCARE = INDUSTRIES.healthcare.groups;
const HR = INDUSTRIES.hr.groups;

/** All roles a given industry recognizes (platform + its own). */
function rolesForIndustry(industry) {
  const v = INDUSTRIES[industry];
  return v ? [...PLATFORM_ROLES, ...v.roles] : [...PLATFORM_ROLES];
}

module.exports = {
  PLATFORM_ROLES,
  INDUSTRIES,
  ALL_ROLES,
  HEALTHCARE,
  HR,
  withAdmins,
  rolesForIndustry,
};
