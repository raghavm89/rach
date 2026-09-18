# RachBase BaaS Storage service. Policy + signed URLs over SeaweedFS; bucket metadata in the
# project DB. Configured per project via env (PROJECT_REF, PROJECT_JWT_SECRET, DATABASE_URL,
# SEAWEEDFS_FILER_URL). Context = repo root.
FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/baas-storage ./apps/baas-storage
RUN npm install --omit=dev --workspace @rach/baas-storage
WORKDIR /app/apps/baas-storage
ENV NODE_ENV=production
EXPOSE 8080
USER node
ENTRYPOINT ["node", "index.js"]
