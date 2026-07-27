# Build from the REPO ROOT:  docker build -f apps/rachbase-web/Dockerfile -t rachbase-web .
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/rachbase-web ./apps/rachbase-web
RUN npm install
# NEXT_PUBLIC_* are inlined into the client bundle at BUILD time, so they must be
# present before `next build`. On Railway, set these as service Variables; they
# are passed in here as build args. Changing them later requires a redeploy.
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
RUN npm run build -w rachbase-web

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
# Bind to all interfaces so Railway's proxy can reach it; Railway injects PORT.
ENV HOSTNAME=0.0.0.0
# Next standalone output (requires output:'standalone' in next.config)
COPY --from=build /app/apps/rachbase-web/.next/standalone ./
COPY --from=build /app/apps/rachbase-web/.next/static ./apps/rachbase-web/.next/static
COPY --from=build /app/apps/rachbase-web/public ./apps/rachbase-web/public
EXPOSE 3002
CMD ["node", "apps/rachbase-web/server.js"]
