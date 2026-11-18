import type { ReactNode } from 'react';
import type { Assessment, FigureJson } from '../lib/assess';
import { UploadButton } from './ClientBits';
import { Figure } from './Figure';
import { GhostGlyph } from './GhostGlyph';
import { SpecimenCard } from './SpecimenCard';

// No display class here: each use sets its own, so `hidden md:inline-flex` never fights it.
export const PILL = 'items-center justify-center gap-2 rounded-full px-6 text-body font-medium transition duration-120 ease-out active:scale-[.98]';
export const INK = 'bg-ink text-white shadow-pill hover:-translate-y-px hover:bg-ink-hover';
export const WHITE = 'bg-surface text-text-secondary shadow-float hover:shadow-raised';

export function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
    </svg>
  );
}

/** "Try a specimen" is a plain form POST, so it works without JavaScript. */
export function TrySpecimen({ className, children }: { className: string; children: string }) {
  return (
    <form action="/api/specimens" method="post">
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}

/**
 * The Inbox title and caption, with the amount at stake only when the engine computed one (R4.3): no notices means
 * nothing was checked, so no figure, not `$0.00`.
 */
export function InboxHeading({ total, caption, action }: { total: FigureJson | null; caption: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-6 pt-4 md:pt-6">
      <div>
        <h1 tabIndex={-1} className="text-title outline-none">
          Inbox
        </h1>
        {total ? (
          <div data-testid="at-stake" className="mt-4">
            <Figure {...total} size="display" />
          </div>
        ) : null}
        <p className="mt-2 text-caption text-text-muted">{caption}</p>
      </div>
      {action}
    </div>
  );
}

/**
 * The empty Inbox (DESIGN.md 5.1, R4): one headline, one line, one primary pill (`Try a specimen`), then
 * `Upload a notice` as secondary. On a phone the same pill sits in the sticky thumb bar; it stays first in the DOM,
 * so Tab reaches it right after the skip link. The specimen card is decorative: hidden and inert.
 */
export function EmptyInbox({ preview }: { preview: Assessment | null }) {
  return (
    <div className="grid grid-cols-1 items-center gap-12 pt-8 pb-6 md:grid-cols-2 md:gap-8 md:py-12">
      <div className="flex flex-col items-center text-center md:items-start md:text-left">
        <GhostGlyph />
        <h2 className="mt-6 text-heading">Exorcise your customs notice</h2>
        <p data-testid="empty-line" className="mt-2 max-w-md text-body text-text-secondary">
          Forward or upload a CBP Form 28, 29 or courier duty invoice. We check every figure and draft a cited reply you approve.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3 md:justify-start">
          <div
            data-testid="thumb-bar"
            className="max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-10 max-md:bg-gradient-to-t max-md:from-canvas max-md:via-canvas/90 max-md:to-transparent max-md:px-4 max-md:pt-6 max-md:pb-[max(16px,env(safe-area-inset-bottom))]"
          >
            <TrySpecimen className={`${PILL} ${INK} flex h-14 w-full md:inline-flex md:h-13 md:w-auto`}>Try a specimen</TrySpecimen>
          </div>
          <UploadButton className={`${PILL} ${WHITE} inline-flex h-13`}>
            <UploadIcon />
            Upload a notice
          </UploadButton>
        </div>
      </div>
      {preview ? (
        <div aria-hidden="true" inert>
          <SpecimenCard a={preview} />
        </div>
      ) : null}
    </div>
  );
}
