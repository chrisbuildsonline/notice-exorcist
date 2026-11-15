import { describe, expect, it } from 'vitest';
import { serialize } from './serialize';

describe('serialize', () => {
  it('sorts keys at every depth, indents by two spaces and ends with a newline', () => {
    const out = serialize({ b: 1, a: { d: [{ z: 'x', y: null }], c: 'q' } });
    expect(out).toBe(
      ['{', '  "a": {', '    "c": "q",', '    "d": [', '      {', '        "y": null,', '        "z": "x"', '      }', '    ]', '  },', '  "b": 1', '}', ''].join('\n'),
    );
  });

  it('is stable under key reordering', () => {
    expect(serialize({ x: '1', y: { p: 1, q: 2 } })).toBe(serialize({ y: { q: 2, p: 1 }, x: '1' }));
  });

  it('keeps array order', () => {
    expect(serialize(['b', 'a'])).toBe('[\n  "b",\n  "a"\n]\n');
  });
});
