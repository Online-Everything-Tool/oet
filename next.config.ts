// next.config.ts
import type { NextConfig } from 'next';
import withSerwist from '@serwist/next';

const nextConfig: NextConfig = {
  images: { unoptimized: true },
  serverExternalPackages: [
    'tiny-secp256k1',
    'ecpair',
    'bitcoinjs-lib',
    'ethers', 
    '@solana/web3.js',
  ],  
  webpack(config, options) {
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

const withPWA = withSerwist({
  swSrc: 'app/sw.ts',
  swDest: 'public/sw.js',
  cacheOnNavigation: true,
  disable: process.env.NODE_ENV === 'development',
});

export default withPWA(nextConfig);