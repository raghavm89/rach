'use strict';

/**
 * VM keypair routes (admin only). Listing + activation of per-VM SSH keys.
 */

const { Router } = require('express');
const authenticate = require('@rach/identity').authenticate;
const authorize    = require('@rach/identity').authorize;
const asyncHandler = require('@rach/core').asyncHandler;
const { listKeys, activateKey, reissueKey } = require('../controllers/vmKeyController');

const router = Router();

router.use(authenticate, authorize('admin'));

router.get('/',              asyncHandler(listKeys));
router.post('/reissue',      asyncHandler(reissueKey));
router.post('/:id/activate', asyncHandler(activateKey));

module.exports = router;
