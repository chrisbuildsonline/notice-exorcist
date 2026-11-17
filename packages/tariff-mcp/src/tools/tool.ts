import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { z } from 'zod';
import type { ToolName } from '../index';

/** One MCP tool: its Zod input schema (published as JSON Schema) and a handler that gets the parsed input. */
export type Tool<S extends z.ZodObject = z.ZodObject> = {
  name: ToolName;
  description: string;
  schema: S;
  handler: (args: z.output<S>) => CallToolResult | Promise<CallToolResult>;
};

/** Appended to every description: figures are quoted, never recomputed (no-model-math). */
export const QUOTE_FIGURES =
  'Quote every figure exactly as returned, with its provenance. Never recompute, round, convert or estimate a figure yourself.';
