import { describe, expect, it } from 'vitest';
import { TOOL_NAMES } from './index';

describe('tariff-mcp', () => {
  it('names the four MCP tools from the steering docs', () => {
    expect(TOOL_NAMES).toEqual(['lookup_tariff', 'search_rulings', 'calculate_duty', 'explain_rate']);
  });
});
