import { describe, expect, it } from 'vitest';
import { DEFAULT_THRESHOLD, fieldsNeedingConfirmation, markNeedsConfirmation } from './confidence';
import { Notice } from './schema/notice';
import { loadTruth, wrapTruth } from './test/wrap';

const notice = () => Notice.parse(wrapTruth(loadTruth('specimen-2-form29'))) as Record<string, any>;

describe('markNeedsConfirmation', () => {
  it('default threshold is 0.8: 0.79 and 0 need confirmation, 0.8 does not', () => {
    expect(DEFAULT_THRESHOLD).toBe(0.8);
    const n = notice();
    n.entryNumber.confidence = 0.79;
    n.port.confidence = 0;
    n.noticeType.confidence = 0.8;
    const m = markNeedsConfirmation(n as Notice) as Record<string, any>;
    expect(m.entryNumber.needs_confirmation).toBe(true);
    expect(m.port.needs_confirmation).toBe(true);
    expect(m.noticeType.needs_confirmation).toBe(false);
    expect(m.lines[0].hts.needs_confirmation).toBe(false);
  });

  it('takes a custom threshold', () => {
    const n = notice();
    n.lines[1].value.confidence = 0.85;
    const m = markNeedsConfirmation(n as Notice, 0.9) as Record<string, any>;
    expect(m.lines[1].value.needs_confirmation).toBe(true);
    expect(m.lines[1].hts.needs_confirmation).toBe(false);
  });

  it('changes no value and does not mutate its input; the result still parses', () => {
    const n = notice();
    n.lines[0].dutyStated.confidence = 0.2;
    const before = structuredClone(n);
    const m = markNeedsConfirmation(n as Notice) as Record<string, any>;
    expect(n).toEqual(before);
    expect(m.lines[0].dutyStated.value).toBe(before.lines[0].dutyStated.value);
    expect(Notice.safeParse(m).success).toBe(true);
  });

  it('lists the paths the user must confirm before any calculation', () => {
    const n = notice();
    n.lines[0].dutyStated.confidence = 0.2;
    n.dates.notice.confidence = 0.5;
    expect(fieldsNeedingConfirmation(markNeedsConfirmation(n as Notice))).toEqual(['dates.notice', 'lines[0].dutyStated']);
  });
});
