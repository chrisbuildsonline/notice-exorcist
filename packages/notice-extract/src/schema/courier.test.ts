import { describe, expect, it } from 'vitest';
import { leafTree } from '../test/zod-tree';
import { loadTruth, wrapTruth } from '../test/wrap';
import { Courier } from './courier';

const sample = () => wrapTruth(loadTruth('specimen-3-courier')) as Record<string, any>;

describe('courier duty invoice schema', () => {
  it('parses a valid sample (the courier specimen wrapped in stated fields)', () => {
    const r = Courier.safeParse(sample());
    expect(r.error?.issues).toBeUndefined();
  });

  it('requires the courier block, and keeps courier_fee and mpf fees as stated', () => {
    expect(Courier.safeParse({ ...sample(), courier: null }).success).toBe(false);
    const s = sample();
    expect(s.fees.map((f: any) => f.kind.value)).toEqual(['mpf', 'courier_fee']);
    s.fees[1].stated.value = '18';
    expect(Courier.safeParse(s).success).toBe(false);
  });

  it('stores a printed total as a stated total, value untouched', () => {
    const r = Courier.parse(sample());
    expect(r.statedTotals.map((t) => [t.name.value, t.stated.value, t.stated.prov.kind])).toEqual([
      ['Total entered value', '2180.00', 'stated'],
      ['Total payable', '175.29', 'stated'],
    ]);
  });

  it('key list: only fields printed on the document, no recomputed total or oracle key', () => {
    expect([...leafTree(Courier).keys()].sort()).toMatchInlineSnapshot(`
      [
        "courier.invoiceNumber",
        "courier.name",
        "courier.waybill",
        "dates.entry",
        "dates.notice",
        "dates.responseDeadline",
        "entryNumber",
        "fees[].kind",
        "fees[].name",
        "fees[].stated",
        "importer.address",
        "importer.name",
        "informationRequested[]",
        "kind",
        "lines[].description",
        "lines[].dutyStated",
        "lines[].hts",
        "lines[].n",
        "lines[].quantity",
        "lines[].rateText",
        "lines[].unit",
        "lines[].value",
        "noticeType",
        "port",
        "statedTotals[].name",
        "statedTotals[].stated",
      ]
    `);
  });
});
