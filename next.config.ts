import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import path from "node:path";

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
    webpack: (webpackConfig, { webpack }) => {
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        "pptxgenjs$": path.resolve(process.cwd(), "node_modules/pptxgenjs/dist/pptxgen.bundle.js"),
      };
      webpackConfig.module.rules.push({
        test: /pptxgen\.bundle\.js$/,
        use: [path.resolve(process.cwd(), "scripts/pptxgen-browser-loader.cjs")],
      });
      webpackConfig.plugins.push(new webpack.NormalModuleReplacementPlugin(/^node:(fs|https)$/, path.resolve(process.cwd(), "src/lib/browser-node-shim.ts")));
      return webpackConfig;
    },
  };
}
