/** @type {import('next').NextConfig} */
const nextConfig = {
  // Compile the shared design system from source (monorepo package).
  transpilePackages: ["@rach/ui"],
  // Emit a self-contained server bundle for the Docker runtime stage.
  output: "standalone",
};

export default nextConfig;
