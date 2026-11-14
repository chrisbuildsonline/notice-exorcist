import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{apps,packages}/**/*.test.{ts,tsx}'],
    // tariff-data uses bun:sqlite, so its tests run under `bun test`
    exclude: ['**/node_modules/**', '**/.next/**', 'packages/tariff-data/**'],
  },
});
