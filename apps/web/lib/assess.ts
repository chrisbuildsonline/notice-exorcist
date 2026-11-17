import {
  compareFigures,
  computeHmf,
  computeLineDuty,
  computeMpf,
  computeTotal,
  type Comparison,
  type DutyResult,
  FEE_TABLE,
  type FeeResult,
  type Fig,
  makeFig,
  parseRateText,
  type StatedProv,
} from '@notice-exorcist/duty-engine';
import type { ExtractOk } from '@notice-exorcist/notice-extract';
import { fogOpacity, lineState, type LineState, noticeStatus, type NoticeStatus } from './states';

/** A figure as the API sends it: decimal string, provenance kind and a human source. */
export type FigureJson = { value: string; prov: 'stated' | 'computed' | 'tariff'; source: string };

export type AssessedLine = {
  label: string;
  state: LineState;
  stated: FigureJson | null;
  computed: FigureJson | null;
  difference: FigureJson | null;
};

export type Assessment = { lines: AssessedLine[]; status: NoticeStatus; atStake: FigureJson | null; fog: number };

type Leaf<T> = { value: T | null; prov: StatedProv; needs_confirmation?: boolean };

export function figJson(f: Fig): FigureJson {
  const p = f.prov;
  const source =
    p.kind === 'computed' ? `duty-engine ${p.formulaId}${p.rateText ? ` at ${p.rateText}` : ''}` : p.source;
  return { value: f.value.toString(), prov: p.kind, source };
}

const stated = (leaf: Leaf<string>): Fig | null => (leaf.value === null ? null : makeFig(leaf.value, leaf.prov));
const flagged = (...leaves: Array<Leaf<unknown> | undefined>) => leaves.some((l) => l?.needs_confirmation === true);

function line(label: string, statedFig: Fig | null, result: DutyResult | FeeResult | null, needsConfirmation: boolean): AssessedLine {
  const c: Comparison | null = statedFig && result ? compareFigures(statedFig, result) : null;
  return {
    label,
    state: lineState({ comparison: c?.state ?? null, needsConfirmation }),
    stated: statedFig ? figJson(statedFig) : null,
    computed: c && c.state !== 'unsupported' ? figJson(c.computed) : null,
    difference: c?.state === 'disagrees' ? figJson(c.difference) : null,
  };
}

/**
 * Checks every figure the notice states (line duties and fees) with duty-engine.
 * Rates are the rate text printed on the notice; amount at stake is the engine total of the checked parts.
 */
export function assess(r: ExtractOk): Assessment {
  const n = r.notice;
  const lines: AssessedLine[] = [];
  const parts: Array<DutyResult | FeeResult> = [];

  if (n.kind !== 'cbp_form_28') {
    for (const l of n.lines) {
      const value = stated(l.value);
      const duty = stated(l.dutyStated);
      const inputsFlagged = flagged(l.value, l.quantity, l.unit, l.rateText, l.dutyStated);
      let result: DutyResult | null = null;
      if (value && l.rateText.value !== null) {
        result = computeLineDuty({
          rate: parseRateText(l.rateText.value),
          rateProv: l.rateText.prov,
          enteredValue: value,
          quantity: l.quantity.value !== null && l.unit.value !== null ? { value: makeFig(l.quantity.value, l.quantity.prov), unit: l.unit.value } : undefined,
        });
        parts.push(result);
      }
      lines.push(line(`Line ${l.n.value ?? '?'} · ${l.description.value ?? 'duty'}`, duty, result, inputsFlagged));
    }

    const totalValue = n.statedTotals.find((t) => t.name.value === 'Total entered value');
    const entered = totalValue ? stated(totalValue.stated) : null;
    const entryDate = n.dates.entry.value;
    for (const f of n.fees) {
      const label = f.name.value ?? 'Fee';
      let result: FeeResult | null = null;
      if (f.kind.value === 'courier_fee') result = { status: 'unsupported', reason: 'no_fee_table_for_date' };
      else if (entered && entryDate) {
        const input = { enteredValue: entered, entryDate, table: FEE_TABLE, applies: true };
        result = f.kind.value === 'mpf' ? computeMpf(input) : computeHmf({ ...input, ocean: true });
        parts.push(result);
      }
      lines.push(line(label, stated(f.stated), result, flagged(f.stated, f.kind, totalValue?.stated, n.dates.entry)));
    }
  }

  const states = lines.map((l) => l.state);
  const total = parts.length > 0 ? computeTotal(parts) : null;
  return {
    lines,
    status: noticeStatus(states),
    atStake: total?.status === 'ok' ? figJson(total.total) : null,
    fog: fogOpacity(states),
  };
}
