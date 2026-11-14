import type { Manifest } from '../schemas';

const START = '<!-- generated from manifest.json -->';
const END = '<!-- end generated -->';

function dates(m: Manifest, prefix: string) {
  const days = Object.entries(m.files)
    .filter(([path]) => path.startsWith(prefix))
    .map(([, f]) => f.retrievedAt.slice(0, 10))
    .sort();
  const span = days[0] === days.at(-1) ? days[0] : `${days[0]} to ${days.at(-1)}`;
  return { span, count: days.length };
}

/** Replace the edition and retrieval-date lines between the markers in SOURCES.md; the rest is hand-written. */
export function regenerateSourcesNote(text: string, m: Manifest): string {
  const a = text.indexOf(START);
  const b = text.indexOf(END);
  if (a < 0 || b < a) throw new Error(`SOURCES.md: generated block markers not found (${START} ... ${END})`);
  const hts = dates(m, 'hts/');
  const rulings = dates(m, 'rulings/');
  const lines = [
    `- HTS edition: ${m.edition}`,
    `- HTS retrieved: ${hts.span} (${hts.count} chapter files)`,
    `- CROSS rulings retrieved: ${rulings.span} (${rulings.count} rulings)`,
  ];
  return `${text.slice(0, a + START.length)}\n${lines.join('\n')}\n${text.slice(b)}`;
}
