import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const PORT = 3210;
// A fresh notice store per run, so the inbox starts empty.
const DATA_DIR = resolve('.e2e-data');
// A second server on its own store whose reader flags every field read below 0.96 (the recordings are 0.95),
// so the confirm flow can be driven with the real specimens. It shares the one build.
const STRICT = `NOTICE_DATA_DIR="${resolve('.e2e-data-strict')}" CONFIRM_BELOW=0.96 bun run --cwd apps/web start --port 3211`;
// A third, local-only server (local-mode.spec.ts): recorded fixtures, and a preloaded guard that refuses and logs
// every outbound connection that is not to this machine.
const LOCAL_DIR = resolve('.e2e-data-local');
const LOCAL = `NOTICE_DATA_DIR="${LOCAL_DIR}" EXTRACT_MODE=fixture OFFLINE_LOG="${LOCAL_DIR}/offline.log" NODE_OPTIONS="--require ${resolve('e2e/offline.cjs')}" bun run --cwd apps/web start --port 3212`;

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
  // empty-inbox.spec.ts and inbox.spec.ts check the empty store, so they run (in that order) before every spec that
  // files notices.
  projects: [
    { name: 'empty-inbox', testMatch: /(^|\/)(empty-)?inbox\.spec\.ts$/, use: { ...devices['Desktop Chrome'] } },
    { name: 'chromium', testIgnore: /(^|\/)(empty-)?inbox\.spec\.ts$/, dependencies: ['empty-inbox'], use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `rm -rf "${DATA_DIR}" "${DATA_DIR}-strict" "${LOCAL_DIR}" && bun run build && (${STRICT} & ${LOCAL} & bun run --cwd apps/web start --port ${PORT})`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: { NOTICE_DATA_DIR: DATA_DIR, INBOUND_SECRET: 'e2e-secret', INBOX_TOKEN: 'e2e', EXTRACT_MODE: '' },
  },
});
