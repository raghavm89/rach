'use strict';

const { Settings } = require('@rach/core');

/**
 * The model an org's agents should run on, set by a platform admin
 * (tenant_settings key 'llm' → { model }). A Claude catalog id or an on-prem
 * model (e.g. 'sarvam-105b'). null = use the platform/environment default.
 */
async function getTenantModel(tenantId) {
  if (tenantId == null) return null;
  try {
    const v = await Settings.get(tenantId, 'llm');
    return (v && v.model) || null;
  } catch {
    return null;
  }
}

module.exports = { getTenantModel };
