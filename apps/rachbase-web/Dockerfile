# Build from the REPO ROOT:  docker build -f apps/rachbase-web/Dockerfile -t rachbase-web .
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/rachbase-web ./apps/rachbase-web
RUN npm install
RUN npm run build -w rachbase-web

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
# Next standalone output (requires output:'standalone' in next.config)
COPY --from=build /app/apps/rachbase-web/.next/standalone ./
COPY --from=build /app/apps/rachbase-web/.next/static ./apps/rachbase-web/.next/static
COPY --from=build /app/apps/rachbase-web/public ./apps/rachbase-web/public
EXPOSE 3002
CMD ["node", "apps/rachbase-web/server.js"]
