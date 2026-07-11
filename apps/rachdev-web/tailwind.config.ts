import type { Config } from "tailwindcss";
import rachPreset from "@rach/ui/tailwind-preset";

const config: Config = {
  presets: [rachPreset],
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    // include the shared design system so its classes aren't purged
    "../../packages/ui/src/**/*.{js,ts,jsx,tsx}",
    "../../packages/ui/index.ts",
  ],
};

export default config;
