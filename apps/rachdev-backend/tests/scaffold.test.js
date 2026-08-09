'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const MIG = path.join(__dirname, '..', '..', '..', 'packages', 'core', 'src', 'db', 'migrations');

test('clinical-roles migration adds the three roles', () => {
  const sql = fs.readFileSync(path.join(MIG, '047_clinical_roles.sql'), 'utf8');
  for (const role of ['doctor', 'reception', 'store_manager']) {
    assert.match(sql, new RegExp(`ADD VALUE IF NOT EXISTS '${role}'`));
  }
});

test('agent_definitions migration creates the table with provider column', () => {
  const sql = fs.readFileSync(path.join(MIG, '048_agent_definitions.sql'), 'utf8');
  assert.match(sql, /CREATE TABLE IF NOT EXISTS agent_definitions/);
  assert.match(sql, /provider\s+TEXT\s+NOT NULL DEFAULT 'anthropic'/);
  assert.match(sql, /UNIQUE \(tenant_id, key\)/);
});

test('tenant_industry migration adds the tenants.industry column', () => {
  const sql = fs.readFileSync(path.join(MIG, '045_tenant_industry.sql'), 'utf8');
  assert.match(sql, /ALTER TABLE tenants ADD COLUMN IF NOT EXISTS industry/);
});

test('@rach/core exposes AgentDefinition with the expected CRUD surface', () => {
  const { AgentDefinition } = require('@rach/core');
  for (const m of ['create', 'listForTenant', 'findByKey', 'findById', 'update', 'remove']) {
    assert.equal(typeof AgentDefinition[m], 'function', `missing ${m}`);
  }
});

test('identity ROLES includes the clinical roles', () => {
  const { ROLES } = require('@rach/identity');
  for (const role of ['doctor', 'reception', 'store_manager']) {
    assert.ok(ROLES.includes(role), `ROLES missing ${role}`);
  }
});

test('agentController exports the definition endpoints', () => {
  const ctrl = require('../src/controllers/agentController');
  for (const m of ['listDefinitions', 'createDefinition', 'updateDefinition']) {
    assert.equal(typeof ctrl[m], 'function', `missing ${m}`);
  }
});
