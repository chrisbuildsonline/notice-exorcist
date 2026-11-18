export const RATE_SENTENCE = 'Duty-engine cannot check this rate, so the figure is shown as printed on the notice.';
export const CHARGE_SENTENCE = 'Duty-engine cannot check this kind of charge, so the figure is shown as printed on the notice.';

const Cell = ({ id, label, aria }: { id: string; label: string; aria?: string }) => (
  <span data-testid={id} className="inline-flex items-baseline gap-1.5">
    <span className="text-caption text-text-muted">{label}</span>
    <span aria-label={aria} className="text-number num text-text-muted">
      —
    </span>
  </span>
);

/**
 * The recomputed and difference cells of a line the engine could not check (R5.2, R5.3, R5.5): a dash each, never a
 * number, and the reason in plain words, always visible. It draws no money, so it carries no provenance.
 */
export function UnsupportedLine({ rateText }: { rateText: string | null }) {
  return (
    <span className="block basis-full pt-1">
      <span className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
        <Cell id="recomputed-cell" label="Recomputed" aria="Not computed" />
        <Cell id="difference-cell" label="Difference" aria="No difference" />
      </span>
      <span data-testid="unsupported-reason" className="mt-1 block text-caption text-text-secondary">
        {rateText ? RATE_SENTENCE : CHARGE_SENTENCE}
      </span>
    </span>
  );
}
