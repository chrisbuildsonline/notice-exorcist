import { CopyButton, RefreshWhileReading, UploadButton } from '../components/ClientBits';
import { Dropzone } from '../components/Dropzone';
import { EmptyInbox, InboxHeading, INK, PILL, TrySpecimen, UploadIcon } from '../components/EmptyInbox';
import { GhostGlyph } from '../components/GhostGlyph';
import { Haunt } from '../components/Haunt';
import { InboxRow } from '../components/InboxRow';
import { Page } from '../components/Page';
import { confirmationsFor } from '../lib/confirm';
import { inboxToken } from '../lib/db';
import { inboxCaption, specimenPreview, totalAtStake } from '../lib/inbox';
import { listNotices } from '../lib/intake';
import { noticeView } from '../lib/notice-view';
import { inboxFog } from '../lib/states';

export const dynamic = 'force-dynamic';

export default async function InboxPage() {
  const views = listNotices().map((row) => noticeView(row, confirmationsFor(row.id)));
  const empty = views.length === 0;
  const total = totalAtStake(views);
  const preview = empty ? await specimenPreview() : null;
  const address = `notices+${inboxToken()}@${process.env.INBOUND_DOMAIN || 'in.noticeexorcist.app'}`;

  const fog = inboxFog(views.map((v) => v.assessment?.status.kind ?? (v.status === 'failed' ? 'failed' : 'reading')));

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-32 md:px-8 md:pb-16">
      <Haunt level={fog} />
      <header className="flex h-16 items-center">
        <span className="flex items-center gap-2 text-body font-semibold tracking-tight">
          <GhostGlyph size={24} />
          Notice Exorcist
        </span>
      </header>

      <Page>
        {/* Empty: the hero holds the one pill and Upload as secondary, so the header carries no action (R4.2). */}
        <InboxHeading
          total={total}
          caption={inboxCaption(views)}
          action={
            empty ? null : (
              <UploadButton className={`${PILL} ${INK} hidden h-13 md:inline-flex`}>
                <UploadIcon />
                Upload a notice
              </UploadButton>
            )
          }
        />

        <div className="mt-8 grid grid-cols-1 gap-4 md:mt-12 md:gap-6 lg:grid-cols-12">
          <section aria-labelledby="notices-label" className="rounded-lg bg-surface p-5 shadow-float md:p-6 lg:col-span-8">
            <p id="notices-label" className="text-label uppercase text-text-muted">
              Notices
            </p>
            {empty ? (
              <EmptyInbox preview={preview} />
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
      </Page>

      {/* On the empty inbox the thumb bar is EmptyInbox's own (Try a specimen); with notices it uploads. */}
      {empty ? null : (
        <div data-testid="thumb-bar" className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-canvas via-canvas/90 to-transparent px-4 pt-6 pb-[max(16px,env(safe-area-inset-bottom))] md:hidden">
          <UploadButton className={`${PILL} ${INK} flex h-14 w-full`}>
            <UploadIcon />
            Upload a notice
          </UploadButton>
        </div>
      )}
      <RefreshWhileReading active={views.some((v) => v.status === 'reading')} />
    </div>
  );
}
