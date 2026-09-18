# Database topology — RachDev & RachBase

**Decision: separate databases.** RachDev and RachBase run on independent Postgres databases; they share *code* (the `@rach/*` packages) but not *data*.

| Service | Database (local `.env`) | Owns |
|---|---|---|
| rachbase-backend | `rach_base_db` | RachBase users, tenants, VMs, billing, infra |
| rachdev-backend | `rach_dev_db` | RachDev users, tenants (orgs), agents, clinical data (scribe, etc.) |

Both currently sit on the same server (`localhost:5432`), just different database names. (The repo's `.env.example` / `docker-compose.yml` default to a single shared `rach_db` — that default is **not** what we use; each service points at its own DB.)

## Consequences

- **Identity is per-service.** A user/tenant created in RachBase does **not** exist in RachDev, and vice-versa. To use RachDev, sign up through RachDev (its own `/login?tab=signup`), which creates the user in `rach_dev_db`.
- **Admin views are RachDev's own.** The RachDev Admin dashboard's Organizations/Users show `rach_dev_db` data — not RachBase's.
- **Cross-service needs go over HTTP.** RachDev asks RachBase for infra/deploy via `rachbaseClient` (service token), never by reaching into RachBase's DB.

## Migrations — run the shared set against EACH database

There is one migration set (`packages/core/src/db/migrations`). Each app has a `migrate` script that runs it against that app's own `.env` (npm sets cwd to the app dir, so `migrate.js`'s `dotenv.config()` loads the right `.env`):

```bash
# RachDev DB (rach_dev_db) — applies the healthcare migrations 043–046, etc.
npm run migrate -w apps/rachdev-backend

# RachBase DB (rach_base_db) — only if a `migrate` script is added there too
npm run migrate -w apps/rachbase-backend
```

Equivalent explicit form (no script needed):
```bash
node -r dotenv/config packages/core/src/db/migrate.js dotenv_config_path=apps/rachdev-backend/.env
```

Each database has its own `schema_migrations` ledger, so each tracks what it has applied independently. A new migration must be run against both DBs if both should have it.
