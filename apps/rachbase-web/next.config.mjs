import { createRequire } from "module";
import path from "path";

const require = createRequire(import.meta.url);

// Force a single copy of React / React-DOM. In this monorepo, npm can hoist a
// different React to the repo-root node_modules than the one nested under this
// app, which breaks prerendering with "Cannot read properties of null (reading
// 'useContext')" in styled-jsx. Resolving both from the same base guarantees a
// matched pair.
const reactPath = path.dirname(require.resolve("react/package.json"));
const reactDomPath = path.dirname(require.resolve("react-dom/package.json"));

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@rach/ui"],
  // Emit a self-contained server bundle for the Docker runtime stage.
  output: "standalone",
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      react: reactPath,
      "react-dom": reactDomPath,
    };
    return config;
  },
};

export default nextConfig;
