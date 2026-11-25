import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { CalcDrawer } from '../../../components/CalcDrawer';
import { RefreshWhileReading } from '../../../components/ClientBits';
import { ConfirmForm } from '../../../components/ConfirmForm';
import { Figure } from '../../../components/Figure';
import { GhostGlyph } from '../../../components/GhostGlyph';
import { Haunt } from '../../../components/Haunt';
import { HauntedLine } from '../../../components/HauntedLine';
import { LinePanel } from '../../../components/LinePanel';
import { Page } from '../../../components/Page';
import { Paper } from '../../../components/Paper';
import { SidePanelDrawer } from '../../../components/SidePanelDrawer';
import { StatusPill } from '../../../components/StatusPill';
import type { FigureJson } from '../../../lib/assess';
import { confirmationsFor } from '../../../lib/confirm';
import { canDraft } from '../../../lib/draft-builder';
import { getNotice } from '../../../lib/intake';
import { noticeView, uncheckedCaption } from '../../../lib/notice-view';
import { auraOf } from '../../../lib/states';
import { htsCandidates, openTariff, rulingsFor } from '../../../lib/tariff';

export const dynamic = 'force-dynamic';

const PILL = 'items-center justify-center gap-2 rounded-full px-6 text-body font-medium';

/** "2026-11-16" -> "16 Nov 2026". Dates as printed on the notice, never money. */
const date = (iso: string | null) =>
  iso ? new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : null;

/** `materialize`: a recomputed figure appears out of the fog once (DESIGN.md 3.1). */
function Tile(props: { id: string; label: string; fig: FigureJson | null; empty: ReactNode; extra?: ReactNode; materialize?: boolean }) {
  return (
    <div data-testid={props.id} className="min-w-0 py-4 first:pt-0 last:pb-0 md:px-6 md:py-0 md:first:pl-0 md:last:pr-0">
      <p className="text-label uppercase text-text-muted">{props.label}</p>
      <div className="mt-2 min-h-10">
        {props.fig ? (
          props.materialize ? (
            <span className="materialize">
              <Figure {...props.fig} size="lg" />
            </span>
          ) : (
            <Figure {...props.fig} size="lg" />
          )
        ) : (
          props.empty
        )}
      </div>
      {props.extra}
    </div>
  );
}

/** The one primary action: drafts the reply once a line disagrees and nothing is left to confirm, else disabled with the reason. */
function Exorcise({ id, reason, href, className }: { id: string; reason: string; href: string | null; className: string }) {
  if (href)
    return (
      <div className={className}>
        <Link
          href={href}
          className={`${PILL} flex h-14 w-full bg-ink text-white shadow-pill transition duration-120 hover:-translate-y-px hover:bg-ink-hover active:scale-[.98] md:inline-flex md:h-13 md:w-auto`}
        >
          Exorcise this notice
        </Link>
      </div>
    );
  return (
    <div className={className}>
      <button type="button" aria-disabled="true" aria-describedby={id} className={`${PILL} flex h-14 w-full cursor-not-allowed bg-disabled-bg text-disabled-fg md:inline-flex md:h-13 md:w-auto`}>
        Exorcise this notice
      </button>
      <p id={id} className="mt-2 text-center text-caption text-text-muted md:text-right">
        {reason}
      </p>
    </div>
  );
}

export default async function NoticePage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ line?: string }> }) {
  const { id } = await props.params;
  const row = getNotice(id);
  if (!row) notFound();
  const v = noticeView(row, confirmationsFor(id));
  const a = v.assessment;
  const lines = a?.lines ?? [];

  // ?line=n picks a line. Desktop opens the first haunted line by default; phone shows the list until a line is tapped.
  const picked = Number((await props.searchParams).line);
  const explicit = Number.isInteger(picked) && picked >= 1 && picked <= lines.length;
  const firstHaunted = lines.findIndex((l) => l.state !== 'verified');
  const sel = explicit ? picked - 1 : Math.max(0, firstHaunted);
  const line = lines[sel];
  const db = line ? openTariff() : null;
  const tariff = line && db ? { candidates: htsCandidates(db, line), rulings: rulingsFor(db, line) } : null;
  db?.close();

  const needConfirm = lines.some((l) => l.state === 'confirm') || (a?.flags.length ?? 0) > 0;
  const reason = !a
    ? 'Nothing to reply to until the notice is read'
    : needConfirm
      ? 'Confirm the flagged values first'
      : a.status.kind === 'at_peace'
        ? 'Every figure checks out. Nothing to dispute'
        : 'No figure disagrees with duty-engine yet';
  const exorcise = canDraft(v) ? `/notices/${id}/exorcise` : null;
  const status = a?.status ?? { kind: v.status === 'failed' ? ('failed' as const) : ('reading' as const) };
  const meta = [
    v.header?.entryNumber && `Entry ${v.header.entryNumber}`,
    v.header?.noticeDate && `notice ${date(v.header.noticeDate)}`,
    v.header?.respondBy && `respond by ${date(v.header.respondBy)}`,
  ].filter(Boolean);
  const t = a?.totals;
  const unchecked = a ? uncheckedCaption(a) : null;
  // Phone: one job per screen. A tapped line replaces the list with the line view.
  const listOnly = explicit ? 'max-md:hidden' : '';

  return (
    <div className="mx-auto max-w-[1200px] px-4 pb-40 md:px-8 md:pb-16">
      <Haunt level={a?.fog ?? 0} />
      <header className="flex h-16 items-center justify-between">
        <Link href="/" className="flex h-11 items-center gap-2 text-body font-semibold tracking-tight">
          <GhostGlyph size={24} />
          Notice Exorcist
        </Link>
      </header>

      <Page>
        <div className={listOnly}>
          <Link href="/" className="-ml-2 inline-flex h-11 items-center gap-1 rounded-full px-2 text-body font-medium text-accent hover:text-accent-700">
            <span aria-hidden="true">←</span> Inbox
          </Link>
          <div className="mt-2 flex flex-col gap-4 md:flex-row md:items-start md:justify-between md:gap-6">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <h1 tabIndex={-1} className="text-title outline-none">
                  {v.title}
                </h1>
                <span data-testid="notice-status">
                  <StatusPill notice={status} />
                </span>
              </div>
              {meta.length ? <p className="mt-2 font-mono text-mono text-text-muted">{meta.join(' · ')}</p> : null}
            </div>
            <Exorcise id="exorcise-why" reason={reason} href={exorcise} className="hidden shrink-0 md:block" />
          </div>
        </div>

        {!a ? (
          <section className="mt-8 rounded-lg bg-surface p-6 shadow-float md:mt-12">
            <h2 className="text-heading">{v.failure ? 'This notice could not be read' : 'Reading the notice…'}</h2>
            <p className="mt-2 text-body text-text-secondary">{v.failure?.message ?? 'Figures appear once every line is read and checked.'}</p>
            {v.failure ? (
              <form method="post" action={`/api/notices/${v.id}/read`} className="mt-5">
                <button type="submit" className={`${PILL} inline-flex h-11 bg-surface text-text-secondary shadow-float transition duration-120 hover:bg-surface-muted active:scale-[.98]`}>
                  Try reading again
                </button>
              </form>
            ) : null}
            <RefreshWhileReading active={v.status === 'reading'} />
          </section>
        ) : (
          <>
            <section
              data-testid="summary"
              aria-label="Summary"
              className={`mt-8 grid grid-cols-1 divide-y divide-line rounded-lg bg-surface p-5 shadow-float md:mt-12 md:grid-cols-3 md:divide-x md:divide-y-0 md:p-6 ${listOnly}`}
            >
              <Tile
                id="notice-says"
                label={`Notice says${t?.name ? ` · ${t.name}` : ''}`}
                fig={t?.statedTotal ?? null}
                empty={
                  t?.flagged ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-number-lg num text-text-muted">—</span>
                      <StatusPill line="confirm" />
                      <span className="w-full text-caption text-text-muted">The printed total was read with low confidence</span>
                    </span>
                  ) : (
                    <span className="text-caption text-text-muted">No total printed</span>
                  )
                }
              />
              <Tile
                id="recomputed"
                label="Recomputed"
                fig={t?.computedTotal ?? null}
                materialize
                extra={
                  t?.calc ? (
                    <CalcDrawer title="How the total was recomputed" subtitle={t.name} calc={t.calc} stated={t.statedTotal} difference={t.difference} className="mt-1" />
                  ) : null
                }
                empty={
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-number-lg num text-text-muted">—</span>
                    <span className="text-caption text-text-muted">{lines.some((l) => l.state === 'confirm') ? 'Confirm the flagged lines first' : 'Not every line can be checked'}</span>
                  </span>
                }
              />
              <Tile
                id="difference"
                label="Difference"
                fig={t?.difference ?? null}
                materialize
                empty={
                  t?.statedTotal && t.computedTotal ? (
                    <StatusPill line="verified" />
                  ) : (
                    <span className="text-number-lg num text-text-muted">—</span>
                  )
                }
              />
            </section>
            {/* R5.6: said once, under the totals it affects. */}
            {unchecked ? (
              <p data-testid="unchecked-caption" className={`mt-3 px-1 text-caption text-text-muted ${listOnly}`}>
                {unchecked}
              </p>
            ) : null}

            <div className="mt-8 grid grid-cols-1 gap-4 md:mt-12 md:gap-6 lg:grid-cols-12 lg:items-start">
              <div className={`lg:col-span-7 ${listOnly}`}>
                <Paper fog={a.fog} aura={auraOf(lines.map((l) => l.state))} label="The notice, line by line">
                  <div className="flex items-baseline justify-between gap-3 px-1">
                    <p className="text-label uppercase text-text-muted">Lines on the notice</p>
                    <p className="text-caption text-text-muted">{lines.length ? 'Select a line to see why' : ''}</p>
                  </div>
                  {lines.length ? (
                    <ul className="mt-4 space-y-2">
                      {lines.map((l, i) => (
                        <HauntedLine
                          key={i}
                          index={i}
                          state={l.state}
                          label={l.label}
                          meta={l.hts ? `${l.hts}${l.rateText ? ` · ${l.rateText}` : ''}` : undefined}
                          stated={l.stated}
                          computed={l.computed}
                          rateText={l.rateText}
                          href={`/notices/${id}?line=${i + 1}`}
                          selected={i === sel}
                        />
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-6 text-body text-text-secondary">This notice asks for information and states no duty, so there is nothing to recompute.</p>
                  )}
                </Paper>
                {a.flags.length ? (
                  <section aria-label="Other flagged fields" className="mt-4 rounded-lg bg-surface p-5 shadow-float md:mt-6 md:p-6">
                    <p className="text-label uppercase text-text-muted">Needs a decision</p>
                    <p className="mt-1 text-body text-text-secondary">These values on the notice were read with low confidence or failed a consistency check.</p>
                    <div className="mt-4">
                      <ConfirmForm noticeId={id} flags={a.flags} title="Confirm fields" />
                    </div>
                  </section>
                ) : null}
              </div>

              {line ? (
                // Desktop: sticky 5/12 column. Tablet: a right drawer when a line is chosen. Phone: the line view.
                <SidePanelDrawer open={explicit} lineHref={`/notices/${id}?line=${sel + 1}`} closeHref={`/notices/${id}`}>
                  <LinePanel
                    noticeId={id}
                    line={line}
                    tariff={tariff}
                    backHref={`/notices/${id}`}
                    className={`rounded-lg bg-surface p-5 shadow-raised md:p-6 lg:sticky lg:top-6 lg:col-span-5 lg:max-h-[calc(100vh-48px)] lg:overflow-y-auto ${explicit ? '' : 'max-md:hidden'}`}
                  />
                </SidePanelDrawer>
              ) : null}
            </div>
          </>
        )}
      </Page>

      <div data-testid="thumb-bar" className={`fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-canvas via-canvas/90 to-transparent px-4 pt-6 pb-[max(16px,env(safe-area-inset-bottom))] md:hidden ${listOnly}`}>
        <Exorcise id="exorcise-why-phone" reason={reason} href={exorcise} className="" />
      </div>
    </div>
  );
}
