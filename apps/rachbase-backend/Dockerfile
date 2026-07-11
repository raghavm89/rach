# Build from the REPO ROOT:  docker build -f apps/rachbase-backend/Dockerfile -t rachbase-backend .
FROM node:20-alpine
WORKDIR /app

# Workspace manifests + shared packages (resolve @rach/* via workspaces)
COPY package.json ./
COPY packages ./packages
COPY apps/rachbase-backend ./apps/rachbase-backend

RUN npm install --omit=dev

EXPOSE 8080
CMD ["node", "apps/rachbase-backend/src/server.js"]
