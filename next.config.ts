import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  return {
    // Keep the live preview isolated from production builds and their manifests.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
    serverExternalPackages: ["mssql", "@e965/xlsx"],
    experimental: {
      serverActions: {
        bodySizeLimit: "25mb",
      },
    },
  };
}
