import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SPECIMENS } from './data';
import { serialize } from './serialize';

// The committed fields JSON is the stable contract (R1.4, R1.5). Regenerate with `bun run specimens:generate`.
const FIXTURES = join(import.meta.dirname, '../../fixtures/specimens');
const COMMITTED = [
  ...SPECIMENS.flatMap((s) => ['pdf', 'png', 'fields.json'].map((ext) => `${s.specimenId}.${ext}`)),
  'specimen-2-form29.photo.jpg',
  'LICENSE.txt',
].sort();

describe('committed specimens', () => {
  it('fixtures/specimens/ holds exactly the generated files', () => {
    expect(existsSync(FIXTURES)).toBe(true);
    expect(readdirSync(FIXTURES).sort()).toEqual(COMMITTED);
  });

  it.each(SPECIMENS.map((s) => [s.specimenId, s] as const))('%s.fields.json equals serialize(specimen) byte for byte', (id, s) => {
    const file = join(FIXTURES, `${id}.fields.json`);
    expect(existsSync(file), `${file} is missing`).toBe(true);
    const out = serialize(s);
    expect(serialize(structuredClone(s))).toBe(out);
    expect(readFileSync(file, 'utf8')).toBe(out);
    expect(out).toMatchSnapshot();
  });
});
