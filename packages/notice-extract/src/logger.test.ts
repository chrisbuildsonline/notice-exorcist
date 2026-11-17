import { afterEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from './config';
import { extractNotice } from './extract';
import { liveGate } from './live/probe';
import { logEvent } from './logger';
import { form29ModelReply, specimenBytes, stubProvider } from './test/stub-provider';
import { closedPort } from './test/stub-server';

afterEach(() => vi.restoreAllMocks());

/** Everything written to the console or stderr during fn. */
async function captureOutput(fn: () => Promise<unknown>): Promise<string> {
  const out: string[] = [];
  const grab = (...a: unknown[]) => void out.push(a.map(String).join(' '));
  for (const m of ['log', 'info', 'warn', 'error', 'debug'] as const) vi.spyOn(console, m).mockImplementation(grab);
  vi.spyOn(process.stderr, 'write').mockImplementation((s) => (out.push(String(s)), true));
  vi.spyOn(process.stdout, 'write').mockImplementation((s) => (out.push(String(s)), true));
  await fn();
  vi.restoreAllMocks();
  return out.join('\n');
}

describe('privacy-safe logging', () => {
  it('a full extraction logs kind, hash, duration and code, and no notice value or response text', async () => {
    const reply = form29ModelReply();
    const text = JSON.stringify(reply);
    const bad = { ...reply, port: { value: 'Long Beach, CA', confidence: 2, page: 1 } };
    const out = await captureOutput(async () => {
      await extractNotice({ bytes: specimenBytes('specimen-2-form29.png') }, { config: readConfig({ EXTRACT_LOG: '1' }), provider: stubProvider([text]) });
      await extractNotice({ bytes: specimenBytes('specimen-2-form29.png') }, { config: readConfig({ EXTRACT_LOG: '1' }), provider: stubProvider([JSON.stringify(bad)]) });
    });
    expect(out).toContain('cbp_form_29');
    expect(out).toContain('schema_invalid');
    expect(out).toMatch(/durationMs/);
    for (const secret of ['ZZ9-0423518-7', 'Fernhollow', 'Quarry Mill', '385.02', '4815.00', 'Long Beach', 'waffle', text.slice(0, 40)]) {
      expect(out).not.toContain(secret);
    }
  });

  it('a run with a cleared duty logs the guard rule and count, never the path or the model value', async () => {
    const out = await captureOutput(() =>
      extractNotice({ bytes: specimenBytes('specimen-1-form28.pdf') }, { config: { ...readConfig({ EXTRACT_LOG: '1' }), mode: 'fixture' } }),
    );
    expect(out).toContain('"guards":{"form28_no_line_duty":2}');
    for (const secret of ['210.60', '171.75', 'lines[', 'dutyStated', 'modelValue', 'cleared']) expect(out).not.toContain(secret);
  });

  it('the logger keeps only guard counts under known rule names', async () => {
    const out = await captureOutput(async () =>
      logEvent('extract', { code: 'ok', guards: { form28_no_line_duty: 1, 'lines[0].dutyStated': 3, courier_importer_is_courier: '210.60' } } as never),
    );
    expect(out).toContain('"guards":{"form28_no_line_duty":1}');
    expect(out).not.toContain('lines[0]');
    expect(out).not.toContain('210.60');
  });

  it('logs nothing unless EXTRACT_LOG=1', async () => {
    const out = await captureOutput(() =>
      extractNotice({ bytes: specimenBytes('specimen-2-form29.png') }, { config: readConfig({}), provider: stubProvider([JSON.stringify(form29ModelReply())]) }),
    );
    expect(out).toBe('');
  });

  it('the logger drops every key that is not whitelisted', async () => {
    const out = await captureOutput(async () =>
      logEvent('extract', { kind: 'cbp_form_29', hash: 'ab', durationMs: 5, code: 'ok', value: 'ZZ9-0423518-7', raw: '{"x":1}' } as never),
    );
    expect(out).toContain('cbp_form_29');
    expect(out).not.toContain('ZZ9');
    expect(out).not.toContain('raw');
  });

  it('the LIVE SKIPPED line carries only the URL, model and error code', async () => {
    const url = `${await closedPort()}/v1`;
    const out = await captureOutput(() => liveGate('live extraction', 'ollama', { config: readConfig({ EXTRACT_BASE_URL: url }) }));
    expect(out).toBe(`LIVE SKIPPED: live extraction: GET ${url}/models failed: ECONNREFUSED\n`);
  });
});
