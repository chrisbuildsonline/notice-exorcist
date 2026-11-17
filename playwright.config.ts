import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = 3210;
// A fresh notice store per run, so the inbox starts empty.
const DATA_DIR = resolve('.e2e-data');

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  forbidOnly: true,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `rm -rf "${DATA_DIR}" && bun run build && bun run --cwd apps/web start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { NOTICE_DATA_DIR: DATA_DIR, INBOUND_SECRET: 'e2e-secret', INBOX_TOKEN: 'e2e', EXTRACT_MODE: '' },
  },
});
