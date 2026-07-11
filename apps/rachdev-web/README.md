# rachdev-web

RachDev — AI Agent Builder web app. Design, run, and deploy autonomous agents.

Consumes `@rach/ui` (shared design system) and talks to `rachdev-backend`.
Runs on managed infrastructure by RachBase.

## Dev
```bash
npm install
npm run dev -w rachdev-web   # http://localhost:3001
```
Set `NEXT_PUBLIC_API_URL` to the RachDev backend (see .env.example).
