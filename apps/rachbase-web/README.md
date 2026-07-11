# rachbase-web

RachBase — Cloud Management / BaaS web app (dashboard + marketing).
Provision VMs & containers, deploy from GitHub, monitor, manage tenants & billing.

Consumes `@rach/ui` (shared design system) and talks to `rachbase-backend`.

## Dev
```bash
npm install
npm run dev -w rachbase-web   # http://localhost:3002
```
Set `NEXT_PUBLIC_API_URL` to the RachBase backend (see .env.example).
