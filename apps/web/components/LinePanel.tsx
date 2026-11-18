import Link from 'next/link';
import type { AssessedLine } from '../lib/assess';
import { explainLine } from '../lib/explain';
import type { HtsCandidate, RulingRef } from '../lib/tariff';
import { CalcDrawer, type HtsRef } from './CalcDrawer';
import { ConfirmForm } from './ConfirmForm';
import { Figure } from './Figure';
import { StatusPill } from './StatusPill';

const Label = ({ children }: { children: string }) => <p className="text-label uppercase text-text-muted">{children}</p>;

/** "Line 1 · Cotton towels" -> "Line 1" for the heading; the description goes underneath. */
const heading = (l: AssessedLine) => l.label.split(' · ')[0] ?? l.label;

/** The printed code's HTS line, for the edition the drawer cites. */
function htsRef(l: AssessedLine, tariff: { candidates: HtsCandidate[] } | null): HtsRef | 'not-built' | 'not-found' {
  if (!tariff) return 'not-built';
  const c = tariff.candidates.find((x) => x.printed);
  return c ? { code: c.code, rate: c.rate, edition: c.edition } : 'not-found';
}

/** The selected line: what it means, its figures, the confirm form, HTS candidates and CROSS rulings with citations. */
export function LinePanel(props: {
  noticeId: string;
  line: AssessedLine;
  backHref: string;
  tariff: { candidates: HtsCandidate[]; rulings: RulingRef[] } | null;
  className: string;
}) {
  const { line: l, tariff } = props;
  return (
    <aside aria-label="Line details" className={props.className}>
      <Link href={props.backHref} scroll={false} className="-ml-2 mb-4 inline-flex h-11 items-center gap-1 rounded-full px-2 text-body font-medium text-accent md:hidden">
        <span aria-hidden="true">←</span>
        All lines
      </Link>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-heading">{heading(l)}</h2>
          {l.description ? <p className="mt-0.5 text-body text-text-secondary">{l.description}</p> : null}
        </div>
        <StatusPill line={l.state} />
      </div>
      {l.hts || l.rateText ? (
        <p className="mt-2 font-mono text-mono text-text-muted">{[l.hts && `HTS ${l.hts}`, l.rateText && `rate ${l.rateText}`].filter(Boolean).join(' · ')}</p>
      ) : null}

      <section className="mt-8">
        <Label>What this means</Label>
        <p data-testid="explanation" className="mt-2 text-body text-text-secondary">
          {explainLine(l)}
        </p>
        <dl className="mt-4 grid grid-cols-1 gap-3 rounded-md bg-surface-muted p-4 sm:grid-cols-2">
          <div>
            <dt className="text-caption text-text-muted">Notice says</dt>
            <dd className="mt-0.5">{l.stated ? <Figure {...l.stated} /> : <span className="text-number num text-text-muted">—</span>}</dd>
          </div>
          <div>
            <dt className="text-caption text-text-muted">Recomputed</dt>
            <dd className="mt-0.5">
              {l.computed ? <Figure {...l.computed} /> : <span className="text-caption text-text-muted">{l.state === 'confirm' ? 'After you confirm' : 'Not checked'}</span>}
            </dd>
          </div>
          {l.difference ? (
            <div className="sm:col-span-2">
              <dt className="text-caption text-text-muted">Difference</dt>
              <dd className="mt-0.5">
                <Figure {...l.difference} />
              </dd>
            </div>
          ) : null}
        </dl>
        {l.calc ? (
          <CalcDrawer
            className="mt-3"
            title={l.label.startsWith('Line ') ? `How ${heading(l).toLowerCase()} was computed` : `How the ${l.label} was computed`}
            subtitle={l.description}
            calc={l.calc}
            stated={l.stated}
            difference={l.difference}
            hts={l.calc.formulaId.startsWith('line.') ? htsRef(l, tariff) : undefined}
          />
        ) : l.state === 'unsupported' && l.rateText ? (
          // No calculation to show: the drawer quotes the rate text, the HTS edition and why the engine stopped (R5.8).
          <CalcDrawer
            className="mt-3"
            title={`How ${heading(l).toLowerCase()} was checked`}
            subtitle={l.description}
            unsupported={{ rateText: l.rateText, reason: 'unsupported rate text' }}
            stated={l.stated}
            difference={null}
            hts={htsRef(l, tariff)}
          />
        ) : null}
      </section>

      {l.confirm.length ? (
        <section className="mt-6">
          <ConfirmForm noticeId={props.noticeId} flags={l.confirm} />
        </section>
      ) : null}

      {l.hts || l.description ? (
        <>
          <section className="mt-8">
            <Label>Candidate HTS codes</Label>
            <p className="mt-1 text-caption text-text-muted">Candidates, not a final classification</p>
            {tariff === null ? (
              <p className="mt-3 text-caption text-text-muted">The tariff index is not built on this server, so no candidates can be shown.</p>
            ) : tariff.candidates.length === 0 ? (
              <p className="mt-3 text-caption text-text-muted">No HTS line in the index matches these goods.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {tariff.candidates.map((c) => (
                  <li key={c.code} data-testid="hts-candidate" className="py-3">
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <span className="font-mono text-mono font-semibold text-ink">{c.code}</span>
                      <span className="inline-flex items-baseline gap-1.5">
                        <span className="text-body font-semibold num">{c.rate}</span>
                        <span className="rounded-xs bg-surface-muted px-1.5 text-[11px] leading-4 font-semibold text-text-secondary" title={c.source}>
                          tariff
                        </span>
                      </span>
                      {c.printed ? <span className="text-caption text-text-muted">printed on the notice</span> : null}
                    </div>
                    <p className="mt-1 line-clamp-2 text-caption text-text-secondary">{c.description}</p>
                    <a
                      href={`https://hts.usitc.gov/search?query=${encodeURIComponent(c.code)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-1 inline-flex min-h-6 items-center gap-1 rounded-xs bg-accent-50 px-1.5 text-[12px] leading-5 font-semibold text-accent hover:text-accent-700"
                    >
                      USITC · {c.edition} ↗
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="mt-8">
            <Label>CROSS rulings</Label>
            {tariff === null || tariff.rulings.length === 0 ? (
              <p className="mt-3 text-caption text-text-muted">{tariff === null ? 'The tariff index is not built on this server.' : 'No ruling in the index cites this heading.'}</p>
            ) : (
              <ul className="mt-2 divide-y divide-line">
                {tariff.rulings.map((r) => (
                  <li key={r.number} data-testid="ruling" className="py-3">
                    <a href={r.url} target="_blank" rel="noreferrer" className="inline-flex min-h-6 items-center gap-2 font-mono text-mono font-semibold text-accent underline-offset-2 hover:text-accent-700 hover:underline">
                      {r.number} ↗
                    </a>
                    <span className="ml-2 text-caption text-text-muted">{r.date.slice(0, 4)}</span>
                    <p className="mt-0.5 text-caption text-text-secondary">{r.title}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </aside>
  );
}
