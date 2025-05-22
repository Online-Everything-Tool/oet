// oet/next.config.ts
import type { NextConfig } from 'next';
import withSerwistInit from '@serwist/next';
const outputMode =
  process.env.NEXT_OUTPUT_MODE === 'export' ? 'export' : undefined;
const serverExternalPackagesForConfig =
  outputMode === 'export' ? undefined : ['bitcoinjs-lib', 'ethers'];

const nextConfig: NextConfig = {
  output: outputMode,

  images: { unoptimized: true },
  serverExternalPackages: serverExternalPackagesForConfig,

  webpack(config, { isServer, dev, nextRuntime }) {
    config.experiments = config.experiments || {};
    config.experiments.asyncWebAssembly = true;
    config.module = config.module || {};
    config.module.rules = config.module.rules || [];
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'webassembly/async',
    });
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
