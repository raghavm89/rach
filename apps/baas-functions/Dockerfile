# RachBase BaaS Functions control plane. Code + secrets in the project DB; execution dispatched
# to the Deno runner (DENO_RUNNER_URL). Configured per project via env (PROJECT_REF,
# PROJECT_JWT_SECRET, DATABASE_URL, DENO_RUNNER_URL). Context = repo root.
FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/baas-functions ./apps/baas-functions
RUN npm install --omit=dev --workspace @rach/baas-functions
WORKDIR /app/apps/baas-functions
ENV NODE_ENV=production
EXPOSE 8080
USER node
ENTRYPOINT ["node", "index.js"]
