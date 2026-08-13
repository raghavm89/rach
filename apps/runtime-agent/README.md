# RachDev Runtime Agent (on-prem / BYOC)

Run your RachDev agent **inside your own network or cloud**. The agent pulls its
configuration (the AgentSpec) from the RachDev control plane, runs against **your
own LLM key**, and reports only health/usage **metadata** back — conversation
content never leaves your infrastructure.

## How it works

```
 your network / cloud                         RachDev control plane (SaaS)
 ┌───────────────────────┐   pull spec  ───▶  GET  /api/runtime/v1/spec
 │   runtime agent        │   telemetry  ───▶  POST /api/runtime/v1/telemetry
 │   (this container)     │   (outbound only — never inbound)
 │   ▲ local /chat        │
 │   └ your app / channel │
 └───────────────────────┘
```

Only outbound HTTPS is required. The control plane never connects to you.

## Configure

| Env | Required | Default | Notes |
|---|---|---|---|
| `RACHDEV_CONTROL_URL` | yes | — | e.g. `https://api.rachdev.com` |
| `RACHDEV_RUNTIME_TOKEN` | yes | — | `rt_…`, shown once when you deploy self-hosted |
| `LLM_API_KEY` | yes | — | **your own** Anthropic/OpenAI key |
| `LLM_PROVIDER` | no | `anthropic` | `anthropic` or `openai` |
| `LLM_MODEL` | no | spec/default | override the model |
| `PORT` | no | `8080` | local HTTP port |

## Run

```bash
docker run -d --name rachdev-agent -p 8080:8080 \
  -e RACHDEV_CONTROL_URL="https://api.rachdev.com" \
  -e RACHDEV_RUNTIME_TOKEN="rt_xxx" \
  -e LLM_PROVIDER="anthropic" \
  -e LLM_API_KEY="sk-ant-xxx" \
  ghcr.io/rachdev/runtime-agent:latest
```

Deployment recipes for Docker Compose, Kubernetes, AWS ECS, Google Cloud Run, and
Azure Container Instances are generated for you in the dashboard when you deploy
self-hosted (Ship it → Self-hosted → pick your placement).

## Local endpoints (stay on your network)

- `GET /healthz` — liveness + whether the spec has loaded.
- `POST /chat` — `{ "message": "..." }` or `{ "messages": [...] }` → `{ "reply": "..." }`.
- `POST /v1/chat/completions` — OpenAI-shaped, for drop-in clients.

Point your own channel/webhook at these.
