import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';

type Data = Record<string, unknown>;

/** A normal result: the same data as JSON text (for clients that ignore structured content) and as structured content. */
export function ok(data: Data): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }], structuredContent: data };
}

/** A tool error: `isError` with a short message, plus structured details when there are any. */
export function toolError(message: string, data?: Data): CallToolResult {
  const text = data ? `${message}\n${JSON.stringify(data)}` : message;
  return { isError: true, content: [{ type: 'text', text }], ...(data && { structuredContent: data }) };
}
