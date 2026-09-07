'use strict';

/**
 * Migrate a Supabase project into a RachBase BaaS project (schema + data + auth users).
 *
 *   node apps/rachbase-backend/scripts/migrate-from-supabase.js \
 *     --from 'postgresql://postgres:<pw>@db.<proj>.supabase.co:5432/postgres' \
 *     --ref  p0123456789abcdef            # the RachBase project ref (baas_<ref>)
 *     [--no-data] [--no-users]
 *
 * Needs postgresql-client (pg_dump/pg_restore) on PATH and BAAS_PG_ADMIN_URL set (the managed
 * cluster). RLS policies that reference Supabase's auth.* won't apply — they're reported as
 * warnings; re-create them against RachBase roles (anon_<ref>/authenticated_<ref>/service_<ref>).
 * Users keep their passwords: Supabase bcrypt hashes are imported and baas-auth verifies them.
 */

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { spawnSync } = require('child_process');
const migrate = require('../src/services/supabaseMigrate');

function arg(name, argv) { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; }

(async () => {
  const argv = process.argv.slice(2);
  const sourceUrl = arg('--from', argv);
  const ref = arg('--ref', argv);
  const data = !argv.includes('--no-data');
  const users = !argv.includes('--no-users');

  if (!sourceUrl || !ref) {
    console.error('Usage: --from <supabase-db-url> --ref <project-ref> [--no-data] [--no-users]');
    process.exit(2);
  }
  if (!/^p[0-9a-f]{16}$/.test(ref)) { console.error(`Invalid --ref "${ref}" (expected p + 16 hex).`); process.exit(2); }
  if (!process.env.BAAS_PG_ADMIN_URL) { console.error('BAAS_PG_ADMIN_URL not set.'); process.exit(2); }
  for (const bin of ['pg_dump', 'pg_restore']) {
    if (spawnSync(bin, ['--version']).status !== 0) { console.error(`${bin} not found on PATH — install postgresql-client.`); process.exit(2); }
  }

  console.log(`Migrating Supabase → RachBase project ${ref} (data=${data}, users=${users})…`);
  try {
    const r = await migrate.migrate({ sourceUrl, ref, data, users });
    if (r.schema) {
      console.log(`  schema+data: restored${r.schema.warnings.length ? ` (${r.schema.warnings.length} warning(s))` : ''}`);
      for (const w of r.schema.warnings.slice(0, 10)) console.log(`    ⚠ ${w}`);
      if (r.schema.warnings.length) console.log('    ↳ RLS/roles that reference Supabase auth.* need re-creating against RachBase roles.');
    }
    if (r.users) console.log(`  users: imported ${r.users.imported} / ${r.users.total} (skipped ${r.users.skipped} — dupes/no-email). Passwords carry over.`);
    console.log('Done.');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exit(1);
  }
})();
