import { describe, expect, it } from 'vitest';
import { Notice } from '../schema/notice';
import { loadTruth, wrapTruth } from '../test/wrap';
import { compareToSpecimen, groupPath } from './compare';

const truth = () => loadTruth('specimen-2-form29');
const notice = (t = truth()) => Notice.parse(wrapTruth(t)) as Record<string, any>;
const wrong = (r: ReturnType<typeof compareToSpecimen>) => r.filter((x) => !x.match);

describe('compareToSpecimen', () => {
  it('identical input gives all match: true, one result per leaf', () => {
    const r = compareToSpecimen(notice() as Notice, truth());
    expect(r.length).toBeGreaterThan(40);
    expect(wrong(r)).toEqual([]);
    expect(r.find((x) => x.path === 'lines[2].hts')).toMatchObject({ expected: '4202.32.10.00', actual: '4202.32.10.00', confidence: 0.95 });
  });

  it('a change to one field gives exactly one mismatch at its path', () => {
    const n = notice();
    n.lines[0].hts.value = '6302.91.01';
    const r = wrong(compareToSpecimen(n as Notice, truth()));
    expect(r.map((x) => x.path)).toEqual(['lines[1].hts']);
    expect(r[0]).toMatchObject({ expected: '6302.91.00', actual: '6302.91.01', match: false });
  });

  it('lines are matched by n, not by position', () => {
    const n = notice();
    n.lines.reverse();
    expect(wrong(compareToSpecimen(n as Notice, truth()))).toEqual([]);
  });

  it('a missing line counts all its fields as wrong', () => {
    const n = notice();
    n.lines.pop();
    const r = wrong(compareToSpecimen(n as Notice, truth()));
    expect(r).toHaveLength(8);
    expect(r.every((x) => x.path.startsWith('lines[4].') && x.actual === undefined)).toBe(true);
  });

  it('an extra line counts all its fields as wrong', () => {
    const n = notice();
    n.lines.push({ ...structuredClone(n.lines[0]), n: { ...n.lines[0].n, value: 9 } });
    const r = wrong(compareToSpecimen(n as Notice, truth()));
    expect(r).toHaveLength(8);
    expect(r.every((x) => x.path.startsWith('lines[9].') && x.expected === undefined)).toBe(true);
  });

  it('a missing fee and an extra fee count as wrong fields, matched by index', () => {
    const n = notice();
    n.fees = [];
    expect(wrong(compareToSpecimen(n as Notice, truth())).map((x) => x.path).sort()).toEqual(['fees[0].kind', 'fees[0].name', 'fees[0].stated']);
    const m = notice();
    m.fees.push(structuredClone(m.fees[0]));
    expect(wrong(compareToSpecimen(m as Notice, truth())).map((x) => x.path).sort()).toEqual(['fees[1].kind', 'fees[1].name', 'fees[1].stated']);
  });

  it('flagged follows needs_confirmation, and confidence is reported', () => {
    const n = notice();
    n.entryNumber = { ...n.entryNumber, confidence: 0.4, needs_confirmation: true };
    const r = compareToSpecimen(n as Notice, truth());
    expect(r.find((x) => x.path === 'entryNumber')).toMatchObject({ match: true, flagged: true, confidence: 0.4 });
    expect(r.find((x) => x.path === 'noticeType')?.flagged).toBe(false);
  });

  it('ignores oracle keys: a truth with expectedDuty gives the same result as one without', () => {
    const t = truth();
    expect(t.lines[0]?.expectedDuty).toBe('442.98');
    const bare = structuredClone(t);
    delete bare.lines[0]!.expectedDuty;
    delete bare.lines[0]!.plantedError;
    expect(compareToSpecimen(notice() as Notice, t)).toEqual(compareToSpecimen(notice() as Notice, bare));
  });

  it('strict string equality: "385.02" against "385.020" is a mismatch', () => {
    const n = notice();
    n.lines[0].dutyStated.value = '385.020';
    expect(wrong(compareToSpecimen(n as Notice, truth())).map((x) => x.path)).toEqual(['lines[1].dutyStated']);
  });

  it('a different kind makes the kind and kind-specific paths wrong', () => {
    const n = notice(loadTruth('specimen-3-courier'));
    const paths = wrong(compareToSpecimen(n as Notice, truth())).map((x) => x.path);
    expect(paths).toContain('kind');
    expect(paths).toContain('courier');
    expect(paths).toContain('courier.name');
  });

  it('groupPath removes array indexes', () => {
    expect(groupPath('lines[12].hts')).toBe('lines[].hts');
    expect(groupPath('informationRequested[0]')).toBe('informationRequested[]');
    expect(groupPath('dates.notice')).toBe('dates.notice');
  });
});
