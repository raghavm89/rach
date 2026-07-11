# Build from the REPO ROOT:  docker build -f apps/rachdev-backend/Dockerfile -t rachdev-backend .
FROM node:20-alpine
WORKDIR /app

# Workspace manifests + shared packages (resolve @rach/* via workspaces)
COPY package.json ./
COPY packages ./packages
COPY apps/rachdev-backend ./apps/rachdev-backend

RUN npm install --omit=dev

EXPOSE 8081
CMD ["node", "apps/rachdev-backend/src/server.js"]
