# RachBase BaaS Auth service. Behind the per-project gateway; user data in the project DB.
# Configured per project via env (PROJECT_REF, PROJECT_JWT_SECRET, DATABASE_URL). Context = repo root.
FROM node:18-alpine

WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/baas ./packages/baas
COPY apps/baas-auth ./apps/baas-auth

RUN npm install --omit=dev --workspace @rach/baas-auth --workspace @rach/baas

WORKDIR /app/apps/baas-auth
ENV NODE_ENV=production
EXPOSE 8080
USER node
ENTRYPOINT ["node", "index.js"]
