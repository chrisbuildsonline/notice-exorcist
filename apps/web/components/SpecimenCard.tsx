import type { Assessment } from '../lib/assess';
import { Figure } from './Figure';
import { StatusPill } from './StatusPill';

/** The empty-state visual: the real Form 29 specimen as checked by the engine, drawn as paper tilted 2°. */
export function SpecimenCard({ a }: { a: Assessment }) {
  return (
    <div data-testid="specimen-card" className="mx-auto w-full max-w-md rotate-2 rounded-lg bg-surface p-5 shadow-raised md:p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-label uppercase text-text-muted">Specimen</p>
          <p className="mt-1 text-body font-medium">CBP Form 29 · Notice of Action</p>
        </div>
        <StatusPill notice={a.status} />
      </div>
      <div className="mt-4 space-y-1.5">
        {a.lines.slice(0, 4).map((l, i) => (
          <div key={i} data-state={l.state} className="line flex min-h-14 flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-sm py-3 pr-3 pl-4">
            <span className="min-w-0 basis-full truncate text-caption text-text-secondary">{l.label}</span>
            <span className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
              {l.stated ? <Figure {...l.stated} /> : null}
              {l.state === 'disagrees' && l.computed ? <Figure {...l.computed} /> : null}
              <StatusPill line={l.state} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
