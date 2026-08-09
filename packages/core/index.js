'use strict';

/**
 * @rach/core — shared backend foundation for RachDev and RachBase.
 *
 * Consumers import from the barrel, e.g.:
 *   const { pool, validateEnv, asyncHandler, brevo } = require('@rach/core');
 *
 * This keeps internal file layout an implementation detail so packages can be
 * reorganized without breaking either app.
 */

const pool          = require('./src/config/db');
const validateEnv   = require('./src/config/env');

const asyncHandler  = require('./src/middleware/asyncHandler');
const parseId       = require('./src/middleware/parseId');
const paginate      = require('./src/middleware/paginate');
const rateLimit     = require('./src/middleware/rateLimit');
const idempotency   = require('./src/middleware/idempotency');

const IdempotencyKey = require('./src/models/idempotencyKey');
const WebhookEvent   = require('./src/models/webhookEvent');
const AgentDefinition = require('./src/models/agentDefinition');
const AgentDeployment = require('./src/models/agentDeployment');
const Hr = require('./src/models/hr');
const Settings = require('./src/models/settings');

const agentSpec = require('./src/spec/agentSpec');

const brevo = require('./src/services/brevo');
const sms   = require('./src/services/sms');

module.exports = {
  // config / db
  pool,
  validateEnv,

  // middleware
  asyncHandler,
  parseId,
  paginate,      // { paginate, paginated }
  rateLimit,     // { loginLimiter, registerLimiter, ... }
  idempotency,

  // models (cross-cutting)
  IdempotencyKey,
  WebhookEvent,
  AgentDefinition,
  AgentDeployment,
  Hr,
  Settings,

  // AgentSpec contract (validation + row↔spec mapping)
  agentSpec,   // { validateAgentSpec, validateAgentSpecInput, rowToSpec, columnsFromInput, ... }

  // notifications
  brevo,
  sms,
};
