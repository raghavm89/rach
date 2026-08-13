# RachDev Runtime Agent — dependency-free, runs on the customer's infrastructure.
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
COPY index.js ./
EXPOSE 8080
# Runs as non-root; no build step (zero dependencies).
USER node
CMD ["node", "index.js"]
