import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { markNeedsConfirmation } from './confidence';
import { applyHonesty } from './honesty';
import { isStatedLeaf } from './map/toSpecimen';
import { Notice } from './schema/notice';
import { loadTruth, wrapTruth } from './test/wrap';

/** A validated, confidence-marked notice built from a ground truth, editable in tests. */
const build = (id: string) => markNeedsConfirmation(Notice.parse(wrapTruth(loadTruth(id)))) as Record<string, any>;
const form28 = () => build('specimen-1-form28');
const form29 = () => build('specimen-2-form29');
const courier = () => build('specimen-3-courier');
const guard = (n: Record<string, any>) => applyHonesty(n as Notice) as { notice: Record<string, any>; records: unknown[] };
const field = (value: unknown) => ({ value, confidence: 0.95, page: 1, prov: { kind: 'stated', source: 'page 1' }, needs_confirmation: false });

/** Every stated leaf by path, in the same path form as fieldsNeedingConfirmation. */
function leaves(v: unknown, path = '', out = new Map<string, Record<string, unknown>>()) {
  if (isStatedLeaf(v)) out.set(path, v as Record<string, unknown>);
  else if (Array.isArray(v)) v.forEach((x, i) => leaves(x, `${path}[${i}]`, out));
  else if (v !== null && typeof v === 'object') for (const [k, x] of Object.entries(v)) leaves(x, path ? `${path}.${k}` : k, out);
  return out;
}

describe('form28_no_line_duty', () => {
  const withDuties = () => {
    const n = form28();
    n.lines[1].dutyStated = { ...field('210.60'), box: [1, 2, 3, 4], prov: { kind: 'stated', source: 'page 1, box 1,2,3,4' } };
    n.lines[2].dutyStated = field('171.75');
    return n;
  };

  it('clears a Form 28 line duty and records the path and the model value', () => {
    const { notice, records } = guard(withDuties());
    expect(notice.lines[1].dutyStated.value).toBeNull();
    expect(notice.lines[2].dutyStated.value).toBeNull();
    expect(records).toEqual([
      { rule: 'form28_no_line_duty', path: 'lines[1].dutyStated', action: 'cleared', modelValue: '210.60' },
      { rule: 'form28_no_line_duty', path: 'lines[2].dutyStated', action: 'cleared', modelValue: '171.75' },
    ]);
  });

  it('keeps confidence, page and box of the cleared field, and every other field deeply equal', () => {
    const input = withDuties();
    const { notice } = guard(input);
    expect(notice.lines[1].dutyStated).toEqual({ ...input.lines[1].dutyStated, value: null });
    expect(notice.lines[2].dutyStated).toEqual({ ...input.lines[2].dutyStated, value: null });
    const strip = (n: Record<string, any>) => ({ ...n, lines: n.lines.map(({ dutyStated: _d, ...rest }: Record<string, unknown>) => rest) });
    expect(strip(notice)).toEqual(strip(input));
    expect(Notice.safeParse(notice).success).toBe(true);
  });

  it('does not mutate its input', () => {
    const input = withDuties();
    const before = structuredClone(input);
    guard(input);
    expect(input).toEqual(before);
  });

  it('a Form 28 with every dutyStated null gives no record and an equal notice', () => {
    const input = form28();
    expect(input.lines.every((l: any) => l.dutyStated.value === null)).toBe(true);
    const { notice, records } = guard(input);
    expect(records).toEqual([]);
    expect(notice).toEqual(input);
  });

  it.each([['Form 29', form29], ['courier', courier]])('leaves a printed line duty on a %s alone', (_name, make) => {
    const input = make();
    input.lines[1].dutyStated = field('210.60');
    const { notice, records } = guard(input);
    expect(records).toEqual([]);
    expect(notice).toEqual(input);
  });
});

describe('courier_importer_is_courier', () => {
  const flagged = [
    { rule: 'courier_importer_is_courier', path: 'importer.name', action: 'flagged' },
    { rule: 'courier_importer_is_courier', path: 'importer.address', action: 'flagged' },
  ];

  it.each(['Tumbleweed Air Parcel', '  tumbleweed AIR parcel '])('importer name %j equal to the courier name flags name and address', (name) => {
    const input = courier();
    input.importer.name.value = name;
    input.importer.address.value = 'Customs brokerage desk';
    const { notice, records } = guard(input);
    expect(notice.importer.name).toEqual({ ...input.importer.name, needs_confirmation: true });
    expect(notice.importer.address).toEqual({ ...input.importer.address, needs_confirmation: true });
    expect(records).toEqual(flagged);
  });

  it('importer address equal to the courier name flags both fields', () => {
    const input = courier();
    input.importer.address.value = ' TUMBLEWEED Air Parcel';
    const { notice, records } = guard(input);
    expect(notice.importer.name.needs_confirmation).toBe(true);
    expect(notice.importer.address.needs_confirmation).toBe(true);
    expect(notice.importer.address.value).toBe(' TUMBLEWEED Air Parcel');
    expect(records).toEqual(flagged);
  });

  it('a different importer name leaves both fields as they are, with no record', () => {
    const input = courier();
    const { notice, records } = guard(input);
    expect(input.importer.name.value).not.toBe(input.courier.name.value);
    expect(records).toEqual([]);
    expect(notice).toEqual(input);
  });

  it.each([['Form 28', form28], ['Form 29', form29]])('does not fire on a %s', (_name, make) => {
    const input = make();
    input.importer.name.value = 'Tumbleweed Air Parcel';
    input.importer.address.value = 'Tumbleweed Air Parcel';
    const { notice, records } = guard(input);
    expect(records).toEqual([]);
    expect(notice).toEqual(input);
  });
});

describe('form29_total_repeats_fee', () => {
  const withRow = (name: string, stated: string) => {
    const n = form29();
    n.statedTotals.push({ name: field(name), stated: field(stated) });
    return n;
  };

  it('a total that repeats a fee row by name and amount is flagged and kept', () => {
    const input = withRow('Merchandise Processing Fee', '44.50');
    const { notice, records } = guard(input);
    expect(notice.statedTotals).toHaveLength(input.statedTotals.length);
    expect(notice.statedTotals[2].name).toEqual({ ...input.statedTotals[2].name, needs_confirmation: true });
    expect(notice.statedTotals[2].stated).toEqual({ ...input.statedTotals[2].stated, needs_confirmation: true });
    expect(records).toEqual([
      { rule: 'form29_total_repeats_fee', path: 'statedTotals[2].name', action: 'flagged' },
      { rule: 'form29_total_repeats_fee', path: 'statedTotals[2].stated', action: 'flagged' },
    ]);
  });

  it('the name comparison ignores case and surrounding spaces', () => {
    const { records } = guard(withRow(' merchandise processing FEE ', '44.50'));
    expect(records).toHaveLength(2);
  });

  it.each([
    ['same name, different amount', 'Merchandise Processing Fee', '44.51'],
    ['same amount, different name', 'Harbor Maintenance Fee', '44.50'],
    ['same amount written differently', 'Merchandise Processing Fee', '044.50'],
    ['a real total', 'Total Duty and Fees', '692.86'],
  ])('%s is not flagged', (_case, name, stated) => {
    const input = withRow(name, stated);
    const { notice, records } = guard(input);
    expect(records).toEqual([]);
    expect(notice).toEqual(input);
  });

  it.each([['Form 28', form28], ['courier', courier]])('does not fire on a %s', (_name, make) => {
    const input = make();
    input.fees = [{ name: field('Merchandise Processing Fee'), kind: field('mpf'), stated: field('44.50') }];
    input.statedTotals = [{ name: field('Merchandise Processing Fee'), stated: field('44.50') }];
    const { notice, records } = guard(input);
    expect(records).toEqual([]);
    expect(notice).toEqual(input);
  });
});

describe('applyHonesty properties', () => {
  const money = fc.oneof(fc.constant(null), fc.constantFrom('210.60', '171.75', '44.50', '0.00'));
  const name = fc.constantFrom('Tumbleweed Air Parcel', ' tumbleweed air parcel', 'Marigold Thimble Studio', 'Merchandise Processing Fee', 'Total duty');
  const arb = fc.record({
    kind: fc.constantFrom(form28, form29, courier),
    duties: fc.array(money, { minLength: 3, maxLength: 3 }),
    importer: name,
    address: name,
    total: fc.option(fc.record({ name, stated: fc.constantFrom('44.50', '7.55', '648.36') })),
    flags: fc.array(fc.boolean(), { minLength: 40, maxLength: 40 }),
  });
  const make = ({ kind, duties, importer, address, total, flags }: typeof arb extends fc.Arbitrary<infer T> ? T : never) => {
    const n = kind();
    n.lines.forEach((l: any, i: number) => {
      const d = duties[i % duties.length];
      if (n.kind === 'cbp_form_28' || d !== null) l.dutyStated.value = d;
    });
    n.importer.name.value = importer;
    n.importer.address.value = address;
    if (total) n.statedTotals.push({ name: field(total.name), stated: field(total.stated) });
    [...leaves(n).values()].forEach((leaf, i) => (leaf.needs_confirmation = flags[i % flags.length]));
    return n;
  };
  const params = { seed: 20261117, numRuns: 300 } as const;

  it('is idempotent', () => {
    fc.assert(
      fc.property(arb, (a) => {
        const once = guard(make(a)).notice;
        expect(guard(once).notice).toEqual(once);
      }),
      params,
    );
  });

  it('changes no value except at cleared paths, never lowers needs_confirmation, and flags every flagged path', () => {
    fc.assert(
      fc.property(arb, (a) => {
        const input = make(a);
        const { notice, records } = applyHonesty(input as Notice);
        const cleared = new Set(records.filter((r) => r.action === 'cleared').map((r) => r.path));
        const before = leaves(input);
        const after = leaves(notice);
        expect([...after.keys()]).toEqual([...before.keys()]);
        for (const [path, leaf] of after) {
          const old = before.get(path)!;
          if (cleared.has(path)) expect(leaf.value).toBeNull();
          else expect(leaf.value, path).toStrictEqual(old.value);
          if (old.needs_confirmation) expect(leaf.needs_confirmation, path).toBe(true);
          expect({ ...leaf, value: null, needs_confirmation: null }).toEqual({ ...old, value: null, needs_confirmation: null });
        }
        for (const r of records) if (r.action === 'flagged') expect(after.get(r.path)?.needs_confirmation, r.path).toBe(true);
        expect(JSON.stringify(notice)).not.toContain('computed');
        expect(Notice.safeParse(notice).success).toBe(true);
      }),
      params,
    );
  });
});
