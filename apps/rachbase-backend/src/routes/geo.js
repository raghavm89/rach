'use strict';

/**
 * GET /api/geo/country — the caller's IP country (ISO alpha-2) or null. Public + no
 * side effects; used by the UI to hide India-only fields (e.g. GSTIN) for non-India
 * visitors. Billing address stays authoritative for tax; this is only a default.
 */

const express = require('express');
const { countryFromReq } = require('../lib/geo');

const router = express.Router();

router.get('/country', (req, res) => {
  res.json({ country: countryFromReq(req) });
});

module.exports = router;
