// Test helper (no tests of its own): spawn the real server over stdio, exactly as .kiro/settings/mcp.json does.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export const repoRoot = join(import.meta.dir, '../../..');
export const DEFAULT_INDEX = join(repoRoot, 'packages/tariff-data/.cache/tariff.sqlite');

type ServerEntry = { command: string; args: string[] };
export const mcpEntry = (): ServerEntry =>
  JSON.parse(readFileSync(join(repoRoot, '.kiro/settings/mcp.json'), 'utf8')).mcpServers['tariff-mcp'];

/** A connected client for a fresh server process. Fails (never skips) when the index has not been built. */
export async function connect(env: Record<string, string> = {}): Promise<Client> {
  const index = env.TARIFF_INDEX_PATH ?? process.env.TARIFF_INDEX_PATH ?? DEFAULT_INDEX;
  if (!env.TARIFF_INDEX_PATH && !existsSync(index)) {
    throw new Error(`tariff index missing at ${index}: run \`bun run --cwd packages/tariff-data data:build\` first`);
  }
  const { command, args } = mcpEntry();
  const transport = new StdioClientTransport({ command, args, cwd: repoRoot, env, stderr: 'pipe' });
  const client = new Client({ name: 'tariff-mcp-test', version: '0.0.0' });
  await client.connect(transport);
  return client;
}

export type ToolResult = { isError?: boolean; content: { type: string; text?: string }[]; structuredContent?: Record<string, unknown> };

export async function call(client: Client, name: string, args: Record<string, unknown>): Promise<ToolResult> {
  return (await client.callTool({ name, arguments: args })) as ToolResult;
}

export const textOf = (r: ToolResult) => r.content.map((c) => c.text ?? '').join('\n');
