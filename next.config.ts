// next.config.ts
import type { NextConfig } from "next";
// Optional: Import webpack types for stricter checking if desired
// import type { Configuration as WebpackConfig } from 'webpack';

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,

  webpack(
    config, // : WebpackConfig // Optional type annotation
    options // Contains { isServer, dev, buildId, config: resolvedNextConfig, ... }
  ) {
    // Initialize experiments if they don't exist
    config.experiments = config.experiments || {};
    // Add asyncWebAssembly, preserving other experiments if any were added by Next.js internally
    config.experiments.asyncWebAssembly = true;

    // Ensure the rule for WASM is set
    config.module ??= {}; // Ensure module exists using nullish coalescing
    config.module.rules ??= []; // Ensure rules exists
    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async", // Use the async type needed for the experiment
    });

    // IMPORTANT: Always return the modified config
    return config;
  },
  // --- End of added webpack function ---
};

export default nextConfig;