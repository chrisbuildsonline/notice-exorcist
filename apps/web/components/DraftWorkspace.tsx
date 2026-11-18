'use client';

import { useState } from 'react';
import type { DraftView } from '../lib/draft';
import { DraftEditor } from './DraftEditor';
import { StatusPill } from './StatusPill';

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** The Exorcise screen below the back link: title and draft state, the draft on paper, and what the draft is bound to. */
export function DraftWorkspace({ initial, subtitle }: { initial: DraftView; subtitle: string }) {
  const [draft, setDraft] = useState(initial);
  const fingerprint = `sha256 ${draft.hash.slice(0, 4)}…${draft.hash.slice(-2)} · ${plural(draft.paragraphs.length, 'paragraph')} · ${plural(draft.citations.length, 'citation')}`;

  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-title">Exorcise the notice</h1>
        <span data-testid="draft-state">
          <StatusPill draft={draft.state} />
        </span>
      </div>
      <p className="mt-2 font-mono text-mono text-text-muted">{subtitle}</p>

      <div className="mt-8 grid grid-cols-1 gap-4 md:mt-12 md:gap-6 lg:grid-cols-12 lg:items-start">
        <div className="lg:col-span-8">
          <DraftEditor draft={draft} onSaved={setDraft} />
        </div>

        <aside aria-label="About this draft" className="rounded-lg bg-surface p-5 shadow-raised md:p-6 lg:sticky lg:top-6 lg:col-span-4">
          <p className="text-label uppercase text-text-muted">This draft</p>
          <p data-testid="fingerprint" title={`sha256 ${draft.hash}`} className="mt-2 font-mono text-mono break-words text-ink">
            {fingerprint}
          </p>
          <dl className="mt-6 grid grid-cols-3 gap-3 rounded-md bg-surface-muted p-4">
            {[
              ['Paragraphs', draft.paragraphs.length],
              ['Figures', draft.figures.length],
              ['Citations', draft.citations.length],
            ].map(([k, n]) => (
              <div key={k}>
                <dt className="text-caption text-text-muted">{k}</dt>
                <dd className="mt-0.5 text-number num">{n}</dd>
              </div>
            ))}
          </dl>
          <section className="mt-8">
            <p className="text-label uppercase text-text-muted">How it was written</p>
            <ul className="mt-3 space-y-3 text-body text-text-secondary">
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-muted font-mono text-[11px] font-semibold text-text-secondary">ƒ</span>
                Every figure is a token from duty-engine or the notice, with its source one tap away.
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-50 font-mono text-[11px] font-semibold text-accent">1</span>
                Every claim cites an HTS line, a CROSS ruling or a box on the notice.
              </li>
              <li className="flex gap-3">
                <span aria-hidden="true" className="mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-[12px] text-text-secondary">✎</span>
                Edit the words freely. Amounts can’t be typed.
              </li>
            </ul>
          </section>
        </aside>
      </div>
    </>
  );
}
