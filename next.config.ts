import type { NextConfig } from "next";

const BACKEND = process.env.NEXT_PUBLIC_API_BASE || "https://hiring-dev.internal.kloudspot.com";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
