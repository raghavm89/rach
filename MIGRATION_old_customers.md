# RachBase — Migrate old customers + data into the new Railway Postgres

**Situation:** old Postgres and new Railway Postgres share the same `@rach/core`
schema, and you want a full copy (accounts + tenants + subscriptions + VMs +
orders + billing). The cleanest, lowest-risk method is a **full clone**: dump the
old DB and restore it into the new one as a blank target — no row-by-row import,
no foreign-key ordering, and customers keep their passwords (the bcrypt
`password_hash` copies over verbatim).

> Do this migration **before** creating the admin — the clone overwrites the new
> DB, so any admin you already made there will be wiped. Recreate it in Step 5.

---

## Prerequisites

- `pg_dump`, `pg_restore`, `psql` — **version 16** (match the server:
  `psql --version`). Older client tools against a v16 server can fail.
- **OLD_URL** — the old database connection string
  (`postgresql://user:pass@host:port/dbname`).
- **NEW_URL** — the new Railway Postgres **public** URL: Railway → the Postgres
  service → **Connect → Public Network** connection string. The internal
  `*.railway.internal` host will NOT work from your laptop.
- Both databases reachable from the machine you run this on.

```bash
export OLD_URL="postgresql://…old…"
export NEW_URL="postgresql://…new-railway-public…"
```

## Step 0 — Safety checks (do not skip)

**a) Confirm the schemas are at the same migration version.** A full clone also
copies the schema, so if the *new* backend has migrations the *old* DB doesn't,
cloning would downgrade it. Compare:

```bash
psql "$OLD_URL" -c "SELECT filename FROM schema_migrations ORDER BY filename;" > old_migs.txt
psql "$NEW_URL" -c "SELECT filename FROM schema_migrations ORDER BY filename;" > new_migs.txt
diff old_migs.txt new_migs.txt
```

- **No differences** → safe to full-clone (continue).
- **New has extra migrations** → do NOT full-clone; use the **data-only** path in
  the Appendix instead.

**b) Back up the (near-empty) new DB** so you can roll back:

```bash
pg_dump "$NEW_URL" -Fc --no-owner --no-privileges -f new_backup_before.dump
```

## Step 1 — Dump the old database (read-only, safe)

```bash
pg_dump "$OLD_URL" -Fc --no-owner --no-privileges -f old.dump
```

`pg_dump` takes a consistent snapshot without locking the old app.

## Step 2 — Blank the new database

The new DB currently holds only the schema (+ maybe your admin). Reset it to a
clean target for the clone:

```bash
psql "$NEW_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

## Step 3 — Restore the old data into the new database

```bash
pg_restore --no-owner --no-privileges -d "$NEW_URL" old.dump
```

Benign notices are fine. `pg_dump`/`pg_restore` also restore the sequence values,
so new signups won't collide with imported IDs.

## Step 4 — Verify

```bash
psql "$NEW_URL" -c "SELECT count(*) FROM users;"
psql "$NEW_URL" -c "SELECT count(*) FROM tenants;"
psql "$NEW_URL" -c "SELECT count(*) FROM subscriptions;"
psql "$NEW_URL" -c "SELECT id, email, role FROM users ORDER BY id LIMIT 10;"
```

Spot-check a known customer email is present.

## Step 5 — Admin + app

- If the old data doesn't already include the admin you want, create it now
  (see `create-admin` — Task 1). Do this **after** the clone.
- Restart the `rachbase-backend` service so it reconnects cleanly.
- **Test:** log in at rachbase.com as an existing customer — their old password
  works because `password_hash` was copied verbatim.

## Rollback

If something looks wrong, restore the pre-migration snapshot:

```bash
psql "$NEW_URL" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
pg_restore --no-owner --no-privileges -d "$NEW_URL" new_backup_before.dump
```

---

## Appendix — data-only import (only if schemas differ)

Use this **instead of Steps 1–3** if Step 0a showed the new DB has newer
migrations and you must keep its schema. It imports just the data and lets new
columns default — but it's more fragile (FK order, and the admin row you created
may collide on `id`).

```bash
pg_dump "$OLD_URL" --data-only --no-owner --disable-triggers \
  --exclude-table=schema_migrations -Fc -f old_data.dump
# then, with the new schema already in place:
pg_restore --no-owner --no-privileges --disable-triggers \
  --data-only -d "$NEW_URL" old_data.dump
```

If you hit `duplicate key` on `users` (from the admin you created), either create
the admin *after* this import, or delete that one admin row first. If you go this
route, tell me and I'll generate an exact, dependency-ordered import that
handles the conflicts cleanly.
