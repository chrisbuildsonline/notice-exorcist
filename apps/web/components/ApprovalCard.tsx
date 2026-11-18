'use client';

import { useId } from 'react';
import type { DraftView } from '../lib/draft';

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`;
const short = (hash: string) => `sha256 ${hash.slice(0, 4)}…${hash.slice(-2)}`;

/** "sha256 9f3c…a1 · 3 paragraphs · 4 citations": what the approval is bound to. */
export const fingerprint = (d: DraftView) => `${short(d.hash)} · ${plural(d.paragraphs.length, 'paragraph')} · ${plural(d.citations.length, 'citation')}`;

export const HELPER_SHUT = 'Approve the draft to export';
const HELPER_OPEN = 'Exports this exact text, nothing else';

type CheckProps = { draft: DraftView; checked: boolean; busy: boolean; onChange: (on: boolean) => void; variant: 'card' | 'bar'; className?: string };

/**
 * The explicit approval: a full-width checkbox-card, "I approve this exact draft", with the hash it binds to.
 * Unticked unless the stored approval says otherwise. Nothing but the user's tick sets it.
 */
export function ApprovalCheck({ draft, checked, busy, onChange, variant, className = '' }: CheckProps) {
  const sub = useId();
  const look =
    variant === 'card'
      ? 'min-h-16 rounded-md bg-surface-muted hover:bg-line has-[:checked]:bg-calm-bg'
      : 'min-h-14 rounded-lg bg-surface shadow-float has-[:checked]:bg-calm-bg';
  return (
    <label className={`flex cursor-pointer items-center gap-3.5 px-4 py-2.5 transition-colors duration-200 ${look} ${className}`}>
      <span className="grid size-6 shrink-0 place-items-center">
        <input
          type="checkbox"
          checked={checked}
          aria-busy={busy || undefined}
          aria-describedby={sub}
          onChange={(e) => onChange(e.currentTarget.checked)}
          className="peer size-6 cursor-pointer appearance-none rounded-xs bg-surface shadow-[inset_0_0_0_1.5px_var(--color-text-muted)] transition-colors duration-120 [grid-area:1/1] checked:bg-ink checked:shadow-none"
        />
        <svg
          aria-hidden="true"
          viewBox="0 0 16 16"
          className="pointer-events-none size-4 scale-75 text-white opacity-0 transition duration-120 [grid-area:1/1] peer-checked:scale-100 peer-checked:opacity-100"
        >
          <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="min-w-0">
        <span className="block text-body font-medium text-ink">I approve this exact draft</span>
        <span id={sub} className="block font-mono text-[12px] leading-4 text-text-muted">
          {checked ? <span className="font-sans font-semibold text-calm-fg">✓ Approved · </span> : null}
          {short(draft.hash)}
        </span>
      </span>
    </label>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="size-[18px]">
      <path d="M9 2.75v8.5M5.5 8 9 11.5 12.5 8M3.25 13.5v.75c0 .55.45 1 1 1h9.5c.55 0 1-.45 1-1v-.75" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type ExportProps = { approved: boolean; exporting: boolean; onExport: () => void; variant: 'header' | 'bar'; className?: string };

/**
 * The screen's one primary pill. Until the draft is approved it is `aria-disabled` (still focusable, so the
 * helper text is read out), drawn in the disabled colours and does nothing.
 */
export function ExportPill({ approved, exporting, onExport, variant, className = '' }: ExportProps) {
  const helper = useId();
  const size = variant === 'header' ? 'h-13' : 'h-14 w-full';
  const look = approved
    ? 'bg-ink text-white shadow-pill hover:-translate-y-px hover:bg-ink-hover active:scale-[.98]'
    : 'cursor-not-allowed bg-disabled-bg text-disabled-fg';
  return (
    <div className={className}>
      <button
        type="button"
        aria-disabled={approved ? undefined : 'true'}
        aria-describedby={helper}
        aria-busy={exporting || undefined}
        onClick={() => {
          if (approved && !exporting) onExport();
        }}
        className={`inline-flex items-center justify-center gap-2 rounded-full px-6 text-body font-medium transition duration-120 ${size} ${look} ${exporting ? 'cursor-progress' : ''}`}
      >
        {exporting ? <span aria-hidden="true" className="size-[18px] animate-spin rounded-full border-2 border-white/30 border-t-white" /> : <DownloadIcon />}
        Export PDF
      </button>
      <p id={helper} className={`mt-2 text-caption text-text-muted ${variant === 'header' ? 'text-right' : 'text-center'}`}>
        {approved ? HELPER_OPEN : HELPER_SHUT}
      </p>
    </div>
  );
}

/** The side card: what is being approved, the checkbox-card, and how the draft was written. */
export function ApprovalCard({ draft, check }: { draft: DraftView; check: Omit<CheckProps, 'draft' | 'variant'> }) {
  return (
    <section aria-label="Approve" className="rounded-lg bg-surface p-5 shadow-raised md:p-6">
      <p className="text-label uppercase text-text-muted">Approve</p>
      <h2 className="mt-2 text-heading">You are approving</h2>
      <p data-testid="fingerprint" title={`sha256 ${draft.hash}`} className="mt-1 font-mono text-mono break-words text-text-secondary">
        {/* wraps between the parts, never inside one, and the separator stays at the end of a line */}
        {fingerprint(draft)
          .split(' · ')
          .map((part, i, all) => (
            <span key={part}>
              <span className="whitespace-nowrap">{i < all.length - 1 ? `${part} ·` : part}</span>
              {i < all.length - 1 ? ' ' : ''}
            </span>
          ))}
      </p>
      <dl className="mt-5 grid grid-cols-3 gap-3 rounded-md bg-surface-muted p-4">
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
      <ApprovalCheck {...check} draft={draft} variant="card" className="mt-4 max-md:hidden" />
      <p className="mt-3 text-caption text-text-muted">Ticking approves this text only. Any edit clears the approval, and nothing is sent or filed.</p>

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
    </section>
  );
}
