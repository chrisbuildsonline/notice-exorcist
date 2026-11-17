/** A hedge word in front of a number: "approximately $40", "about 9%". Always dropped, sourced or not. */
const HEDGED = /\b(?:approximately|approx\.?|roughly|about|around|nearly|almost|close to)\s*[-−]?[$€£]?\d|~\s*[$€£]?\d/i;

/**
 * Checks model-written explanation text against figures that have provenance (R4.11).
 * A sentence survives only when every number in it is one of `sourced` (a currency sign may be left off)
 * and no number is hedged. The warning names a code and a count, never the text.
 */
export function guardExplanation(text: string, sourced: string[]): { text: string; dropped: number } {
  const known = [...new Set(sourced.flatMap((s) => [s, s.replace(/^[$€£]/, '')]))].sort((a, b) => b.length - a.length);
  const sentences = text.split(/(?<=[.!?])(?=\s)/);
  const kept = sentences.filter((s) => {
    if (HEDGED.test(s)) return false;
    // Remove whole sourced figures; any digit left over is an unknown number or a fragment of one.
    const rest = known.reduce((acc, k) => acc.split(k).join(' '), s);
    return !/\d/.test(rest);
  });
  const dropped = sentences.length - kept.length;
  if (dropped > 0) console.warn('explanation_unsourced_figure', { dropped });
  return { text: dropped ? kept.join('').trim() : text, dropped };
}
