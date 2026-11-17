import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { z } from 'zod';
import { TOOL_NAMES, type ToolName } from './index';
import { calculateDuty } from './tools/calculate-duty';
import { explainRate } from './tools/explain-rate';
import { lookupTariff } from './tools/lookup-tariff';
import { searchRulings } from './tools/search-rulings';
import type { Tool } from './tools/tool';

const TOOLS: Record<ToolName, Tool<z.ZodObject>> = {
  lookup_tariff: lookupTariff as Tool<z.ZodObject>,
  search_rulings: searchRulings as Tool<z.ZodObject>,
  calculate_duty: calculateDuty as Tool<z.ZodObject>,
  explain_rate: explainRate as Tool<z.ZodObject>,
};

/** The MCP server with the four tools registered in TOOL_NAMES order. Not connected to a transport. */
export function createServer(): McpServer {
  const server = new McpServer({ name: 'tariff-mcp', version: '0.1.0' });
  for (const name of TOOL_NAMES) {
    const tool = TOOLS[name];
    server.registerTool(name, { description: tool.description, inputSchema: tool.schema }, (args) => tool.handler(args));
  }
  return server;
}

async function main() {
  await createServer().connect(new StdioServerTransport());
  const stop = () => process.exit(0);
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

if (import.meta.main) {
  main().catch((e: unknown) => {
    console.error(`tariff-mcp: failed to start (${e instanceof Error ? e.name : 'error'})`);
    process.exit(1);
  });
}
