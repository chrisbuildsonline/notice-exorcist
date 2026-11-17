import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['{apps,packages,scripts,test}/**/*.test.{ts,tsx}'],
    // tariff-data uses bun:sqlite, so its tests (and every *.bun.test.ts) run under `bun test`
    // notice-extract live tests need Ollama: they run only through `bun run --cwd packages/notice-extract test:live`
    exclude: ['**/node_modules/**', '**/.next/**', 'packages/tariff-data/**', '**/*.bun.test.ts', 'packages/notice-extract/src/live/**'],
  },
});
