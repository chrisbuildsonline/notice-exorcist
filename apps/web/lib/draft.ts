import type { FigureJson } from './assess';

/** A figure the draft quotes: a snapshot of a provenance record from duty-engine or the notice, by id. */
export type ProvRef = FigureJson & { id: string };

/** What a claim cites: an HTS line, a CROSS ruling or a box on the notice. */
export type Citation = { id: string; kind: 'hts' | 'ruling' | 'notice'; label: string; href?: string };

/**
 * The reply text. Each paragraph is plain text with tokens: `{{fig:<id>}}` draws the figure with that id,
 * `{{cite:<id>}}` a citation chip. No figure is ever written as digits.
 */
export type DraftContent = { paragraphs: string[]; figures: ProvRef[]; citations: Citation[] };

/** A stored draft as the API and the page see it. `state` and `hash` are derived on the server from the stored record. */
export type DraftView = DraftContent & { id: string; noticeId: string; hash: string; state: 'draft' | 'approved' };

export type Segment = { t: 'text'; s: string } | { t: 'fig'; id: string } | { t: 'cite'; id: string };

const TOKEN = /\{\{(fig|cite):([\w.-]+)\}\}/g;

export const figToken = (id: string) => `{{fig:${id}}}`;
export const citeToken = (id: string) => `{{cite:${id}}}`;

/** A paragraph split into text and tokens, in order. */
export function segments(p: string): Segment[] {
  const out: Segment[] = [];
  let at = 0;
  for (const m of p.matchAll(TOKEN)) {
    if (m.index > at) out.push({ t: 'text', s: p.slice(at, m.index) });
    out.push({ t: m[1] as 'fig' | 'cite', id: m[2]! });
    at = m.index + m[0].length;
  }
  if (at < p.length) out.push({ t: 'text', s: p.slice(at) });
  return out;
}

const tokensOf = (p: string) => segments(p).flatMap((s) => (s.t === 'text' ? [] : [`${s.t}:${s.id}`]));
const textOf = (p: string) => segments(p).flatMap((s) => (s.t === 'text' ? [s.s] : []));

/** Money typed as text: a currency sign, a two-decimal or comma-grouped number, or a number of dollars or cents. */
const TYPED_MONEY = [/[$€£]\s*\d/, /(?<![\d.,])\d+\.\d{2}(?![\d.%])/, /(?<![\d.,])\d{1,3}(?:,\d{3})+(?![\d%])/, /\d\s*(?:dollars?|usd|cents?)\b/i];

export const TYPED_FIGURE = 'Amounts can’t be typed. Every figure comes from duty-engine or the notice; keep the figure tokens as they are.';
export const TOKENS_CHANGED = 'Figures and citations can’t be added, removed or moved. Edit the words around them.';

/**
 * Whether the editor accepts `next` as the new text of the paragraph that was `prev`: plain text on one line,
 * the same figure and citation tokens in the same order, and no money typed as text. Returns the reason, or null.
 */
export function checkParagraph(prev: string, next: string): string | null {
  if (/[\r\n]/.test(next)) return 'A paragraph is one line of plain text.';
  const text = textOf(next);
  if (text.some((t) => t.includes('{{') || t.includes('}}'))) return TYPED_FIGURE;
  if (tokensOf(next).join() !== tokensOf(prev).join()) return TOKENS_CHANGED;
  if (text.some((t) => TYPED_MONEY.some((re) => re.test(t)))) return TYPED_FIGURE;
  if (next.length > 4000) return 'That paragraph is too long.';
  return null;
}
