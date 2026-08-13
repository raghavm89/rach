'use strict';

/**
 * Deployment recipes for the RachDev runtime agent (on-prem / BYOC).
 *
 * The SAME container image runs everywhere; only the launch recipe differs by
 * placement. Every recipe wires three things into the agent:
 *   RACHDEV_CONTROL_URL   — where to pull the spec + push telemetry (our cloud)
 *   RACHDEV_RUNTIME_TOKEN — the per-deployment token (shown once)
 *   LLM_API_KEY           — the CUSTOMER'S own model key (data stays on their side)
 *
 * Recipes never contain conversation data — they are launch config only.
 */

const IMAGE = () => process.env.RUNTIME_AGENT_IMAGE || 'ghcr.io/rachdev/runtime-agent:latest';

const PLACEMENTS = ['onprem', 'aws', 'gcp', 'azure', 'k8s'];

function dockerRun(image, controlUrl) {
  return [
    `docker run -d --name rachdev-agent -p 8080:8080 \\`,
    `  -e RACHDEV_CONTROL_URL="${controlUrl}" \\`,
    `  -e RACHDEV_RUNTIME_TOKEN="$RACHDEV_RUNTIME_TOKEN" \\`,
    `  -e LLM_PROVIDER="anthropic" \\`,
    `  -e LLM_API_KEY="$LLM_API_KEY" \\`,
    `  ${image}`,
  ].join('\n');
}

function compose(image, controlUrl) {
  return `services:
  rachdev-agent:
    image: ${image}
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      RACHDEV_CONTROL_URL: "${controlUrl}"
      RACHDEV_RUNTIME_TOKEN: "\${RACHDEV_RUNTIME_TOKEN}"
      LLM_PROVIDER: "anthropic"
      LLM_API_KEY: "\${LLM_API_KEY}"
`;
}

function k8s(image, controlUrl) {
  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: rachdev-agent
spec:
  replicas: 1
  selector: { matchLabels: { app: rachdev-agent } }
  template:
    metadata: { labels: { app: rachdev-agent } }
    spec:
      containers:
        - name: rachdev-agent
          image: ${image}
          ports: [{ containerPort: 8080 }]
          env:
            - name: RACHDEV_CONTROL_URL
              value: "${controlUrl}"
            - name: RACHDEV_RUNTIME_TOKEN
              valueFrom: { secretKeyRef: { name: rachdev-agent, key: runtime-token } }
            - name: LLM_PROVIDER
              value: "anthropic"
            - name: LLM_API_KEY
              valueFrom: { secretKeyRef: { name: rachdev-agent, key: llm-api-key } }
---
apiVersion: v1
kind: Service
metadata: { name: rachdev-agent }
spec:
  selector: { app: rachdev-agent }
  ports: [{ port: 80, targetPort: 8080 }]
`;
}

function ecs(image, controlUrl) {
  return JSON.stringify({
    family: 'rachdev-agent',
    networkMode: 'awsvpc',
    requiresCompatibilities: ['FARGATE'],
    cpu: '256', memory: '512',
    containerDefinitions: [{
      name: 'rachdev-agent',
      image,
      portMappings: [{ containerPort: 8080 }],
      environment: [
        { name: 'RACHDEV_CONTROL_URL', value: controlUrl },
        { name: 'LLM_PROVIDER', value: 'anthropic' },
      ],
      secrets: [
        { name: 'RACHDEV_RUNTIME_TOKEN', valueFrom: 'arn:aws:secretsmanager:REGION:ACCOUNT:secret:rachdev-runtime-token' },
        { name: 'LLM_API_KEY', valueFrom: 'arn:aws:secretsmanager:REGION:ACCOUNT:secret:rachdev-llm-api-key' },
      ],
    }],
  }, null, 2);
}

function cloudRun(image, controlUrl) {
  return [
    `gcloud run deploy rachdev-agent \\`,
    `  --image="${image}" \\`,
    `  --port=8080 --allow-unauthenticated \\`,
    `  --set-env-vars=RACHDEV_CONTROL_URL="${controlUrl}",LLM_PROVIDER="anthropic" \\`,
    `  --set-secrets=RACHDEV_RUNTIME_TOKEN=rachdev-runtime-token:latest,LLM_API_KEY=rachdev-llm-api-key:latest`,
  ].join('\n');
}

function aci(image, controlUrl) {
  return [
    `az container create --name rachdev-agent --resource-group MY_RG \\`,
    `  --image "${image}" --ports 8080 \\`,
    `  --environment-variables RACHDEV_CONTROL_URL="${controlUrl}" LLM_PROVIDER="anthropic" \\`,
    `  --secure-environment-variables RACHDEV_RUNTIME_TOKEN="$RACHDEV_RUNTIME_TOKEN" LLM_API_KEY="$LLM_API_KEY"`,
  ].join('\n');
}

/**
 * Build the recipe for a placement. Returns { placement, label, files:[{name,language,content}], notes }.
 * `onprem` returns docker-compose + a plain `docker run`; the cloud placements
 * return their native manifest/command. BYOC (aws/gcp/azure/k8s) all reuse the
 * same image + contract — only the launcher changes.
 */
function recipeFor(placement, { controlUrl } = {}) {
  const image = IMAGE();
  const url = controlUrl || 'https://api.rachdev.com';
  const p = PLACEMENTS.includes(placement) ? placement : 'onprem';
  const files = {
    onprem: [
      { name: 'docker run', language: 'bash', content: dockerRun(image, url) },
      { name: 'docker-compose.yml', language: 'yaml', content: compose(image, url) },
    ],
    aws: [{ name: 'ecs-task-definition.json', language: 'json', content: ecs(image, url) }],
    gcp: [{ name: 'deploy (Cloud Run)', language: 'bash', content: cloudRun(image, url) }],
    azure: [{ name: 'deploy (Container Instances)', language: 'bash', content: aci(image, url) }],
    k8s: [{ name: 'deployment.yaml', language: 'yaml', content: k8s(image, url) }],
  }[p];
  const label = { onprem: 'On-prem (Docker)', aws: 'AWS (ECS/Fargate)', gcp: 'Google Cloud Run', azure: 'Azure Container Instances', k8s: 'Kubernetes' }[p];
  return {
    placement: p,
    label,
    image,
    control_url: url,
    files,
    notes: 'Set RACHDEV_RUNTIME_TOKEN (shown once above) and LLM_API_KEY (your own model key). Conversation data stays on your infrastructure; only health/usage metadata is reported back.',
  };
}

module.exports = { recipeFor, PLACEMENTS, IMAGE };
