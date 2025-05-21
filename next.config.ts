// next.config.ts
import type { NextConfig } from 'next';
// --- Import from Serwist ---
import withSerwist from '@serwist/next';
// --- End Serwist Import ---

// Your base Next.js configuration (remains the same)
const nextConfig: NextConfig = {
  images: { unoptimized: true },
  trailingSlash: true,
  webpack(config, options) {
    // Your WASM config remains the same
    config.experiments = config.experiments || {};
    config.experiments.asyncWebAssembly = true;
    config.module ??= {};
    config.module.rules ??= [];
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });
    return config;
  },
};

// --- Serwist PWA Configuration ---
// Create the Serwist wrapper function
const withPWA = withSerwist({
  // Similar options to next-pwa
  swSrc: 'app/sw.ts', // Point to your custom service worker source file (TypeScript!)
  swDest: 'public/sw.js', // Output path for the compiled service worker
  cacheOnNavigation: true, // Example: Cache pages on navigation
  disable: process.env.NODE_ENV === 'development', // Disable in dev
  // Recommended: Use injectManifest strategy for more control
  // We'll likely need to create `app/sw.ts`
});

// Export the wrapped config
export default withPWA(nextConfig);
