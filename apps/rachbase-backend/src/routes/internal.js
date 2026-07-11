'use strict';

const { Router } = require('express');
const { asyncHandler } = require('@rach/core');
const serviceAuth = require('../middleware/serviceAuth');
const ctrl = require('./../controllers/internalController');

const router = Router();

// All internal routes require a valid service token.
router.use(serviceAuth('RACHBASE_SERVICE_TOKEN'));

router.post('/deploy',      asyncHandler(ctrl.deploy));
router.post('/run-command', asyncHandler(ctrl.runCommand));

module.exports = router;
