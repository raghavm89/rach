'use strict';

/**
 * @rach/identity — shared auth, users, roles, and tenancy for RachDev & RachBase.
 *
 * RachBase is the identity provider (issues tokens); RachDev validates them.
 * Consumers mount the routers and reuse the middleware/models, e.g.:
 *   const { authRoutes, oauthRoutes, userRoutes, authenticate, authorize, User } = require('@rach/identity');
 *   app.use('/api/auth', authRoutes);
 *   app.use('/api/auth', oauthRoutes);
 *   app.use('/api/users', userRoutes);
 *
 * Depends on @rach/core for db/config/middleware/notifications.
 */

const authRoutes  = require('./src/routes/auth');
const oauthRoutes = require('./src/routes/oauth');
const userRoutes  = require('./src/routes/users');

const authController = require('./src/controllers/authController');
const userController = require('./src/controllers/userController');

const authenticate = require('./src/middleware/auth');
const authorize    = require('./src/middleware/role');

const { User, ROLES }    = require('./src/models/user');
const roles              = require('./src/config/roles');
const RefreshToken       = require('./src/models/refreshToken');
const VerificationCode   = require('./src/models/verification');

const { runAuthCleanup, startAuthCleanup, stopAuthCleanup } = require('./src/jobs/authCleanup');

module.exports = {
  // routers
  authRoutes,
  oauthRoutes,
  userRoutes,

  // controllers (for custom wiring if needed)
  authController,
  userController,

  // middleware
  authenticate,
  authorize,

  // models
  User,
  ROLES,
  roles,   // { PLATFORM_ROLES, INDUSTRIES, ALL_ROLES, HEALTHCARE, HR, withAdmins, rolesForIndustry }
  RefreshToken,
  VerificationCode,

  // jobs
  runAuthCleanup,
  startAuthCleanup,
  stopAuthCleanup,
};
