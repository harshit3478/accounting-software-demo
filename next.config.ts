import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Ignore TypeScript errors during build (use with caution)
    ignoreBuildErrors: true,
  },
  eslint: {
    // Ignore ESLint errors during build (use with caution)
    ignoreDuringBuilds: false,
  },
};

export default nextConfig;
