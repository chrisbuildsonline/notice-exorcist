import { ago } from '../lib/inbox';
import type { NoticeView } from '../lib/notice-view';
import { Figure } from './Figure';
import { StatusPill } from './StatusPill';

function KindIcon({ kind }: { kind: string | null }) {
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-muted text-text-secondary" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        {kind === 'courier_duty_invoice' ? (
          <>
            <path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z" />
            <path d="M3 7.5 12 12l9-4.5M12 12v9" />
          </>
        ) : (
          <>
            <path d="M7 3h7l4 4v14H7z" />
            <path d="M14 3v4h4M10 12h5M10 16h5" />
          </>
        )}
      </svg>
    </span>
  );
}

/** One notice: kind icon, title, short line, amount at stake, status pill, time. */
export function InboxRow({ v }: { v: NoticeView }) {
  const time = ago(v.createdAt);
  const stake = v.assessment?.atStake;
  const status = v.assessment?.status ?? { kind: v.status === 'failed' ? ('failed' as const) : ('reading' as const) };
  return (
    // Phone: stacked (title, short line, then amount + pill + time). Desktop: one 72px row.
    <li className="-mx-3 flex min-h-[72px] gap-3 rounded-sm px-3 py-3 transition-colors duration-120 hover:bg-surface-muted md:items-center md:gap-4">
      <KindIcon kind={v.kind} />
      <div className="min-w-0 flex-1 md:flex md:items-center md:gap-5">
        <div className="min-w-0 md:flex-1">
          <p data-testid="row-title" className="line-clamp-2 text-body font-medium md:line-clamp-none md:truncate">
            {v.title}
          </p>
          <p data-testid="row-summary" className="mt-0.5 truncate text-caption text-text-muted">
            {v.summary}
          </p>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 md:mt-0 md:shrink-0 md:flex-nowrap md:gap-5">
          {stake ? <Figure value={stake.value} prov={stake.prov} source={stake.source} /> : <span className="text-number num text-text-muted">—</span>}
          <StatusPill notice={status} />
          <span className="ml-auto whitespace-nowrap text-caption text-text-muted md:ml-0 md:w-16 md:text-right">{time}</span>
        </div>
      </div>
    </li>
  );
}
