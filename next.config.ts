import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "200gb",
    },
  },
  typescript: {
  ignoreBuildErrors: true,
  },
};

export default nextConfig;
