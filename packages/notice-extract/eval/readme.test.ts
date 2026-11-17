import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RESULTS_DIR } from './run-eval';

/** The README accuracy sentence may only quote figures that the committed eval result holds. */
const readme = readFileSync(fileURLToPath(new URL('../../../README.md', import.meta.url)), 'utf8');
const latest = JSON.parse(readFileSync(join(RESULTS_DIR, 'latest.json'), 'utf8')) as unknown;
const sentence = /Measured accuracy:[^\n]*/.exec(readme)?.[0] ?? '';

/** Every number stored under a `rate` key anywhere in latest.json. */
function rates(v: unknown, out: number[] = []): number[] {
  if (Array.isArray(v)) for (const x of v) rates(x, out);
  else if (v && typeof v === 'object')
    for (const [k, x] of Object.entries(v)) {
      if (k === 'rate' && typeof x === 'number') out.push(x);
      else rates(x, out);
    }
  return out;
}

describe('README measured accuracy', () => {
  it('is filled in, not the placeholder', () => {
    expect(sentence).not.toBe('');
    expect(sentence).not.toContain('[fill in measured result]');
  });

  it('quotes only percentages that are in latest.json', () => {
    const quoted = [...sentence.matchAll(/(\d+(?:\.\d+)?)%/g)].map((m) => Number(m[1]));
    expect(quoted.length).toBeGreaterThan(0);
    const known = rates(latest);
    for (const q of quoted) expect(known, `${q}% is not a rate in latest.json`).toContain(q);
  });
});
