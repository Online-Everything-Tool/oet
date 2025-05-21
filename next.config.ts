// next.config.ts
import type { NextConfig } from 'next';
import withSerwist from '@serwist/next';

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  serverExternalPackages: ['bitcoinjs-lib', 'ethers'],

  webpack(config, options) {
    config.experiments = config.experiments || {};
    config.experiments.asyncWebAssembly = true; // Crucial for client-side WASM
    config.module ??= {};
    config.module.rules ??= [];
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async', // Crucial for client-side WASM
    });
    return config;
  },
};

const withPWA = withSerwist({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  disable: process.env.NODE_ENV === 'development',
});

export default withPWA(nextConfig);
