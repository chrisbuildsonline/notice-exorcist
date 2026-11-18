import type { DraftContent } from './draft';

/** Stable JSON: object keys sorted, no whitespace, array order kept. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`;
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .filter((k) => o[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

/** The serialization the approval is bound to: paragraphs in order, the figures and the citations. Nothing else. */
export function canonicalDraft(d: DraftContent): string {
  return stable({ paragraphs: d.paragraphs, figures: d.figures, citations: d.citations });
}

/** sha256 hex of canonicalDraft. Web Crypto, so the same code runs in the browser (display) and the server (authority). */
export async function draftHash(d: DraftContent): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonicalDraft(d)));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
