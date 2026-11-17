import { describe, expect, it } from 'vitest';
import { Fields } from '../../../../scripts/specimens/schema';
import { Notice } from '../schema/notice';
import { ORACLE_KEYS } from '../test/zod-tree';
import { loadTruth, SPECIMEN_IDS, wrapTruth } from '../test/wrap';
import { toSpecimen } from './toSpecimen';

/** The truth with every oracle key removed at any depth. */
function withoutOracle(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(withoutOracle);
  if (v !== null && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v)
        .filter(([k]) => !(ORACLE_KEYS as readonly string[]).includes(k))
        .map(([k, x]) => [k, withoutOracle(x)]),
    );
  }
  return v;
}

describe('toSpecimen', () => {
  it.each(SPECIMEN_IDS)('unwraps the wrapped %s back to its truth minus the oracle keys', (id) => {
    const truth = loadTruth(id);
    const notice = Notice.parse(wrapTruth(truth));
    const out = toSpecimen(notice, id);
    expect(out).toEqual({ specimenId: id, ...(withoutOracle(truth) as object) });
  });

  it.each(SPECIMEN_IDS)('the output of %s parses with the specimen Fields schema (notes is an oracle key, given empty)', (id) => {
    const out = toSpecimen(Notice.parse(wrapTruth(loadTruth(id))), id);
    expect(Fields.safeParse({ ...out, notes: [] }).error?.issues).toBeUndefined();
  });

  it('is pure: the notice is not changed and values are not rewritten', () => {
    const notice = Notice.parse(wrapTruth(loadTruth('specimen-2-form29')));
    const before = structuredClone(notice);
    const out = toSpecimen(notice, 'x');
    expect(notice).toEqual(before);
    expect(out.lines[1]?.rateText).toBe('12.1¢/kg + 4.6%');
    expect(out.statedTotals[1]?.stated).toBe('648.36');
  });
});
