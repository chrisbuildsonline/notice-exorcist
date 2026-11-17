import { existsSync } from 'node:fs';
import { type Config, readConfig } from '../config';
import { netErrorCode } from '../providers/types';

export type ProbeResult = { up: true } | { up: false; reason: string };

/** GET {baseUrl}/models with a 3 s timeout, and check the model is listed. The reason is one line, no document content. */
export async function probeOllama({ baseUrl, model }: { baseUrl: string; model: string }, timeoutMs = 3000): Promise<ProbeResult> {
  const url = `${baseUrl.replace(/\/$/, '')}/models`;
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    return { up: false, reason: `GET ${url} failed: ${netErrorCode(e)}` };
  }
  if (!res.ok) return { up: false, reason: `GET ${url} returned HTTP ${res.status}` };
  let ids: string[];
  try {
    const body = (await res.json()) as { data?: { id?: unknown }[] };
    ids = (body.data ?? []).map((m) => String(m.id));
  } catch {
    return { up: false, reason: `GET ${url} returned a body that is not a model list` };
  }
  if (!ids.includes(model)) return { up: false, reason: `model ${model} not installed (installed: ${ids.join(', ') || 'none'})` };
  return { up: true };
}

/** Polls the probe until it is up or the time runs out. Returns the last result. */
export async function waitForOllama(
  target: { baseUrl: string; model: string },
  { timeoutMs = 60000, intervalMs = 1000 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<ProbeResult> {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const r = await probeOllama(target, Math.min(3000, Math.max(100, end - Date.now())));
    if (r.up || Date.now() + intervalMs > end) return r;
    await new Promise((res) => setTimeout(res, intervalMs));
  }
}

export type ChromiumPath = () => Promise<string>;

const playwrightChromiumPath: ChromiumPath = async () => (await import('@playwright/test')).chromium.executablePath();

/** Checks that Playwright's Chromium executable exists. */
export async function probeChromium(path: ChromiumPath = playwrightChromiumPath): Promise<ProbeResult> {
  let p: string;
  try {
    p = await path();
  } catch (e) {
    return { up: false, reason: `chromium path unknown: ${(e as Error)?.message ?? String(e)}` };
  }
  return existsSync(p) ? { up: true } : { up: false, reason: `chromium not found at ${p} (run: bunx playwright install chromium)` };
}

export type GateOpts = { config?: Config; chromiumPath?: ChromiumPath };

/**
 * For live test files, at module top level. Down: under EXTRACT_LIVE=require it throws, otherwise it writes
 * one `LIVE SKIPPED: <name>: <reason>` line to stderr and returns skip: true for `describe.skipIf`.
 */
export async function liveGate(name: string, needs: 'ollama' | 'chromium', opts: GateOpts = {}): Promise<{ skip: boolean }> {
  const config = opts.config ?? readConfig();
  const r = needs === 'ollama' ? await probeOllama(config) : await probeChromium(opts.chromiumPath);
  if (r.up) return { skip: false };
  if (config.live === 'require') throw new Error(`LIVE REQUIRED: ${name}: ${r.reason}`);
  process.stderr.write(`LIVE SKIPPED: ${name}: ${r.reason}\n`);
  return { skip: true };
}
