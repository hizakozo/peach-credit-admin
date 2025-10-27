import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  // Test configuration for vitest
  test: {
    globals: true,
    environment: 'node',
  },

  // Build configuration for GAS deployment
  build: {
    outDir: 'gas-dist',
    lib: {
      entry: resolve(__dirname, 'src/main.ts'),
      name: 'GasApp',
      formats: ['iife'],
      fileName: () => 'main.js',
    },
    rollupOptions: {
      output: {
        extend: true,
        // Don't add 'use strict' as GAS doesn't like it
        strict: false,
      },
    },
    minify: false,
    sourcemap: false,
  },
});
