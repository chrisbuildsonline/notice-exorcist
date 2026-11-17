import { describe, expect, it } from 'vitest';
import { loadTruth, wrapTruth } from '../test/wrap';
import { Form28 } from './form28';

const sample = () => wrapTruth(loadTruth('specimen-1-form28')) as Record<string, any>;

describe('Form 28 schema', () => {
  it('parses a valid sample (the Form 28 specimen wrapped in stated fields)', () => {
    const r = Form28.safeParse(sample());
    expect(r.error?.issues).toBeUndefined();
  });

  it('rejects an empty informationRequested list: a Form 28 always asks for something', () => {
    expect(Form28.safeParse({ ...sample(), informationRequested: [] }).success).toBe(false);
  });

  it('has a null actionType: only a Form 29 marks an action', () => {
    const s = sample();
    s.actionType.value = 'rate_advance';
    expect(Form28.safeParse(s).success).toBe(false);
  });

  it('requires a response deadline (null only as not found, confidence 0)', () => {
    const s = sample();
    s.dates.responseDeadline = { ...s.dates.responseDeadline, value: null, confidence: 0.9 };
    expect(Form28.safeParse(s).success).toBe(false);
    s.dates.responseDeadline.confidence = 0;
    expect(Form28.safeParse(s).success).toBe(true);
    const t = sample();
    t.dates.responseDeadline.value = '11/20/2026';
    expect(Form28.safeParse(t).success).toBe(false);
  });

  it('lets a line leave dutyStated blank, since the form prints no duty', () => {
    const s = sample();
    expect(s.lines[0].dutyStated.value).toBeNull();
    expect(s.lines[0].dutyStated.confidence).toBeGreaterThan(0);
    expect(Form28.safeParse(s).success).toBe(true);
  });

  it('rejects a courier block, a missing line list and the wrong kind', () => {
    const s = sample();
    expect(Form28.safeParse({ ...s, courier: { name: s.noticeType, invoiceNumber: s.noticeType, waybill: s.noticeType } }).success).toBe(false);
    expect(Form28.safeParse({ ...s, lines: [] }).success).toBe(false);
    expect(Form28.safeParse({ ...s, kind: 'form28' }).success).toBe(false);
  });
});
