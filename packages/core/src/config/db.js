const { Pool } = require('pg');

function intEnv(name, fallback) {
  const v = process.env[name];
  if (v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 ? n : fallback;
}

// Connection: `DATABASE_URL` (Railway/Heroku-style, preferred when set) or discrete
// `DB_*` vars. validateEnv() has accepted DATABASE_URL since day one, but this pool
// used to read only DB_* — so a URL-configured deploy booted green (`/health` doesn't
// touch the DB) and then 500'd every real request against localhost:5432 (go-live
// audit F5). Set DB_SSL=true for managed Postgres that requires TLS without a
// verifiable CA (e.g. Railway public endpoints); leave it unset on private networking.
const connection = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    }
  : {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
    };

const pool = new Pool({
  ...connection,
  max:                     intEnv('PG_POOL_MAX', 10),
  idleTimeoutMillis:       intEnv('PG_POOL_IDLE_TIMEOUT_MS', 30_000),
  connectionTimeoutMillis: intEnv('PG_CONNECTION_TIMEOUT_MS', 5_000),
});

// Don't crash the process on a stale-connection error from the pool.
pool.on('error', (err) => {
  console.error('Postgres pool error:', err);
});

module.exports = pool;
