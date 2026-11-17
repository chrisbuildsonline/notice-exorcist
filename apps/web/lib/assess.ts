import {
  compareFigures,
  computeHmf,
  computeLineDuty,
  computeMpf,
  computeTotal,
  type DutyResult,
  FEE_TABLE,
  type FeeResult,
  type Fig,
  makeFig,
  parseRateText,
  type StatedProv,
} from '@notice-exorcist/duty-engine';
import type { ExtractOk } from '@notice-exorcist/notice-extract';
import { type Calc, calcOf } from './calc';
import { fogOpacity, lineState, type LineState, noticeStatus, type NoticeStatus } from './states';

/** A figure as the API sends it: decimal string, provenance kind and a human source. */
export type FigureJson = { value: string; prov: 'stated' | 'computed' | 'tariff'; source: string };

/** A field the reader was unsure of (low confidence or an honesty rule). The user confirms or corrects it. */
export type Flag = { path: string; label: string; read: string | null; source: string };

export type AssessedLine = {
  label: string;
  state: LineState;
  stated: FigureJson | null;
  computed: FigureJson | null;
  difference: FigureJson | null;
  description: string | null;
  hts: string | null;
  rateText: string | null;
  /** Flagged inputs of this line. While any is left, the line is not calculated. */
  confirm: Flag[];
  /** How the engine computed this line (the calculation drawer), or null when it did not. */
  calc: Calc | null;
};

/**
 * The notice's printed total next to the engine's recomputation of the same total.
 * A flagged printed total is never shown as the total (statedTotal null, flagged true).
 */
export type Totals = {
  name: string | null;
  statedTotal: FigureJson | null;
  computedTotal: FigureJson | null;
  difference: FigureJson | null;
  flagged: boolean;
  /** The engine's sum behind computedTotal, each part labelled with its line. */
  calc: Calc | null;
};

export type Assessment = {
  lines: AssessedLine[];
  status: NoticeStatus;
  atStake: FigureJson | null;
  fog: number;
  totals: Totals;
  /** Flagged fields that belong to no line (header, totals). */
  flags: Flag[];
};

type Leaf<T> = { value: T | null; prov: StatedProv; needs_confirmation?: boolean };
type AnyLeaf = Leaf<unknown>;

export function figJson(f: Fig): FigureJson {
  const p = f.prov;
  const source =
    p.kind === 'computed' ? `duty-engine ${p.formulaId}${p.rateText ? ` at ${p.rateText}` : ''}` : p.source;
  return { value: f.value.toString(), prov: p.kind, source };
}

const stated = (leaf: Leaf<string>): Fig | null => (leaf.value === null ? null : makeFig(leaf.value, leaf.prov));
const asPart = (fee: Fig): FeeResult => ({ status: 'ok', fee, unrounded: fee.value, formulaId: 'notice.total' });

const isLeaf = (v: unknown): v is AnyLeaf => !!v && typeof v === 'object' && !Array.isArray(v) && 'value' in v && 'prov' in v;

/** Every stated field with its path (`lines[0].rateText`), as notice-extract names them. */
function leaves(v: unknown, path = '', out: Array<[string, AnyLeaf]> = []): Array<[string, AnyLeaf]> {
  if (isLeaf(v)) out.push([path, v]);
  else if (Array.isArray(v)) v.forEach((x, i) => leaves(x, `${path}[${i}]`, out));
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) leaves(x, path ? `${path}.${k}` : k, out);
  return out;
}

const LABELS: Record<string, string> = {
  value: 'Entered value', quantity: 'Quantity', unit: 'Unit', rateText: 'Rate', dutyStated: 'Duty', hts: 'HTS code',
  description: 'Description', n: 'Line number', kind: 'Fee type', noticeType: 'Notice type', entryNumber: 'Entry number',
  port: 'Port', entry: 'Entry date', notice: 'Notice date', responseDeadline: 'Respond by', invoiceNumber: 'Invoice number',
  waybill: 'Waybill', actionType: 'Action', address: 'Address', name: 'Name',
};

function labelOf(path: string, r: ExtractOk): string {
  const n = r.notice;
  const total = /^statedTotals\[(\d+)\]\.stated$/.exec(path);
  if (total && n.kind !== 'cbp_form_28') return n.statedTotals[Number(total[1])]?.name.value ?? 'Total';
  if (/^statedTotals\[\d+\]\.name$/.test(path)) return 'Name of printed total';
  const fee = /^fees\[(\d+)\]\.stated$/.exec(path);
  if (fee && n.kind !== 'cbp_form_28') return n.fees[Number(fee[1])]?.name.value ?? 'Fee';
  const party = /^(importer|courier)\.(\w+)$/.exec(path);
  if (party) return `${party[1] === 'importer' ? 'Importer' : 'Courier'} ${(LABELS[party[2]!] ?? party[2]!).toLowerCase()}`;
  const last = /(\w+)$/.exec(path)![1]!;
  return LABELS[last] ?? last;
}

type Internal = { line: AssessedLine; scope: 'duty' | 'fee'; stated: Fig | null; computed: Fig | null };

/**
 * Checks every figure the notice states (line duties and fees) with duty-engine.
 * Rates are the rate text printed on the notice; amount at stake is the engine total of the checked parts.
 * A line with a flagged input is not calculated until the user confirms it (R4.9).
 */
export function assess(r: ExtractOk): Assessment {
  const n = r.notice;
  const flagged = new Map(leaves(n).filter(([, l]) => l.needs_confirmation === true).map(([p, l]) => [p, l]));
  const flagsAt = (paths: string[]): Flag[] =>
    paths.flatMap((p) => {
      const l = flagged.get(p);
      return l ? [{ path: p, label: labelOf(p, r), read: l.value === null ? null : String(l.value), source: l.prov.source }] : [];
    });

  const items: Internal[] = [];
  const parts: Array<DutyResult | FeeResult> = [];
  const add = (scope: Internal['scope'], label: string, statedFig: Fig | null, confirm: Flag[], compute: () => DutyResult | FeeResult | null, extra: Pick<AssessedLine, 'description' | 'hts' | 'rateText'>) => {
    const result = confirm.length ? null : compute();
    const c = statedFig && result ? compareFigures(statedFig, result) : null;
    const computed = c && c.state !== 'unsupported' ? c.computed : null;
    items.push({
      scope,
      stated: statedFig,
      computed,
      line: {
        label,
        state: lineState({ comparison: c?.state ?? null, needsConfirmation: confirm.length > 0 }),
        stated: statedFig ? figJson(statedFig) : null,
        computed: computed ? figJson(computed) : null,
        difference: c?.state === 'disagrees' ? figJson(c.difference) : null,
        ...extra,
        confirm,
        calc: computed ? calcOf(computed) : null,
      },
    });
  };

  let totals: Totals = { name: null, statedTotal: null, computedTotal: null, difference: null, flagged: false, calc: null };

  if (n.kind !== 'cbp_form_28') {
    n.lines.forEach((l, i) => {
      const value = stated(l.value);
      const confirm = flagsAt(['value', 'quantity', 'unit', 'rateText', 'dutyStated'].map((k) => `lines[${i}].${k}`));
      add('duty', `Line ${l.n.value ?? '?'} · ${l.description.value ?? 'duty'}`, stated(l.dutyStated), confirm, () => {
        if (!value || l.rateText.value === null) return null;
        const result = computeLineDuty({
          rate: parseRateText(l.rateText.value),
          rateProv: l.rateText.prov,
          enteredValue: value,
          quantity: l.quantity.value !== null && l.unit.value !== null ? { value: makeFig(l.quantity.value, l.quantity.prov), unit: l.unit.value } : undefined,
        });
        parts.push(result);
        return result;
      }, { description: l.description.value, hts: l.hts.value, rateText: l.rateText.value });
    });

    const tvIndex = n.statedTotals.findIndex((t) => t.name.value === 'Total entered value');
    const totalValue = n.statedTotals[tvIndex];
    const entered = totalValue ? stated(totalValue.stated) : null;
    const entryDate = n.dates.entry.value;
    n.fees.forEach((f, i) => {
      const confirm = flagsAt([`fees[${i}].stated`, `fees[${i}].kind`, ...(tvIndex >= 0 ? [`statedTotals[${tvIndex}].stated`] : []), 'dates.entry']);
      add('fee', f.name.value ?? 'Fee', stated(f.stated), confirm, () => {
        if (f.kind.value === 'courier_fee') return { status: 'unsupported', reason: 'no_fee_table_for_date' };
        if (!entered || !entryDate) return null;
        const input = { enteredValue: entered, entryDate, table: FEE_TABLE, applies: true };
        const result = f.kind.value === 'mpf' ? computeMpf(input) : computeHmf({ ...input, ocean: true });
        parts.push(result);
        return result;
      }, { description: null, hts: null, rateText: null });
    });

    // The printed total, and the engine's sum of the same lines: duty lines for a duty total, every line otherwise.
    // Lines the engine cannot check count as stated; a line not yet calculated leaves no recomputation.
    const pj = n.statedTotals.findLastIndex((t) => /total/i.test(t.name.value ?? '') && !/entered value/i.test(t.name.value ?? ''));
    const printed = n.statedTotals[pj];
    if (printed) {
      const name = printed.name.value;
      const isFlagged = flagged.has(`statedTotals[${pj}].stated`) || flagged.has(`statedTotals[${pj}].name`);
      const statedTotal = isFlagged ? null : stated(printed.stated);
      const scope = items.filter((it) => !/duty/i.test(name ?? '') || it.scope === 'duty');
      const figs = scope.map((it) => (it.line.state === 'unsupported' ? it.stated : it.computed));
      const sum = scope.length && figs.every((f): f is Fig => f !== null) ? computeTotal(figs.map(asPart)) : null;
      const computedTotal = sum?.status === 'ok' ? sum.total : null;
      const cmp = statedTotal && computedTotal ? compareFigures(statedTotal, { status: 'ok', total: computedTotal }) : null;
      totals = {
        name,
        statedTotal: statedTotal ? figJson(statedTotal) : null,
        computedTotal: computedTotal ? figJson(computedTotal) : null,
        difference: cmp?.state === 'disagrees' ? figJson(cmp.difference) : null,
        flagged: isFlagged,
        calc: computedTotal ? calcOf(computedTotal, scope.map((it) => it.line.label)) : null,
      };
    }
  }

  const lines = items.map((it) => it.line);
  const onLines = new Set(lines.flatMap((l) => l.confirm.map((f) => f.path)));
  const states = lines.map((l) => l.state);
  const total = parts.length > 0 ? computeTotal(parts) : null;
  return {
    lines,
    status: noticeStatus(states),
    atStake: total?.status === 'ok' ? figJson(total.total) : null,
    fog: fogOpacity(states),
    totals,
    flags: flagsAt([...flagged.keys()].filter((p) => !onLines.has(p))),
  };
}
