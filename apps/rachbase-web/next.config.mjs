/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@rach/ui"],
  // NOTE: `output: "standalone"` was removed because this service deploys via
  // Nixpacks + `next start`, which does not serve a standalone build. If you
  // switch back to the Docker image (apps/rachbase-web/Dockerfile), re-add
  // `output: "standalone"` and start with `node apps/rachbase-web/server.js`.
};

export default nextConfig;
