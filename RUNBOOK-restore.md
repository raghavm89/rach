# RUNBOOK — Backup & Restore

*Last updated: 6 Sep 2026. Pairs with `apps/rachbase-backend/src/services/backupService.js` /
`backupWorker.js` / `backupStore.js`, migration `129_control_plane_backups.sql`, and
`apps/rachbase-backend/scripts/verify-backups.js`. Rehearse one full restore BEFORE launch —
a backup that has never been restored is a hope, not a backup.*

## What gets backed up, where

| Scope | What | Schedule | Retention | Storage key |
|---|---|---|---|---|
| BaaS project DBs | `pg_dump -Fc` of each `baas_<ref>` | daily (hourly worker tick, once/day/project) | Starter 7d · Pro/Max 30d | `<prefix>/project-<id>/<db>/<stamp>.dump` |
| Control-plane DB | `pg_dump -Fc` of the users/tenants/billing DB | daily | `BACKUP_CONTROL_RETENTION_DAYS` (default 30d) | `<prefix>/control-plane/<db>/<stamp>.dump` |

Both go to the S3-compatible store configured by `BACKUP_S3_ENDPOINT / _BUCKET / _REGION /
_ACCESS_KEY / _SECRET_KEY / _PREFIX`. **Not yet covered:** tenant-VM Postgres and SeaweedFS
object bytes — track as post-launch work.

Safety properties (do not "optimize" these away):

- **Newest-keep guard:** pruning never deletes a scope's newest completed backup, however
  expired. A silent dump-failure streak can therefore never age the last restorable copy out.
- **Failure alerting:** any failed backup in a worker tick emails `OPS_ALERT_EMAIL`
  (6h cooldown per alert key). If that env is unset, alerts are only logged — set it in prod.
- **Credentials:** dump/restore passwords travel via `PGPASSWORD`, never on the command line.
- **Restores never touch the live DB** — always into a NEW database (`baas_<ref>_restore_<stamp>`).

## Verify backups are healthy (run weekly, and before launch)

```bash
cd apps/rachbase-backend && node scripts/verify-backups.js
# Also: check the newest completed row per scope is < 26h old:
psql "$DATABASE_URL" -c "
  SELECT COALESCE(project_id::text,'control-plane') scope, max(completed_at) last_ok
    FROM baas_backups WHERE status='completed' GROUP BY 1 ORDER BY 2;"
```

## Restore a BaaS project database

1. Find the backup: `GET /api/projects/:id/backups` (admin/dashboard) or
   `SELECT id, object_key, completed_at FROM baas_backups WHERE project_id=$P ORDER BY id DESC;`
2. Restore into a NEW database via the API (`POST /api/projects/:id/backups/:backupId/restore`)
   — or manually:
   ```bash
   # download (or use the presigned-URL endpoint), then:
   createdb -h <baas-host> -U <admin> baas_<ref>_restore_manual
   PGPASSWORD=<admin-pw> pg_restore --no-owner --no-privileges \
     --dbname postgresql://<admin>@<baas-host>:5432/baas_<ref>_restore_manual backup.dump
   ```
3. Sanity-check the restored DB (row counts on the customer's main tables).
4. Cut over: repoint the project at the restored DB **only after** the customer confirms, by
   renaming databases inside a maintenance window (`ALTER DATABASE ... RENAME`), never by
   editing the live one in place. Keep the damaged original under a `_broken_<date>` name.

## Restore the control-plane database

Practice this one on a scratch Postgres BEFORE you need it.

1. Get the newest dump key:
   `SELECT object_key FROM baas_backups WHERE project_id IS NULL AND status='completed' ORDER BY id DESC LIMIT 1;`
   (If the DB itself is gone, list the bucket under `<prefix>/control-plane/` — keys are
   timestamped.)
2. Provision a fresh Postgres (new Railway PG, or local). Restore:
   ```bash
   PGPASSWORD=<pw> pg_restore --no-owner --no-privileges --dbname <NEW_DATABASE_URL> cp.dump
   ```
3. Point the backend at it (`DATABASE_URL`), boot, and verify: login works, tenants and
   subscriptions are present, `/api/status` serves.
4. Expect to lose whatever happened after the dump (≤24h): reconcile Razorpay (webhook
   replays from the dashboard), and let the site inventory sweep re-sync workload state.

## When the "backup failure(s)" ops email arrives

1. Read the scopes listed. `control-plane database` failing is a P0 — fix same day.
2. Common causes: rotated `BACKUP_S3_*` credentials (every scope fails), missing
   `postgresql-client` binaries in the image (`pg_dump: not found`), cluster password rotated
   (`password authentication failed`), disk full in `$TMPDIR`.
3. The worker retries hourly; the email repeats at most every 6h while failures continue.
   The newest-keep guard protects the last good copy, but it is AGING — resolve, then confirm
   a fresh `completed` row for each scope.
