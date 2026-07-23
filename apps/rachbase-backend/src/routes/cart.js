'use strict';

/**
 * Cart routes — the current user's persistent billing cart.
 * All endpoints require authentication; the cart is always scoped to req.user.id.
 */

const { Router } = require('express');
const authenticate = require('@rach/identity').authenticate;
const asyncHandler = require('@rach/core').asyncHandler;
const { getCart, putCart, clearCart } = require('../controllers/cartController');

const router = Router();

router.use(authenticate);

router.get('/',    asyncHandler(getCart));
router.put('/',    asyncHandler(putCart));
router.delete('/', asyncHandler(clearCart));

module.exports = router;
