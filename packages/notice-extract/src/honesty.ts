import type { Notice } from './schema/notice';

export type GuardRule = 'form28_no_line_duty' | 'courier_importer_is_courier' | 'form29_total_repeats_fee';
export type GuardRecord = { rule: GuardRule; path: string; action: 'cleared' | 'flagged'; modelValue?: string | null };

/** Trimmed, case-folded string equality. Used only to compare; nothing folded is written back. */
const same = (a: string | null, b: string | null) => a !== null && b !== null && a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Rules that the notice kind itself fixes, checked on strings after validation. Pure: returns a copy and
 * the records. It clears a Form 28 line duty (none is printed) and otherwise only sets needs_confirmation.
 */
export function applyHonesty(input: Notice): { notice: Notice; records: GuardRecord[] } {
  const notice = structuredClone(input);
  const records: GuardRecord[] = [];
  const flag = (rule: GuardRule, path: string, leaf: { needs_confirmation?: boolean }) => {
    leaf.needs_confirmation = true;
    records.push({ rule, path, action: 'flagged' });
  };

  if (notice.kind === 'cbp_form_28') {
    notice.lines.forEach((line, i) => {
      if (line.dutyStated.value === null) return;
      records.push({ rule: 'form28_no_line_duty', path: `lines[${i}].dutyStated`, action: 'cleared', modelValue: line.dutyStated.value });
      line.dutyStated.value = null;
    });
  } else if (notice.kind === 'courier_duty_invoice') {
    const { importer, courier } = notice;
    if (same(importer.name.value, courier.name.value) || same(importer.address.value, courier.name.value)) {
      flag('courier_importer_is_courier', 'importer.name', importer.name);
      flag('courier_importer_is_courier', 'importer.address', importer.address);
    }
  } else {
    notice.statedTotals.forEach((total, j) => {
      const repeats = notice.fees.some((fee) => total.stated.value !== null && fee.stated.value === total.stated.value && same(fee.name.value, total.name.value));
      if (!repeats) return;
      flag('form29_total_repeats_fee', `statedTotals[${j}].name`, total.name);
      flag('form29_total_repeats_fee', `statedTotals[${j}].stated`, total.stated);
    });
  }
  return { notice, records };
}
