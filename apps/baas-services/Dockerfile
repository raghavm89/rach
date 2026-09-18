# RachBase combined BaaS services (Auth + Storage + Functions) in one container. Behind the
# per-project gateway; dispatched by the x-baas-primitive header. Build context = repo root.
FROM node:18-alpine

WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/baas ./packages/baas
COPY apps/baas-auth ./apps/baas-auth
COPY apps/baas-storage ./apps/baas-storage
COPY apps/baas-functions ./apps/baas-functions
COPY apps/baas-services ./apps/baas-services

RUN npm install --omit=dev \
  --workspace @rach/baas-services \
  --workspace @rach/baas-auth \
  --workspace @rach/baas-storage \
  --workspace @rach/baas-functions \
  --workspace @rach/baas

WORKDIR /app/apps/baas-services
ENV NODE_ENV=production
EXPOSE 8080
USER node
ENTRYPOINT ["node", "index.js"]
