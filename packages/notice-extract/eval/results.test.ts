import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { type EvalResult, evalAcceptance, RESULTS_DIR } from './run-eval';

/** The committed result must be what the committed fixtures give when replayed offline. */
const committed = JSON.parse(readFileSync(join(RESULTS_DIR, 'latest.json'), 'utf8')) as EvalResult;
const md = readFileSync(join(RESULTS_DIR, 'RESULTS.md'), 'utf8');
const withoutTime = ({ generatedAt: _g, ...rest }: EvalResult) => rest;

describe('committed eval result', () => {
  it('equals a fixture-mode replay of the eval, apart from generatedAt', async () => {
    const replay = await evalAcceptance('fixture');
    expect(JSON.parse(JSON.stringify(withoutTime(replay)))).toEqual(withoutTime(committed));
  });

  it('RESULTS.md states the overall figure from latest.json', () => {
    expect(md).toContain(`Overall exact-match rate: ${committed.overall.rate}% (${committed.overall.matched} of ${committed.overall.total} fields)`);
  });
});
