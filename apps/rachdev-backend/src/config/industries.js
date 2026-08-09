'use strict';

/**
 * Industries an org/tenant can be set to. Single source of truth for the two
 * industry-setter endpoints (admin.setOrgIndustry, tenant.setIndustry).
 *
 * Keep the ids in sync with the frontend dashboard registry
 * (apps/rachdev-web/src/config/dashboard/registry.ts → industryModules), which
 * drives the workspace nav for each industry.
 */
const SUPPORTED_INDUSTRIES = [
  { id: 'healthcare', label: 'Healthcare' },
  { id: 'hr', label: 'Human Resources' },
];

const ALLOWED_INDUSTRIES = new Set(SUPPORTED_INDUSTRIES.map((i) => i.id));

module.exports = { SUPPORTED_INDUSTRIES, ALLOWED_INDUSTRIES };
