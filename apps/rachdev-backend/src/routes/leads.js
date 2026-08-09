'use strict';

const { Router } = require('express');
const { asyncHandler, rateLimit } = require('@rach/core');
const ctrl = require('../controllers/contactController');

const { leadsLimiter } = rateLimit;

// Public — no auth (prospects submit before an org/account exists), so the
// endpoint is rate-limited per IP to bound spam/abuse.
const router = Router();
router.post('/', leadsLimiter, asyncHandler(ctrl.createLead));

module.exports = router;
