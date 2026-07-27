'use strict';

/**
 * DEPRECATED / UNUSED.
 *
 * This once proxied the agent runtime to rachdev-backend, but that inverted the
 * dependency (RachBase must not depend on RachDev). The Deploy Agent runtime is
 * now NATIVE to rachbase — see controllers/agentRuntimeController.js. Nothing
 * imports this file; it can be deleted.
 */

module.exports = {};
