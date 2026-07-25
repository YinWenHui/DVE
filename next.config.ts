import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["mssql", "@e965/xlsx"],
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;
