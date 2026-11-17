import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { connect, mcpEntry } from './harness.bun.test';
import { TOOL_NAMES } from './index';

let client: Client;
beforeAll(async () => {
  client = await connect();
}, 15_000);
afterAll(async () => {
  await client?.close();
});

describe('tariff-mcp server over stdio', () => {
  test('is started by the command in .kiro/settings/mcp.json', () => {
    expect(mcpEntry().args.at(-1)).toBe('packages/tariff-mcp/src/server.ts');
  });

  test('lists exactly the four tools, in order, each with an object input schema', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name)).toEqual(['lookup_tariff', 'search_rulings', 'calculate_duty', 'explain_rate']);
    expect(tools.map((t) => t.name)).toEqual([...TOOL_NAMES]);
    for (const t of tools) {
      expect(t.inputSchema.type).toBe('object');
      expect(Object.keys(t.inputSchema.properties ?? {}).length).toBeGreaterThan(0);
    }
  });

  test('every tool description tells the model to quote figures and never recompute them', async () => {
    const { tools } = await client.listTools();
    for (const t of tools) {
      expect(t.description).toContain('Quote every figure exactly as returned');
      expect(t.description).toContain('Never recompute');
    }
  });
});
