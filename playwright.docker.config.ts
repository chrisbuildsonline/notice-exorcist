import { defineConfig, devices } from '@playwright/test';

// `bun run docker:check`: the specimen flow against an app container that is already running (no webServer here).
// Point it elsewhere with SERVE_URL; the default matches `docker run --rm -p 3000:3000 notice-exorcist`.
export default defineConfig({
  testDir: './e2e',
  testMatch: /\.docker\.ts$/,
  outputDir: './test-results/docker',
  forbidOnly: true,
  reporter: [['list']],
  use: { ...devices['Desktop Chrome'], baseURL: process.env.SERVE_URL || 'http://localhost:3000' },
});
