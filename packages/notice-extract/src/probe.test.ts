import { afterEach, describe, expect, it, vi } from 'vitest';
import { readConfig } from './config';
import { liveGate, probeOllama, waitForOllama } from './live/probe';
import { closedPort, sendJson, startStub, type Stub } from './test/stub-server';

let stubs: Stub[] = [];
afterEach(async () => {
  await Promise.all(stubs.map((s) => s.close()));
  stubs = [];
  vi.restoreAllMocks();
});
const stub = async (h: Parameters<typeof startStub>[0]) => {
  const s = await startStub(h);
  stubs.push(s);
  return s;
};
const models = (ids: string[]) => ({ object: 'list', data: ids.map((id) => ({ id, object: 'model' })) });

describe('probeOllama', () => {
  it('is up when GET /models lists the model', async () => {
    const s = await stub((_r, _b, res) => sendJson(res, 200, models(['llama3:8b', 'qwen2.5vl:7b'])));
    expect(await probeOllama({ baseUrl: `${s.url}/v1`, model: 'qwen2.5vl:7b' })).toEqual({ up: true });
    expect(s.requests[0]).toMatchObject({ method: 'GET', path: '/v1/models' });
  });

  it('down: the reason has the URL and ECONNREFUSED', async () => {
    const url = `${await closedPort()}/v1`;
    const r = await probeOllama({ baseUrl: url, model: 'qwen2.5vl:7b' });
    expect(r).toEqual({ up: false, reason: `GET ${url}/models failed: ECONNREFUSED` });
  });

  it('HTTP 500: the reason has the status', async () => {
    const s = await stub((_r, _b, res) => sendJson(res, 500, {}));
    expect(await probeOllama({ baseUrl: `${s.url}/v1`, model: 'qwen2.5vl:7b' })).toEqual({
      up: false,
      reason: `GET ${s.url}/v1/models returned HTTP 500`,
    });
  });

  it('a server without the model: names the model and what is installed', async () => {
    const s = await stub((_r, _b, res) => sendJson(res, 200, models(['llama3:8b', 'nomic-embed-text:latest'])));
    expect(await probeOllama({ baseUrl: `${s.url}/v1`, model: 'qwen2.5vl:7b' })).toEqual({
      up: false,
      reason: 'model qwen2.5vl:7b not installed (installed: llama3:8b, nomic-embed-text:latest)',
    });
  });
});

describe('liveGate (ollama)', () => {
  it('logs one line starting LIVE SKIPPED: with the reason, and returns skip: true', async () => {
    const url = `${await closedPort()}/v1`;
    const write = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    const gate = await liveGate('live extraction', 'ollama', { config: readConfig({ EXTRACT_BASE_URL: url }) });
    expect(gate.skip).toBe(true);
    expect(write).toHaveBeenCalledOnce();
    expect(String(write.mock.calls[0]![0])).toBe(`LIVE SKIPPED: live extraction: GET ${url}/models failed: ECONNREFUSED\n`);
  });

  it('with EXTRACT_LIVE=require it throws instead of skipping', async () => {
    const url = `${await closedPort()}/v1`;
    const config = readConfig({ EXTRACT_BASE_URL: url, EXTRACT_LIVE: 'require' });
    await expect(liveGate('live extraction', 'ollama', { config })).rejects.toThrow(`GET ${url}/models failed: ECONNREFUSED`);
  });

  it('does not skip when the probe is up', async () => {
    const s = await stub((_r, _b, res) => sendJson(res, 200, models(['qwen2.5vl:7b'])));
    expect(await liveGate('x', 'ollama', { config: readConfig({ EXTRACT_BASE_URL: `${s.url}/v1` }) })).toEqual({ skip: false });
  });
});

describe('waitForOllama', () => {
  it('returns once a server that starts late is up', async () => {
    const url = await closedPort();
    const port = Number(new URL(url).port);
    const { createServer } = await import('node:http');
    const late = createServer((_req, res) => sendJson(res, 200, models(['qwen2.5vl:7b'])));
    setTimeout(() => late.listen(port, '127.0.0.1'), 400);
    try {
      const r = await waitForOllama({ baseUrl: `${url}/v1`, model: 'qwen2.5vl:7b' }, { timeoutMs: 5000, intervalMs: 100 });
      expect(r).toEqual({ up: true });
    } finally {
      late.closeAllConnections();
      await new Promise((r) => late.close(r));
    }
  });

  it('gives up after the timeout with the last reason', async () => {
    const url = `${await closedPort()}/v1`;
    const r = await waitForOllama({ baseUrl: url, model: 'm' }, { timeoutMs: 300, intervalMs: 100 });
    expect(r).toEqual({ up: false, reason: `GET ${url}/models failed: ECONNREFUSED` });
  });
});
