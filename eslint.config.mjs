import { defineConfig } from 'eslint/config';
import nextConfig from 'eslint-config-next';

export default defineConfig([
  ...nextConfig,
  {
    // Custom rules or ignores
    ignores: ['.next/**', 'node_modules/**'],
  }
]);