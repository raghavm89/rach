# RachBase site-controller image. One image; SITE_CONTROLLER_PROFILE selects the
# component at startup (api|tenant|workload|build). Build context = repo root.
FROM node:18-alpine

WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/site-contracts ./packages/site-contracts
COPY apps/site-controller ./apps/site-controller

# Install only this workspace + its deps.
RUN npm install --omit=dev --workspace @rach/site-controller --workspace @rach/site-contracts

WORKDIR /app/apps/site-controller
ENV NODE_ENV=production
USER node
ENTRYPOINT ["node", "index.js", "run"]
