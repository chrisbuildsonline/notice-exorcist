import type { Fig, Prov } from '@notice-exorcist/duty-engine';
import type { FigureJson } from './assess';

/**
 * The calculation drawer's trail for one computed figure, read from duty-engine's provenance record.
 * Nothing here is computed: every value is an engine input or result with its own provenance.
 * Money stays a decimal string; only <Figure> formats it.
 */

/** An engine input. `money` is drawn by <Figure>; a rate or quantity is shown as `text`, verbatim. */
export type CalcInput = FigureJson & { key: string; label: string; kind: 'money' | 'rate' | 'quantity'; text?: string };

export type Token = { t: 'text'; s: string } | { t: 'input'; key: string };

export type Calc = {
  formulaId: string;
  /** The formula in words, e.g. "duty = entered value × rate". */
  formula: string;
  /** The same formula with the inputs in place. */
  substitution: Token[];
  /** The rate the formula applied, verbatim, and where that rate text came from. */
  rate: { text: string; prov: 'stated' | 'tariff'; source: string; href?: string } | null;
  rounding: string;
  inputs: CalcInput[];
  result: FigureJson;
};

const LABELS: Record<string, string> = {
  enteredValue: 'Entered value',
  percent: 'Rate',
  ratePercent: 'Fee rate',
  quantity: 'Quantity',
  centsPerUnit: 'Rate per unit',
  dollarsPerUnit: 'Rate per unit',
  minimum: 'Minimum',
  maximum: 'Maximum',
  stated: 'Notice says',
  computed: 'Recomputed',
};

const RATE_KEYS = ['percent', 'ratePercent', 'centsPerUnit', 'dollarsPerUnit'];

const FORMULAS: Record<string, { formula: string; keys: Array<string | [string]> }> = {
  'line.free': { formula: 'duty = entered value × rate (Free)', keys: [['enteredValue'], ' × 0'] },
  'line.ad_valorem': { formula: 'duty = entered value × rate', keys: [['enteredValue'], ' × ', ['percent']] },
  'line.specific': { formula: 'duty = quantity × rate per unit', keys: [['quantity'], ' × ', ['perUnit']] },
  'line.compound': {
    formula: 'duty = quantity × rate per unit + entered value × rate',
    keys: [['quantity'], ' × ', ['perUnit'], ' + ', ['enteredValue'], ' × ', ['percent']],
  },
  'fee.mpf': {
    formula: 'fee = entered value × rate, at least the minimum and at most the maximum',
    keys: [['enteredValue'], ' × ', ['ratePercent'], ', between ', ['minimum'], ' and ', ['maximum']],
  },
  'fee.hmf': { formula: 'fee = entered value × rate', keys: [['enteredValue'], ' × ', ['ratePercent']] },
  'compare.difference': { formula: 'difference = notice says − recomputed', keys: [['stated'], ' − ', ['computed']] },
};

const ROUNDING = { 'half-up-cents-once': 'half-up to cents, once', none: 'none, a sum of figures already rounded' } as const;

/** A human source for a provenance record, and the link to it when there is one. */
function sourceOf(p: Prov): { source: string; href?: string } {
  if (p.kind === 'stated') return { source: p.source };
  if (p.kind === 'computed') return { source: `duty-engine ${p.formulaId}${p.rateText ? ` at ${p.rateText}` : ''}` };
  if ('hts' in p) return { source: `HTS ${p.hts}, ${p.edition}`, href: p.source };
  const t = p.feeTable;
  return { source: `${t.sourceName} (${t.effectiveFrom} to ${t.effectiveTo})`, href: p.source };
}

function inputOf(key: string, f: Fig, label: string): CalcInput {
  const value = f.value.toString();
  const { source } = sourceOf(f.prov);
  const base = { key, label, value, prov: f.prov.kind, source };
  if (key === 'percent' || key === 'ratePercent') return { ...base, kind: 'rate', text: `${value}%` };
  if (key === 'centsPerUnit') return { ...base, kind: 'rate', text: `${value}¢` };
  // A per-unit rate can have more than 2 decimals: it is quoted, not drawn as money.
  if (key === 'dollarsPerUnit') return { ...base, kind: 'rate', text: `$${value}` };
  if (key === 'quantity') return { ...base, kind: 'quantity', text: value };
  return { ...base, kind: 'money' };
}

/**
 * The trail behind a computed figure. `labels` names the parts of a total (inputs "0", "1", …) in order.
 * Throws for a stated or tariff figure: those have no calculation to show.
 */
export function calcOf(fig: Fig, labels: string[] = []): Calc {
  const p = fig.prov;
  if (p.kind !== 'computed') throw new Error(`calcOf: figure is ${p.kind}, not computed`);
  const inputs = Object.entries(p.inputs).map(([k, f]) => inputOf(k, f, LABELS[k] ?? labels[Number(k)] ?? `Part ${Number(k) + 1}`));
  const perUnit = inputs.find((i) => i.key === 'centsPerUnit' || i.key === 'dollarsPerUnit')?.key ?? 'perUnit';

  const known = FORMULAS[p.formulaId];
  const substitution: Token[] = known
    ? known.keys.map((k) => (typeof k === 'string' ? { t: 'text', s: k } : { t: 'input', key: k[0] === 'perUnit' ? perUnit : k[0] }))
    : inputs.flatMap((i, n) => [...(n ? [{ t: 'text' as const, s: ' + ' }] : []), { t: 'input' as const, key: i.key }]);
  const formula = known?.formula ?? (p.formulaId === 'total.sum' ? 'total = the sum of the checked lines' : p.formulaId);

  const rateFig = RATE_KEYS.map((k) => p.inputs[k]).find((f) => f !== undefined);
  const ratePercent = p.inputs.ratePercent;
  const rate =
    rateFig && rateFig.prov.kind !== 'computed'
      ? { text: p.rateText ?? `${ratePercent?.value.toString() ?? rateFig.value.toString()}%`, prov: rateFig.prov.kind, ...sourceOf(rateFig.prov) }
      : null;

  return {
    formulaId: p.formulaId,
    formula,
    substitution,
    rate,
    rounding: ROUNDING[p.rounding],
    inputs,
    result: { value: fig.value.toString(), prov: 'computed', ...sourceOf(p) },
  };
}
