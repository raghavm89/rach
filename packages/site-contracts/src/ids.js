'use strict';

/**
 * Identifier generation — the BFF generates ALL identifiers (contract §4.2).
 * Time-prefixed + random so ids are roughly sortable and collision-resistant.
 */

const crypto = require('crypto');

const stamp = () => Date.now().toString(36).toUpperCase();

const newId = (prefix) => `${prefix}-${stamp()}${crypto.randomBytes(8).toString('hex')}`;

const newOperationId = () => newId('op');
const newRequestId = () => newId('req');
// Idempotency-Key: opaque, high-entropy, uppercase (ULID-shaped enough for our use).
const newIdempotencyKey = () => `${stamp()}${crypto.randomBytes(12).toString('hex').toUpperCase()}`;

module.exports = { newId, newOperationId, newRequestId, newIdempotencyKey };
