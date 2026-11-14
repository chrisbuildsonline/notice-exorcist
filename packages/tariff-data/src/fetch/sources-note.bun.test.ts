import { describe, expect, test } from 'bun:test';
import type { Manifest } from '../schemas';
import { regenerateSourcesNote } from './sources-note';

const entry = (retrievedAt: string) => ({ url: 'https://example.gov/x', retrievedAt, sha256: '0'.repeat(64) });
const manifest: Manifest = {
  edition: '2026 HTS Revision 23',
  files: {
    'hts/ch39.json': entry('2026-11-14T16:41:29.194Z'),
    'hts/ch42.json': entry('2026-11-14T16:41:30.000Z'),
    'rulings/N100001.json': entry('2026-11-13T10:00:00.000Z'),
    'rulings/N100002.json': entry('2026-11-14T10:00:00.000Z'),
  },
};

const note = `# Sources

Hand-written text stays.

<!-- generated from manifest.json -->
- old line
<!-- end generated -->

More hand-written text.
`;

describe('regenerateSourcesNote', () => {
  test('rewrites only the generated block', () => {
    const out = regenerateSourcesNote(note, manifest);
    expect(out).toBe(`# Sources

Hand-written text stays.

<!-- generated from manifest.json -->
- HTS edition: 2026 HTS Revision 23
- HTS retrieved: 2026-11-14 (2 chapter files)
- CROSS rulings retrieved: 2026-11-13 to 2026-11-14 (2 rulings)
<!-- end generated -->

More hand-written text.
`);
    expect(regenerateSourcesNote(out, manifest)).toBe(out);
  });

  test('throws when the markers are missing', () => {
    expect(() => regenerateSourcesNote('# Sources\n', manifest)).toThrow(/marker/);
  });
});
