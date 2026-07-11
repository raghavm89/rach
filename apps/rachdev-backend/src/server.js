'use strict';

require('dotenv').config();
const { validateEnv } = require('@rach/core');

// Fail fast on missing/placeholder env before booting.
validateEnv();

const app = require('./app');

const PORT = process.env.PORT || 8081;
app.listen(PORT, () => {
  console.log(`rachdev-backend listening on :${PORT}`);
});
