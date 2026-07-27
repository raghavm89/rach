/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@rach/ui"],
  // Emit a self-contained server bundle for the Docker runtime stage.
  output: "standalone",
};

export default nextConfig;
