import { useId } from 'react';

export type FigureProv = 'stated' | 'computed' | 'tariff';

export type FigureProps = {
  /** A decimal string, e.g. "852.25". */
  value: string;
  prov: FigureProv;
  /** Where the figure came from: notice page and box, engine formula, or HTS edition. */
  source: string;
  size?: 'display' | 'number';
};

/** "$1,234.50" or "−$1,234.50": 2 decimals (half up), comma grouping, a true minus. */
function money(value: string): string {
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!m) throw new Error(`Figure: not a decimal: ${JSON.stringify(value)}`);
  const frac = (m[3] ?? '').padEnd(3, '0');
  let cents = BigInt(m[2]!) * 100n + BigInt(frac.slice(0, 2));
  if (Number(frac[2]) >= 5) cents += 1n;
  const whole = (cents / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sign = m[1] && cents !== 0n ? '−' : '';
  return `${sign}$${whole}.${(cents % 100n).toString().padStart(2, '0')}`;
}

const SIZE = { display: 'text-display', number: 'text-number' } as const;

/** The only place money is drawn. A figure without provenance is never shown. */
export function Figure({ value, prov, source, size = 'number' }: FigureProps) {
  const id = useId();
  if (!prov || !source) {
    if (process.env.NODE_ENV !== 'production') throw new Error('Unsourced figure: Figure needs prov and source');
    return (
      <span className="inline-flex items-center gap-2">
        <span className={`${SIZE[size]} num`}>—</span>
        <span className="inline-flex h-6 items-center gap-1 rounded-full bg-unsupported-bg px-2.5 text-[12px] leading-4 font-semibold text-unsupported-fg">
          <span aria-hidden="true">⊘</span>Unsourced
        </span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className={`${SIZE[size]} num`}>{money(value)}</span>
      <button
        type="button"
        popoverTarget={id}
        className="relative rounded-xs bg-surface-muted px-1.5 text-[11px] leading-4 font-semibold text-text-secondary before:absolute before:-inset-3 before:content-['']"
        aria-label={`${prov}: ${source}`}
      >
        {prov}
      </button>
      <span id={id} popover="auto" className="m-auto max-w-xs rounded-md bg-surface p-4 text-caption text-text-secondary shadow-overlay">
        <span className="text-label uppercase text-text-muted">Source</span>
        <br />
        {source}
      </span>
    </span>
  );
}
