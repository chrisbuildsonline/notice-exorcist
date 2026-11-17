import { Agent, getGlobalDispatcher, setGlobalDispatcher } from 'undici';
import { afterEach, describe, expect, it } from 'vitest';
import { startStub, type Stub } from '../test/stub-server';
import { fetchOrFail, nodeAgentOptions, ProviderError } from './types';

let stub: Stub | undefined;
afterEach(async () => {
  await stub?.close();
  stub = undefined;
});

describe('fetchOrFail under Node', () => {
  it('turns off undici header and body limits, so only our own timeout applies', () => {
    expect(nodeAgentOptions).toEqual({ headersTimeout: 0, bodyTimeout: 0 });
  });

  it('waits past the default undici limits for late headers and a paused body (a model queued behind another)', async () => {
    // The default dispatcher with its 300 s limits scaled down to about 1 s (undici checks them on a ~0.5 s tick),
    // so a request that went through it would fail with UND_ERR_HEADERS_TIMEOUT or UND_ERR_BODY_TIMEOUT.
    const before = getGlobalDispatcher();
    const strict = new Agent({ headersTimeout: 1001, bodyTimeout: 1001 });
    setGlobalDispatcher(strict);
    stub = await startStub((_r, _b, res) => {
      setTimeout(() => {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.write('late ');
        setTimeout(() => res.end('reply'), 2000);
      }, 2000);
    });
    try {
      const res = await fetchOrFail(stub.url, { method: 'POST', body: '{}' }, 10_000);
      expect(await res.text()).toBe('late reply');
    } finally {
      setGlobalDispatcher(before);
      await strict.close();
    }
  }, 15_000);

  it('still gives up with a timeout error at our own timeoutMs', async () => {
    stub = await startStub(() => {});
    const err = await fetchOrFail(stub.url, { method: 'POST', body: '{}' }, 150).catch((e) => e);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.code).toBe('timeout');
  });
});
