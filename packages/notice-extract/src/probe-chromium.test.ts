import { afterEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from './config';
import { liveGate, probeChromium } from './live/probe';

afterEach(() => vi.restoreAllMocks());

const missing = async () => '/nonexistent/ms-playwright/chromium/chrome';

describe('Chromium gate', () => {
  it('a missing executable gives a reason with the path', async () => {
    expect(await probeChromium(missing)).toEqual({
      up: false,
      reason: 'chromium not found at /nonexistent/ms-playwright/chromium/chrome (run: bunx playwright install chromium)',
    });
  });

  it('logs the reason and skips', async () => {
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const gate = await liveGate('rasterize', 'chromium', { config: readConfig({}), chromiumPath: missing });
    expect(gate.skip).toBe(true);
    expect(String(write.mock.calls[0]![0])).toMatch(/^LIVE SKIPPED: rasterize: chromium not found at \/nonexistent/);
  });

  it('throws under EXTRACT_LIVE=require', async () => {
    await expect(liveGate('rasterize', 'chromium', { config: readConfig({ EXTRACT_LIVE: 'require' }), chromiumPath: missing })).rejects.toThrow(
      'chromium not found',
    );
  });

  it('a path that cannot be resolved at all is also a reason, not a crash', async () => {
    const r = await probeChromium(async () => {
      throw new Error('playwright not installed');
    });
    expect(r).toEqual({ up: false, reason: 'chromium path unknown: playwright not installed' });
  });
});
