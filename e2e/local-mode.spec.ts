import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { approveBox, confirmAsRead, desktop, exportPill, watchErrors } from './helpers';

// Local-only mode (R10.1, R10.2): the specimen flow from the empty inbox to the exported PDF on a server started
// with EXTRACT_MODE=fixture and a guard that refuses every outbound connection not to this machine
// (playwright.config.ts, e2e/offline.cjs). The browser is held to localhost too.
const LOCAL = 'http://localhost:3212';
const LOG = resolve('.e2e-data-local/offline.log');

const isLocal = (url: string) => {
  const u = new URL(url);
  return ['data:', 'blob:'].includes(u.protocol) || ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
};

test('the guard refuses a connection off this machine and logs it', () => {
  const log = resolve('test-results/offline-guard.log');
  rmSync(log, { force: true });
  const script = "fetch('http://example.com/').then(() => process.exit(3), (e) => { console.log(String(e.cause?.message ?? e.message)); process.exit(0); })";
  const run = spawnSync(process.execPath, ['--require', resolve('e2e/offline.cjs'), '-e', script], { env: { ...process.env, OFFLINE_LOG: log }, encoding: 'utf8', timeout: 20_000 });
  expect(run.status).toBe(0);
  expect(run.stdout).toContain('offline: blocked example.com:80');
  expect(readFileSync(log, 'utf8')).toMatch(/^loaded \d+\nblocked example\.com:80\n$/);
});

test('the specimen flow runs to an exported PDF with no network but localhost', async ({ page }) => {
  test.setTimeout(90_000);
  const errors = watchErrors(page);
  const blocked: string[] = [];
  await page.context().route('**/*', (route) => {
    const url = route.request().url();
    if (isLocal(url)) return route.continue();
    blocked.push(url);
    return route.abort('internetdisconnected');
  });
  await expect.poll(() => page.request.get(LOCAL).then((r) => r.status()).catch(() => 0), { timeout: 60_000 }).toBe(200);

  // the empty inbox offers a specimen; the engine checks it from the recorded reading
  await page.setViewportSize(desktop);
  await page.goto(LOCAL);
  await page.getByRole('button', { name: 'Try a specimen' }).click();
  const row = page.getByRole('listitem').filter({ hasText: 'CBP Form 29 · Notice of Action' });
  await expect(row.getByText('Haunted · 1')).toBeVisible();

  // open it, confirm the flagged reads, draft the reply, approve it and export it
  await row.getByRole('link', { name: 'CBP Form 29 · Notice of Action' }).click();
  await expect(page).toHaveURL(/\/notices\/[\w-]+$/);
  await confirmAsRead(page.request, page.url());
  await page.reload();
  await expect(page.getByTestId('summary')).toContainText('computed');
  await page.getByRole('link', { name: 'Exorcise this notice' }).first().click();
  await expect(page.getByRole('heading', { level: 1, name: 'Exorcise the notice' })).toBeVisible();
  await approveBox(page).check();
  const downloading = page.waitForEvent('download');
  await exportPill(page).click();
  const file = await downloading;
  expect(file.suggestedFilename()).toMatch(/^notice-reply-[0-9a-f]{8}\.pdf$/);
  const bytes = readFileSync((await file.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');

  // nothing left the machine: the browser asked for nothing remote, and the server's guard was on and refused nothing
  expect(blocked).toEqual([]);
  expect(existsSync(LOG)).toBe(true);
  const lines = readFileSync(LOG, 'utf8').trim().split('\n');
  expect(lines.length).toBeGreaterThan(0);
  expect(lines.filter((l) => !l.startsWith('loaded '))).toEqual([]);
  expect(errors).toEqual([]);
});
