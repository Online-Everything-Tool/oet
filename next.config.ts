// oet/next.config.ts
import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next'; // Assuming this is the correct import name

// Determine output mode based on environment variable
const outputMode =
  process.env.NEXT_OUTPUT_MODE === 'export' ? 'export' : undefined;
// If outputMode is 'export', disable serverExternalPackages if it causes issues with export
const serverExternalPackagesForConfig =
  outputMode === 'export' ? undefined : ['bitcoinjs-lib', 'ethers'];

const nextConfig: NextConfig = {
  // If outputMode is 'export', set it. Otherwise, it will be undefined (default Next.js behavior).
  output: outputMode,

  images: { unoptimized: true },
  // Only include serverExternalPackages if not doing a static export,
  // as they are irrelevant and can sometimes cause issues with `next export`.
  serverExternalPackages: serverExternalPackagesForConfig,

  webpack(config, { isServer, dev, nextRuntime }) {
    // Added dev and nextRuntime for clarity
    // Ensure experiments object exists
    config.experiments = config.experiments || {};

    // Enable WebAssembly, crucial for some client-side libraries
    // For Next.js 13.1+ with App Router, `asyncWebAssembly` is often needed.
    // For older versions or Pages Router, `layers` might be needed for server-side WASM.
    // Client-side WASM primarily needs the rule below and `asyncWebAssembly: true`.
    config.experiments.asyncWebAssembly = true;

    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });

    // If you had specific server-side WASM loader configurations for 'edge' or 'node' runtimes,
    // they would go here, potentially guarded by `if (isServer && nextRuntime === 'nodejs')` etc.
    // But for client-side WASM, the above `asyncWebAssembly` and rule are key.

    return config;
  },
};

const withSerwist = withSerwistInit({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  disable: process.env.NODE_ENV === 'development',
});

export default withSerwist(nextConfig);
