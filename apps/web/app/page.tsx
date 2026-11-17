import { CopyButton, RefreshWhileReading, UploadButton } from '../components/ClientBits';
import { Dropzone } from '../components/Dropzone';
import { Figure } from '../components/Figure';
import { GhostGlyph } from '../components/GhostGlyph';
import { InboxRow } from '../components/InboxRow';
import { SpecimenCard } from '../components/SpecimenCard';
import { confirmationsFor } from '../lib/confirm';
import { inboxToken } from '../lib/db';
import { inboxCaption, specimenPreview, totalAtStake } from '../lib/inbox';
import { listNotices } from '../lib/intake';
import { noticeView } from '../lib/notice-view';

export const dynamic = 'force-dynamic';

// No display class here: each use sets its own, so `hidden md:inline-flex` never fights it.
const PILL = 'items-center justify-center gap-2 rounded-full px-6 text-body font-medium transition duration-120 ease-out active:scale-[.98]';
const INK = 'bg-ink text-white shadow-pill hover:-translate-y-px hover:bg-ink-hover';
const WHITE = 'bg-surface text-text-secondary shadow-float hover:shadow-raised';

function UploadIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
      <path d="M12 16V4M7 9l5-5 5 5M5 20h14" />
    </svg>
  );
}

function TrySpecimen({ className, children }: { className: string; children: string }) {
  return (
    <form action="/api/specimens" method="post">
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  );
}

export default async function InboxPage() {
  const views = listNotices().map((row) => noticeView(row, confirmationsFor(row.id)));
  const empty = views.length === 0;
  const total = totalAtStake(views);
  const preview = empty ? await specimenPreview() : null;
  const address = `notices+${inboxToken()}@${process.env.INBOUND_DOMAIN || 'in.noticeexorcist.app'}`;

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-32 md:px-8 md:pb-16">
      <header className="flex h-16 items-center">
        <span className="flex items-center gap-2 text-body font-semibold tracking-tight">
          <GhostGlyph size={24} />
          Notice Exorcist
        </span>
      </header>

      <main>
        <div className="flex items-start justify-between gap-6 pt-4 md:pt-6">
          <div>
            <h1 className="text-title">Inbox</h1>
            {total ? (
              <div data-testid="at-stake" className="mt-4">
                <Figure {...total} size="display" />
              </div>
            ) : null}
            <p className="mt-2 text-caption text-text-muted">{inboxCaption(views)}</p>
          </div>
          <UploadButton className={`${PILL} hidden h-13 md:inline-flex ${empty ? WHITE : INK}`}>
            <UploadIcon />
            Upload a notice
          </UploadButton>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-4 md:mt-12 md:gap-6 lg:grid-cols-12">
          <section aria-labelledby="notices-label" className="rounded-lg bg-surface p-5 shadow-float md:p-6 lg:col-span-8">
            <p id="notices-label" className="text-label uppercase text-text-muted">
              Notices
            </p>
            {empty ? (
              <div className="grid grid-cols-1 items-center gap-12 pt-8 pb-6 md:grid-cols-2 md:gap-8 md:py-12">
                <div className="flex flex-col items-center text-center md:items-start md:text-left">
                  <GhostGlyph />
                  <h2 className="mt-6 text-heading">Exorcise your customs notice</h2>
                  <p className="mt-2 max-w-md text-body text-text-secondary">
                    Forward or upload a CBP Form 28, 29 or courier duty invoice. We check every figure and draft a cited reply you
                    approve.
                  </p>
                  <div className="mt-8">
                    <TrySpecimen className={`${PILL} inline-flex h-14 md:h-13 ${WHITE} md:bg-ink md:text-white md:shadow-pill md:hover:-translate-y-px md:hover:bg-ink-hover`}>
                      Try a specimen
                    </TrySpecimen>
                  </div>
                </div>
                {preview ? <SpecimenCard a={preview} /> : null}
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {views.map((v) => (
                  <InboxRow key={v.id} v={v} />
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="add-label" className="rounded-lg bg-surface p-5 shadow-float md:p-6 lg:col-span-4 lg:self-start">
            <h2 id="add-label" className="text-heading">
              Add a notice
            </h2>
            <div className="mt-4">
              <Dropzone />
            </div>
            <p className="mt-6 text-caption text-text-muted">Or forward the email to</p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate font-mono text-mono text-ink">{address}</code>
              <CopyButton text={address} />
            </div>
            {empty ? null : (
              <div className="mt-6 flex flex-wrap items-center gap-x-1 text-caption text-text-muted">
                No notice handy?
                <TrySpecimen className="inline-flex h-11 items-center font-medium text-accent underline-offset-2 hover:text-accent-700 hover:underline">
                  Try a specimen →
                </TrySpecimen>
              </div>
            )}
          </section>
        </div>
      </main>

      <div data-testid="thumb-bar" className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-canvas via-canvas/90 to-transparent px-4 pt-6 pb-[max(16px,env(safe-area-inset-bottom))] md:hidden">
        <UploadButton className={`${PILL} ${INK} flex h-14 w-full`}>
          <UploadIcon />
          Upload a notice
        </UploadButton>
      </div>
      <RefreshWhileReading active={views.some((v) => v.status === 'reading')} />
    </div>
  );
}
