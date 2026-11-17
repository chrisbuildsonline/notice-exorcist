import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { call, connect, textOf } from './harness.bun.test';

const tmp = mkdtempSync(join(tmpdir(), 'tariff-mcp-errors-'));
const missing = join(tmp, 'no-such-index.sqlite');
const garbage = join(tmp, 'not-a-database.sqlite');
writeFileSync(garbage, 'this is not a sqlite file, just some text that is long enough to have a header'.repeat(20));

const noTrace = (text: string) => {
  expect(text).not.toMatch(/\n\s+at /);
  expect(text).not.toContain(import.meta.dir);
};

describe('input validation', () => {
  let client: Client;
  beforeAll(async () => {
    client = await connect();
  }, 15_000);
  afterAll(() => client?.close());

  test('a JS number where a string is expected is a tool error naming the field', async () => {
    const r = await call(client, 'explain_rate', { rateText: 5 });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain('rateText');
    noTrace(textOf(r));
  });

  test('the server keeps serving after a validation error', async () => {
    const { tools } = await client.listTools();
    expect(tools.length).toBe(4);
  });
});

describe('index missing', () => {
  let client: Client;
  beforeAll(async () => {
    client = await connect({ TARIFF_INDEX_PATH: missing });
  }, 15_000);
  afterAll(() => client?.close());

  test('the server starts and lists its tools without the index', async () => {
    const { tools } = await client.listTools();
    expect(tools.length).toBe(4);
  });

  test('lookup_tariff is a tool error naming TARIFF_INDEX_PATH and data:build, and the server answers again after it', async () => {
    for (let i = 0; i < 2; i++) {
      const r = await call(client, 'lookup_tariff', { htsCode: '6109.10.00' });
      expect(r.isError).toBe(true);
      expect(textOf(r)).toContain('TARIFF_INDEX_PATH');
      expect(textOf(r)).toContain('data:build');
      noTrace(textOf(r));
    }
    expect((await client.listTools()).tools.length).toBe(4);
  });
});

describe('index unreadable', () => {
  let client: Client;
  beforeAll(async () => {
    client = await connect({ TARIFF_INDEX_PATH: garbage });
  }, 15_000);
  afterAll(() => client?.close());

  test('a file that is not an index is a tool error naming TARIFF_INDEX_PATH and data:build', async () => {
    const r = await call(client, 'lookup_tariff', { htsCode: '6109.10.00' });
    expect(r.isError).toBe(true);
    expect(textOf(r)).toContain('TARIFF_INDEX_PATH');
    expect(textOf(r)).toContain('data:build');
    noTrace(textOf(r));
    expect((await client.listTools()).tools.length).toBe(4);
  });
});
