import { describe, expect, it } from 'vitest';
import { buildPrompt, retryNote } from './prompt';
import { Form28 } from './schema/form28';
import { Form29 } from './schema/form29';
import { Courier } from './schema/courier';
import { z } from 'zod';
import { datesSchema, feeSchema, headerShape, lineSchema } from './schema/base';
import { type LeafFn, ModelStated } from './schema/field';

const { system, user } = buildPrompt();
const all = `${system}\n${user}`;

/** Words that would ask the model to do arithmetic. The only allowed use is copying a printed total. */
const BANNED = /\b(total|totals|sum|sums|summing|add up|convert|conversion|percentage|approximate|approximately|calculate|compute|estimate|round)\b/i;
const ALLOWED = [/statedTotals/g, /printed totals?/gi];

describe('extraction prompt', () => {
  it('asks only for text: no arithmetic words beyond copying printed totals', () => {
    let text = all;
    for (const a of ALLOWED) text = text.replace(a, '');
    expect(text.match(BANNED)?.[0]).toBeUndefined();
    expect(all).toMatch(/printed total/i);
  });

  it('asks for amounts as digits with two decimals, no currency symbol, no thousands separator', () => {
    expect(all).toMatch(/two decimals/i);
    expect(all).toMatch(/no currency symbol/i);
    expect(all).toMatch(/no thousands separator/i);
  });

  it('includes the JSON shape and every top-level key of each notice kind', () => {
    for (const s of [Form28, Form29, Courier]) {
      for (const key of Object.keys(s.shape)) expect(all, key).toContain(`"${key}"`);
    }
    for (const kind of ['cbp_form_28', 'cbp_form_29', 'courier_duty_invoice', 'unknown']) expect(all).toContain(`"${kind}"`);
    expect(all).toContain('"confidence"');
    expect(all).toContain('"page"');
    expect(all).not.toContain('"prov"');
  });

  it('shows a line and a fee example in which every member is a schema-valid field object', () => {
    const L = ModelStated as unknown as LeafFn;
    const example = (label: string) => JSON.parse(new RegExp(`${label}[^\\n{]*\\n?(\\{.*\\})`).exec(user)?.[1] ?? 'null');
    expect(lineSchema(L, { dutyNullable: true }).safeParse(example('Example of one line object')).success).toBe(true);
    expect(feeSchema(L).safeParse(example('Example of one fee object')).success).toBe(true);
    expect(user).toMatch(/even when the document prints month\/day\/year/);
  });

  it('shows a schema-valid header example with a field object, not a bare null, for a field with no value', () => {
    const L = ModelStated as unknown as LeafFn;
    const header = z
      .object({ ...headerShape(L), actionType: L(z.null(), { nullable: true }), dates: datesSchema(L, { deadlineNullable: true }) })
      .strict();
    const example = JSON.parse(/Example of the header members[^\n{]*\n?(\{.*\})/.exec(user)?.[1] ?? 'null');
    expect(header.safeParse(example).success).toBe(true);
    expect(example.actionType.value).toBeNull();
    expect(user).toMatch(/never a bare string, number or null/);
  });

  it('the retry note carries the validation issues', () => {
    const note = retryNote([{ path: ['lines', 0, 'value', 'value'], message: 'Invalid string: must match pattern' }]);
    expect(note).toContain('lines.0.value.value');
    expect(note).toContain('must match pattern');
    expect(note).toMatch(/JSON/);
    expect(note).toMatch(/every F is a field object/i);
    expect(note.replace('lines.0.value.value', '').match(BANNED)?.[0]).toBeUndefined();
  });
});
