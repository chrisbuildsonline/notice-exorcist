import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = 3210;
// A fresh notice store per run, so the inbox starts empty.
const DATA_DIR = resolve('.e2e-data');
// A second server on its own store whose reader flags every field read below 0.96 (the recordings are 0.95),
// so the confirm flow can be driven with the real specimens. It shares the one build.
const STRICT = `NOTICE_DATA_DIR="${resolve('.e2e-data-strict')}" CONFIRM_BELOW=0.96 bun run --cwd apps/web start --port 3211`;

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results',
  forbidOnly: true,
  // One shared store: inbox.spec.ts checks the empty state before notice-view.spec.ts files more notices.
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `rm -rf "${DATA_DIR}" "${DATA_DIR}-strict" && bun run build && (${STRICT} & bun run --cwd apps/web start --port ${PORT})`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { NOTICE_DATA_DIR: DATA_DIR, INBOUND_SECRET: 'e2e-secret', INBOX_TOKEN: 'e2e', EXTRACT_MODE: '' },
  },
});
