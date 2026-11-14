/** The tools this MCP server exposes. */
export const TOOL_NAMES = ['lookup_tariff', 'search_rulings', 'calculate_duty', 'explain_rate'] as const;

export type ToolName = (typeof TOOL_NAMES)[number];
