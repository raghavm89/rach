'use strict';

const { Router } = require('express');
const { authenticate } = require('@rach/identity');
const { asyncHandler, parseId } = require('@rach/core');
const ctrl = require('../controllers/supportController');

const router = Router();
router.use(authenticate);

router.post ('/tickets',              asyncHandler(ctrl.createTicket));
router.get  ('/tickets',              asyncHandler(ctrl.listTickets));
router.get  ('/tickets/:id',          parseId(), asyncHandler(ctrl.getTicket));
router.post ('/tickets/:id/messages', parseId(), asyncHandler(ctrl.addMessage));
router.patch('/tickets/:id',          parseId(), asyncHandler(ctrl.updateTicket));

module.exports = router;
