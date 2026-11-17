import { afterEach, describe, expect, it, vi } from 'vitest';
import { closedPort, sendJson, startStub, type Stub } from '../test/stub-server';
import { ollamaProvider } from './ollama';
import { ProviderError } from './types';

let stub: Stub | undefined;
afterEach(async () => {
  await stub?.close();
  stub = undefined;
});

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);
const jpg = new Uint8Array([0xff, 0xd8, 0xff, 9, 9]);
const req = { system: 'sys', user: 'read it', images: [{ mime: 'image/png' as const, bytes: png }, { mime: 'image/jpeg' as const, bytes: jpg }] };

describe('ollama provider (OpenAI-compatible chat completions)', () => {
  it('posts model, prompt, one data URL per image with its own mime, JSON output, and returns the content', async () => {
    stub = await startStub((_r, _b, res) => sendJson(res, 200, { choices: [{ message: { role: 'assistant', content: '{"kind":"unknown"}' } }] }));
    const p = ollamaProvider({ baseUrl: `${stub.url}/v1`, model: 'qwen2.5vl:7b', timeoutMs: 5000 });
    expect(p.name).toBe('ollama');
    expect(await p.complete(req)).toBe('{"kind":"unknown"}');

    const sent = stub.requests[0]!;
    expect(sent.method).toBe('POST');
    expect(sent.path).toBe('/v1/chat/completions');
    const body = JSON.parse(sent.body);
    expect(body.model).toBe('qwen2.5vl:7b');
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(body.stream).toBe(true);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys' });
    const parts = body.messages[1].content;
    expect(parts[0]).toEqual({ type: 'text', text: 'read it' });
    expect(parts[1].image_url.url).toBe(`data:image/png;base64,${Buffer.from(png).toString('base64')}`);
    expect(parts[2].image_url.url).toBe(`data:image/jpeg;base64,${Buffer.from(jpg).toString('base64')}`);
  });

  it('gives a timeout error when the server does not answer in time', async () => {
    stub = await startStub(() => {});
    const p = ollamaProvider({ baseUrl: `${stub.url}/v1`, model: 'm', timeoutMs: 150 });
    const err = await p.complete(req).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.code).toBe('timeout');
  });

  it('gives model_unreachable for a closed port and for an HTTP error, with the status in the detail', async () => {
    const p = ollamaProvider({ baseUrl: `${await closedPort()}/v1`, model: 'm', timeoutMs: 2000 });
    const err = await p.complete(req).catch((e) => e);
    expect(err.code).toBe('model_unreachable');
    expect(err.detail).toMatch(/ECONNREFUSED/);

    stub = await startStub((_r, _b, res) => sendJson(res, 500, { error: 'boom' }));
    const q = ollamaProvider({ baseUrl: `${stub.url}/v1`, model: 'm', timeoutMs: 2000 });
    const err2 = await q.complete(req).catch((e) => e);
    expect(err2.code).toBe('model_unreachable');
    expect(err2.detail).toMatch(/HTTP 500/);
  });

  it('streams the reply (headers come at once, so long inference does not hit fetch idle limits) and joins the chunks', async () => {
    stub = await startStub((_r, _b, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      const chunks = ['{"kind":', '"cbp_', 'form_29"}'];
      let i = 0;
      const next = () => {
        if (i < chunks.length) {
          res.write(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { role: 'assistant', content: chunks[i++] } }] })}\n\n`);
          setTimeout(next, 20);
        } else res.end('data: [DONE]\n\n');
      };
      next();
    });
    const p = ollamaProvider({ baseUrl: `${stub.url}/v1`, model: 'm', timeoutMs: 5000 });
    expect(await p.complete(req)).toBe('{"kind":"cbp_form_29"}');
    expect(JSON.parse(stub.requests[0]!.body).stream).toBe(true);
  });

  it("under Bun, turns off Bun's own fetch timeout and keeps its own abort signal", async () => {
    let init: (RequestInit & { timeout?: unknown }) | undefined;
    vi.stubGlobal('Bun', {});
    const spy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (_u, i) => {
      init = i as typeof init;
      return new Response('data: {"choices":[{"delta":{"content":"{}"}}]}\n\ndata: [DONE]\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' },
      });
    });
    try {
      expect(await ollamaProvider({ baseUrl: 'http://127.0.0.1:1/v1', model: 'm', timeoutMs: 5000 }).complete(req)).toBe('{}');
    } finally {
      spy.mockRestore();
      vi.unstubAllGlobals();
    }
    expect(init?.timeout).toBe(false);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it('gives a timeout error when the stream stalls after the first chunk', async () => {
    stub = await startStub((_r, _b, res) => {
      res.writeHead(200, { 'content-type': 'text/event-stream' });
      res.write(`data: ${JSON.stringify({ choices: [{ delta: { content: '{' } }] })}\n\n`);
    });
    const p = ollamaProvider({ baseUrl: `${stub.url}/v1`, model: 'm', timeoutMs: 200 });
    const err = await p.complete(req).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.code).toBe('timeout');
  });

  it('returns an empty string when the reply has no message content, so the caller reports not_json', async () => {
    stub = await startStub((_r, _b, res) => sendJson(res, 200, { choices: [] }));
    const p = ollamaProvider({ baseUrl: `${stub.url}/v1`, model: 'm', timeoutMs: 2000 });
    expect(await p.complete(req)).toBe('');
  });
});
