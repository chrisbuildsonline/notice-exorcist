import Link from 'next/link';
import type { ReactNode } from 'react';
import type { FigureJson } from '../lib/assess';
import type { LineState } from '../lib/states';
import { Figure } from './Figure';
import { StatusPill } from './StatusPill';

/** The glow classes. Status hues only (globals.css); confirm, unsupported and verified never glow. */
export const GLOW = { disagrees: 'glow-haunt', unverified: 'glow-unverified' } as const satisfies Partial<Record<LineState, string>>;

type Props = {
  state: LineState;
  label: string;
  /** Mono detail under the label, e.g. the HTS code and rate text. */
  meta?: ReactNode;
  stated: FigureJson | null;
  computed: FigureJson | null;
  /** Wake-up: glows start 80ms apart, once. */
  index?: number;
  href?: string;
  selected?: boolean;
};

/**
 * One extracted line on the paper. The state comes from the engine and the extraction, never the model.
 * A disagreeing line keeps the stated figure and shows the computed one beside it.
 */
export function HauntedLine({ state, label, meta, stated, computed, index = 0, href, selected = false }: Props) {
  const glow = state === 'disagrees' || state === 'unverified' ? GLOW[state] : '';
  return (
    <li
      data-state={state}
      aria-current={selected ? 'true' : undefined}
      style={glow ? { animationDelay: `${index * 80}ms` } : undefined}
      className={`line ${glow} flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-sm py-3 pr-4 pl-5 ${selected ? 'outline-2 outline-accent-200' : ''}`}
    >
      <span className="min-w-0 flex-1 basis-56">
        {href ? (
          <Link href={href} scroll={false} className="block text-body font-medium after:absolute after:inset-0 after:content-['']">
            {label}
          </Link>
        ) : (
          <span className="block text-body font-medium">{label}</span>
        )}
        {meta ? <span className="mt-0.5 block font-mono text-mono text-text-muted">{meta}</span> : null}
      </span>
      <span className="relative z-10 ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
        {stated ? <Figure {...stated} /> : <span className="text-number num text-text-muted">—</span>}
        {state === 'disagrees' && computed ? (
          <>
            <span aria-hidden="true" className="text-text-muted">
              →
            </span>
            <Figure {...computed} />
          </>
        ) : null}
        <StatusPill line={state} />
      </span>
    </li>
  );
}
