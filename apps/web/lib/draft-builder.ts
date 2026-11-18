import type { AssessedLine, FigureJson } from './assess';
import { type Citation, citeToken, type DraftContent, figToken, type ProvRef, segments } from './draft';
import type { NoticeView } from './notice-view';
import type { HtsCandidate, RulingRef } from './tariff';

/**
 * Builds the reply draft from provenance records. Structure, figures and citations come from code:
 * a figure is a `{{fig:id}}` token for a record the assessment already holds, never digits. Rate text and HTS
 * codes are quoted verbatim from their records. A model may only rephrase the connective slots (`opening`,
 * `closing`), and a slot with any digit outside a known token is rejected.
 */

export type LineTariff = { candidates: HtsCandidate[]; rulings: RulingRef[] } | null;

export type Phrasing = { opening?: string; closing?: string };

export class PhrasingRejected extends Error {
  constructor(readonly slot: string, reason: string) {
    super(`phrasing rejected (${slot}): ${reason}`);
    this.name = 'PhrasingRejected';
  }
}

const DEFAULTS: Required<Phrasing> = {
  opening: 'We checked each figure on the notice against the values and rates it prints.',
  closing: 'We ask that you review the lines above and either issue a corrected notice or explain how the notice figures were reached. The calculation trail for each line is attached.',
};

const NAMES: Record<string, string> = {
  cbp_form_28: 'Request for Information (CBP Form 28)',
  cbp_form_29: 'Notice of Action (CBP Form 29)',
  courier_duty_invoice: 'duty invoice',
};

/** A reply makes sense once a line disagrees with duty-engine and no flagged value is waiting for the user. */
export function canDraft(v: NoticeView): boolean {
  const a = v.assessment;
  return !!a && a.flags.length === 0 && !a.lines.some((l) => l.state === 'confirm') && a.lines.some((l) => l.state === 'disagrees');
}

/** Validates model phrasing: known slots only, strings, one line, no digit and no token except a known figure. */
function checkPhrasing(raw: unknown, figureIds: Set<string>): Phrasing {
  if (raw === undefined) return {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new PhrasingRejected('*', 'not an object');
  const out: Phrasing = {};
  for (const [slot, value] of Object.entries(raw)) {
    if (slot !== 'opening' && slot !== 'closing') throw new PhrasingRejected(slot, 'unknown slot');
    if (typeof value !== 'string' || !value.trim() || value.length > 600 || /[\r\n]/.test(value)) throw new PhrasingRejected(slot, 'not one line of text');
    for (const s of segments(value)) {
      if (s.t === 'cite' || (s.t === 'fig' && !figureIds.has(s.id))) throw new PhrasingRejected(slot, 'unknown token');
      if (s.t === 'text' && (/\d/.test(s.s) || /\{\{|\}\}/.test(s.s))) throw new PhrasingRejected(slot, 'bare number outside a token');
    }
    out[slot] = value.trim();
  }
  return out;
}

export type Skipped = { label: string; reason: string };

/**
 * R5.10: the lines the draft makes no claim about because the engine could not check them, with why. Kept apart
 * from the draft content, so it is not hashed and cannot affect approval.
 */
export function skippedLines(v: NoticeView): Skipped[] {
  return (v.assessment?.lines ?? [])
    .filter((l) => l.state === 'unsupported')
    .map((l) => ({ label: l.label, reason: l.rateText ? 'duty-engine cannot check its rate' : 'duty-engine has no fee table for it' }));
}

/** "Line 1 · Cotton towels" -> "Line 1 (Cotton towels)". */
const lineName = (l: AssessedLine) => {
  const [head, ...rest] = l.label.split(' · ');
  return rest.length ? `${head} (${rest.join(' · ')})` : l.label;
};

/**
 * The draft for a notice. `tariff[i]` is the HTS candidates and CROSS rulings found for line i, or null when
 * the tariff index is not built. Throws when there is nothing to dispute, or when `phrasing` is rejected.
 */
export function buildDraft(v: NoticeView, tariff: LineTariff[], phrasing?: unknown): DraftContent {
  const a = v.assessment;
  if (!a || !canDraft(v)) throw new Error('nothing to dispute: no line disagrees with duty-engine, or a value still needs confirming');

  const figures: ProvRef[] = [];
  const fig = (id: string, f: FigureJson) => {
    if (!figures.some((x) => x.id === id)) figures.push({ id, value: f.value, prov: f.prov, source: f.source });
    return figToken(id);
  };
  const citations: Citation[] = [];
  const cite = (c: Omit<Citation, 'id'>) => {
    const have = citations.find((x) => x.kind === c.kind && x.label === c.label);
    if (have) return citeToken(have.id);
    const id = `c${citations.length + 1}`;
    citations.push({ id, ...c });
    return citeToken(id);
  };
  const box = (source: string) => cite({ kind: 'notice', label: `Notice, ${source}` });

  // The figure ids a slot may quote are the ones the code places below, so collect the paragraphs first.
  const body: string[] = [];
  a.lines.forEach((l, i) => {
    if (l.state !== 'disagrees' || !l.stated || !l.computed || !l.difference || !l.calc) return;
    const key = `line${i + 1}`;
    const parts = [`${lineName(l)}: the notice states ${l.calc.formulaId.startsWith('fee.') ? 'a fee' : 'duty'} of ${fig(`${key}.stated`, l.stated)}${box(l.stated.source)}.`];
    const entered = l.calc.inputs.find((x) => x.key === 'enteredValue' && x.kind === 'money');
    const rate = l.calc.rate;
    const basis = rate
      ? `the ${rate.text} rate ${rate.prov === 'stated' ? `printed on the notice${box(rate.source)}` : `in the tariff${cite({ kind: 'hts', label: rate.source, ...(rate.href ? { href: rate.href } : {}) })}`}`
      : 'the published fee table';
    parts.push(
      entered
        ? `Applying ${basis} to the entered value of ${fig(`${key}.enteredValue`, entered)} gives ${fig(`${key}.computed`, l.computed)}, a difference of ${fig(`${key}.difference`, l.difference)}.`
        : `Duty-engine recomputes it from ${basis} as ${fig(`${key}.computed`, l.computed)}, a difference of ${fig(`${key}.difference`, l.difference)}.`,
    );
    const t = tariff[i];
    const printed = t?.candidates.find((c) => c.printed);
    if (printed) {
      const href = `https://hts.usitc.gov/search?query=${encodeURIComponent(printed.code)}`;
      parts.push(`The ${printed.edition} lists a general rate of ${printed.rate} for HTS ${printed.code}${cite({ kind: 'hts', label: `HTS ${printed.code} · ${printed.rate} · ${printed.edition}`, href })}.`);
    }
    const ruling = t?.rulings[0];
    if (ruling) parts.push(`CROSS ruling ${ruling.number} may be relevant to these goods${cite({ kind: 'ruling', label: `CROSS ${ruling.number} · ${ruling.title}`, href: ruling.url })}.`);
    body.push(parts.join(' '));
  });

  const t = a.totals;
  if (t.statedTotal && t.computedTotal && t.difference) {
    const name = t.name ? ` as the ${t.name.toLowerCase()}` : '';
    body.push(
      `In total, the notice states ${fig('total.stated', t.statedTotal)}${name}${box(t.statedTotal.source)}, while the checked lines add up to ${fig('total.computed', t.computedTotal)}, a difference of ${fig('total.difference', t.difference)}.`,
    );
  }

  const p = { ...DEFAULTS, ...checkPhrasing(phrasing, new Set(figures.map((f) => f.id))) };
  const name = NAMES[v.kind ?? ''] ?? 'notice';
  const entry = v.header?.entryNumber;
  const opening = `We are writing about the ${name}${entry ? ` for entry ${entry}` : ''}${cite({ kind: 'notice', label: `${v.title}${entry ? `, entry ${entry}` : ''}` })}. ${p.opening}`;

  // The opening cites the notice first, so number the citations in order of first use.
  const paragraphs = [v.kind === 'courier_duty_invoice' ? 'Hello,' : 'Dear Officer,', opening, ...body, p.closing];
  const order = [...new Set(paragraphs.flatMap((x) => segments(x).flatMap((s) => (s.t === 'cite' ? [s.id] : []))))];
  const rename = new Map(order.map((id, n) => [id, `c${n + 1}`]));
  return {
    paragraphs: paragraphs.map((x) => x.replace(/\{\{cite:(c\d+)\}\}/g, (_m, id: string) => citeToken(rename.get(id)!))),
    figures,
    citations: order.map((id) => ({ ...citations.find((c) => c.id === id)!, id: rename.get(id)! })),
  };
}
