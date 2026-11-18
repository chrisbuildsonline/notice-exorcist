import type { Skipped } from '../lib/draft-builder';

/**
 * R5.10: on the Exorcise page, how many lines the draft leaves out and why. The draft makes no claim about them.
 * Labels and reasons only: it draws no money, so it carries no provenance.
 */
export function SkippedNote({ skipped }: { skipped: Skipped[] }) {
  if (!skipped.length) return null;
  const n = skipped.length;
  return (
    <div data-testid="skipped-note" className="mt-3 max-w-prose rounded-md bg-surface-muted px-4 py-3 text-caption text-text-secondary">
      <p className="font-semibold text-ink">{n === 1 ? '1 line was' : `${n} lines were`} left out of this reply.</p>
      <ul className="mt-1">
        {skipped.map((s) => (
          <li key={s.label}>
            {s.label}: {s.reason}.
          </li>
        ))}
      </ul>
    </div>
  );
}
