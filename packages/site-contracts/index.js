'use strict';

/**
 * @rach/site-contracts — the shared SpaceArk site-API contract layer.
 * Imported by the BFF (to build requests) and the site-controller (to verify them),
 * so both compute the identical canonical request hash.
 */

module.exports = {
  ...require('./src/hash'),
  ...require('./src/ids'),
  ...require('./src/dto'),
};
