# RachBase per-project BaaS gateway. Stateless; deployed via the SpaceArk App path, one per
# project, configured with PROJECT_REF + PROJECT_JWT_SECRET + primitive upstreams. Build context = repo root.
FROM node:18-alpine

WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/baas ./packages/baas
COPY apps/baas-gateway ./apps/baas-gateway

RUN npm install --omit=dev --workspace @rach/baas-gateway --workspace @rach/baas

WORKDIR /app/apps/baas-gateway
ENV NODE_ENV=production
EXPOSE 8080
USER node
ENTRYPOINT ["node", "index.js"]
