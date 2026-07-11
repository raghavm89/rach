# Build from the REPO ROOT:  docker build -f apps/rachdev-web/Dockerfile -t rachdev-web .
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/rachdev-web ./apps/rachdev-web
RUN npm install
RUN npm run build -w rachdev-web

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
# Next standalone output (requires output:'standalone' in next.config)
COPY --from=build /app/apps/rachdev-web/.next/standalone ./
COPY --from=build /app/apps/rachdev-web/.next/static ./apps/rachdev-web/.next/static
COPY --from=build /app/apps/rachdev-web/public ./apps/rachdev-web/public
EXPOSE 3001
CMD ["node", "apps/rachdev-web/server.js"]
