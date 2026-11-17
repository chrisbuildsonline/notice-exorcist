import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { InvalidMoneyError, MissingProvenanceError } from '@notice-exorcist/duty-engine';
import { IndexNotBuiltError } from '@notice-exorcist/tariff-data';
import type { z } from 'zod';
import { closeDb, IndexUnreadableError } from './context';
import { TOOL_NAMES, type ToolName } from './index';
import { toolError } from './result';
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

/** The message a caller may see. Known errors keep their own short message; anything else is generic. */
export function publicMessage(e: unknown, tool: ToolName): string {
  if (e instanceof IndexNotBuiltError) return `${e.message} (the path comes from TARIFF_INDEX_PATH)`;
  if (e instanceof IndexUnreadableError || e instanceof InvalidMoneyError || e instanceof MissingProvenanceError) return e.message;
  return `internal error in ${tool}`;
}

/** Every handler runs inside this: an exception becomes a tool error and the server keeps serving. */
export function safe(tool: Tool<z.ZodObject>) {
  return async (args: Record<string, unknown>): Promise<CallToolResult> => {
    try {
      return await tool.handler(args);
    } catch (e) {
      // stderr only, and never the arguments (they can hold notice contents)
      console.error(`tariff-mcp: ${tool.name} failed: ${e instanceof Error ? e.name : typeof e}`);
      return toolError(publicMessage(e, tool.name));
    }
  };
}

/** The MCP server with the four tools registered in TOOL_NAMES order. Not connected to a transport. */
export function createServer(): McpServer {
  const server = new McpServer({ name: 'tariff-mcp', version: '0.1.0' });
  for (const name of TOOL_NAMES) {
    const tool = TOOLS[name];
    server.registerTool(name, { description: tool.description, inputSchema: tool.schema }, safe(tool));
  }
  return server;
}

async function main() {
  await createServer().connect(new StdioServerTransport());
  const stop = () => {
    closeDb();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

if (import.meta.main) {
  main().catch((e: unknown) => {
    console.error(`tariff-mcp: failed to start (${e instanceof Error ? e.name : 'error'})`);
    process.exit(1);
  });
}
