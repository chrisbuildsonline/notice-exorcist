'use client';

import { type KeyboardEvent, type ReactNode, useId, useRef } from 'react';
import type { FigureJson } from '../lib/assess';
import type { Calc, CalcInput } from '../lib/calc';
import { Figure } from './Figure';
import { StatusPill } from './StatusPill';
import { trapTab } from './trapTab';

/** The printed code's HTS line in the tariff index, for the edition the rate can be checked against. */
export type HtsRef = { code: string; rate: string; edition: string };

/** A line the engine could not check: its printed rate text and why, in place of a calculation (R5.8). */
export type Unchecked = { rateText: string; reason: string };

type Props = {
  title: string;
  subtitle?: string | null;
  /** The figure the notice prints for the same thing, if any. */
  stated: FigureJson | null;
  /** Set by the engine only when the notice and the recomputation disagree. */
  difference: FigureJson | null;
  /** Duty lines only: the HTS line, or why there is none. Left out for fees and totals. */
  hts?: HtsRef | 'not-built' | 'not-found';
  className?: string;
} & ({ calc: Calc; unsupported?: never } | { calc?: never; unsupported: Unchecked });

const Label = ({ children }: { children: ReactNode }) => <p className="text-label uppercase text-text-muted">{children}</p>;

/** The provenance chip for a value that is not money (a rate or a quantity); money gets Figure's own. */
const Tag = ({ prov }: { prov: string }) => (
  <span className="prov-tag rounded-xs bg-surface-muted px-1.5 font-sans text-[11px] leading-4 font-semibold text-text-secondary">{prov}</span>
);

function Value({ i }: { i: CalcInput }) {
  if (i.kind === 'money') return <Figure value={i.value} prov={i.prov} source={i.source} />;
  return (
    <span className="inline-flex items-baseline gap-1.5 whitespace-nowrap">
      <span className="font-mono text-mono font-semibold text-ink num">{i.text}</span>
      <Tag prov={i.prov} />
    </span>
  );
}

const usitc = (code: string) => `https://hts.usitc.gov/search?query=${encodeURIComponent(code)}`;

/**
 * "See the math": a modal drawer (bottom sheet on phone) with the engine's formula, the rate text and its source,
 * every input with its provenance, and the notice figure beside the recomputed one.
 * Focus is trapped; Esc, the close button and a click on the scrim close it, and focus returns to the trigger.
 */
export function CalcDrawer({ title, subtitle, calc, unsupported, stated, difference, hts, className = '' }: Props) {
  const id = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const close = () => dialog.current?.close();
  const byKey = new Map((calc?.inputs ?? []).map((i) => [i.key, i]));
  // An unchecked line still quotes its rate text, verbatim, as the notice prints it.
  const rate: Calc['rate'] = calc ? calc.rate : { text: unsupported.rateText, prov: 'stated', source: 'as printed on the notice' };

  // Tab and Shift+Tab wrap inside the drawer.
  const trap = (e: KeyboardEvent<HTMLDialogElement>) => trapTab(e, dialog.current);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="dialog"
        onClick={() => dialog.current?.showModal()}
        className={`-ml-1 inline-flex min-h-11 items-center gap-1 rounded-full px-1 text-body font-medium text-accent transition-colors duration-120 hover:text-accent-700 hover:underline ${className}`}
      >
        See the math
        <span aria-hidden="true">→</span>
      </button>

      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        onKeyDown={trap}
        onClose={() => trigger.current?.focus()}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="calc-drawer m-0 h-dvh max-h-none w-full max-w-none flex-col justify-end border-0 bg-transparent p-0 open:flex md:flex-row md:justify-end"
      >
        <div
          data-testid="calc-panel"
          className="calc-panel flex max-h-[92dvh] w-full flex-col overflow-y-auto overscroll-contain rounded-t-xl bg-surface shadow-overlay md:h-full md:max-h-none md:w-[560px] md:rounded-l-xl md:rounded-tr-none"
        >
          <div aria-hidden="true" className="mx-auto mt-2 h-1 w-9 shrink-0 rounded-full bg-line md:hidden" />
          <div className="sticky top-0 z-10 flex items-start justify-between gap-4 bg-surface px-5 pt-3 pb-4 md:px-8 md:pt-8">
            <div className="min-w-0">
              <h2 id={`${id}-title`} className="text-heading">
                {title}
              </h2>
              {subtitle ? <p className="mt-0.5 text-body text-text-secondary">{subtitle}</p> : null}
              {unsupported ? (
                <div className="mt-3">
                  <StatusPill line="unsupported" />
                </div>
              ) : stated ? (
                <div className="mt-3">
                  <StatusPill match={!difference} />
                </div>
              ) : null}
            </div>
            <button
              type="button"
              aria-label="Close"
              autoFocus
              onClick={close}
              className="-mt-1 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full text-[20px] text-text-secondary transition-colors duration-120 hover:bg-surface-muted"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>

          <div className="px-5 pb-[max(24px,env(safe-area-inset-bottom))] md:px-8 md:pb-8">
            {calc ? (
              <div data-testid="formula" className="calc-well rounded-md bg-surface-muted p-4 font-mono text-mono text-text-secondary md:p-5">
                <p className="font-semibold text-ink">{calc.formula}</p>
                <p className="mt-2 flex flex-wrap items-baseline gap-x-1.5 gap-y-1 pl-[2ch]">
                  <span aria-hidden="true">=</span>
                  {calc.substitution.map((t, n) => {
                    if (t.t === 'text') return <span key={n}>{t.s.trim()}</span>;
                    const i = byKey.get(t.key);
                    return i ? <Value key={n} i={i} /> : null;
                  })}
                </p>
                <p className="mt-1 flex items-baseline gap-x-1.5 pl-[2ch]">
                  <span aria-hidden="true">=</span>
                  <Figure {...calc.result} />
                </p>
                <p className="mt-3 border-t border-line pt-3 text-text-muted">rounding: {calc.rounding}</p>
              </div>
            ) : (
              // No formula and no result: the engine did not compute this line, and says why.
              <div data-testid="unsupported-why" className="calc-well rounded-md bg-surface-muted p-4 font-mono text-mono text-text-secondary md:p-5">
                <p className="font-semibold text-ink">Not computed</p>
                <p className="mt-2">reason: {unsupported.reason}</p>
              </div>
            )}

            {rate || hts ? (
              <section className="mt-8">
                {rate ? (
                  <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-label uppercase text-text-muted">Rate text</span>
                    <span className="font-mono text-mono font-semibold text-ink">“{rate.text}”</span>
                    <Tag prov={rate.prov} />
                    <span className="text-caption text-text-secondary">· {rate.source}</span>
                    {rate.href ? (
                      <a href={rate.href} target="_blank" rel="noreferrer" className="inline-flex min-h-6 items-center text-caption text-accent hover:text-accent-700 hover:underline">
                        Source ↗
                      </a>
                    ) : null}
                  </p>
                ) : null}
                {hts ? (
                  <p data-testid="hts-edition" className="mt-2 text-caption text-text-secondary">
                    {typeof hts === 'string' ? (
                      hts === 'not-built' ? (
                        'No HTS edition: the tariff index is not built on this server'
                      ) : (
                        'No HTS edition: the printed code is not in the tariff index'
                      )
                    ) : (
                      <>
                        <span className="font-mono text-mono text-ink">HTS {hts.code}</span> · tariff rate “{hts.rate}” · {hts.edition}{' '}
                        <a href={usitc(hts.code)} target="_blank" rel="noreferrer" className="inline-flex min-h-6 items-center text-accent hover:text-accent-700 hover:underline">
                          USITC ↗
                        </a>
                      </>
                    )}
                  </p>
                ) : null}
              </section>
            ) : null}

            {calc ? (
              <section className="mt-8">
                <Label>Inputs</Label>
                <ul className="mt-2 divide-y divide-line">
                  {calc.inputs.map((i) => (
                    <li data-testid="calc-input" key={i.key} className="flex items-start justify-between gap-4 py-3">
                      <span className="pt-0.5 text-body text-text-secondary">{i.label}</span>
                      <span className="flex min-w-0 flex-col items-end gap-0.5 text-right">
                        <Value i={i} />
                        <span className="text-caption text-text-muted">{i.source}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="mt-8 grid grid-cols-2 gap-4 rounded-md bg-surface-muted p-4 md:p-5">
              {stated ? (
                <div className="min-w-0">
                  <Label>Notice says</Label>
                  <div className="mt-1">
                    <Figure {...stated} />
                  </div>
                </div>
              ) : null}
              <div className="min-w-0">
                <Label>Recomputed</Label>
                <div className="mt-1">
                  {calc ? (
                    <Figure {...calc.result} />
                  ) : (
                    // A dash, never a number: the engine did not compute this line.
                    <span className="flex items-baseline gap-1.5">
                      <span className="text-number num text-text-muted">—</span>
                      <span className="text-caption text-text-muted">Not computed</span>
                    </span>
                  )}
                </div>
              </div>
              {difference ? (
                <div className="col-span-2 flex items-baseline gap-3 border-t border-line pt-3">
                  <span className="text-caption text-text-muted">Difference</span>
                  <Figure {...difference} />
                </div>
              ) : null}
            </section>

            <p data-testid="engine-caption" className="mt-6 flex items-center gap-2 text-caption text-text-muted">
              <span aria-hidden="true" className="inline-flex size-5 items-center justify-center rounded-full bg-surface-muted font-mono text-[11px] text-text-secondary">
                ƒ
              </span>
              Computed by duty-engine, not by the AI model.
            </p>
          </div>
        </div>
      </dialog>
    </>
  );
}
