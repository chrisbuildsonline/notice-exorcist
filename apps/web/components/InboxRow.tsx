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
    <li className="-mx-3 flex min-h-[72px] items-center gap-3 rounded-sm px-3 py-3 transition-colors duration-120 hover:bg-surface-muted md:gap-4">
      <KindIcon kind={v.kind} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-body font-medium">{v.title}</p>
        <p className="mt-0.5 line-clamp-2 text-caption text-text-muted md:truncate">
          {v.summary}
          <span className="md:hidden"> · {time}</span>
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1.5 md:flex-row md:items-center md:gap-5">
        {stake ? <Figure value={stake.value} prov={stake.prov} source={stake.source} /> : <span className="text-number num text-text-muted">—</span>}
        <StatusPill notice={status} />
      </div>
      <span className="hidden w-16 shrink-0 text-right text-caption text-text-muted md:block">{time}</span>
    </li>
  );
}
