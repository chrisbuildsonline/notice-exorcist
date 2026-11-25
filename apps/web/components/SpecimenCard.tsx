import type { Assessment } from '../lib/assess';
import { auraOf } from '../lib/states';
import { HauntedLine } from './HauntedLine';
import { StatusPill } from './StatusPill';

/** The empty-state visual: the real Form 29 specimen as checked by the engine, drawn as paper tilted 2°. */
export function SpecimenCard({ a }: { a: Assessment }) {
  return (
    <div
      data-testid="specimen-card"
      data-aura={auraOf(a.lines.map((l) => l.state)) ?? undefined}
      className="paper mx-auto w-full max-w-md rotate-2 rounded-lg bg-surface p-5 shadow-raised md:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-label uppercase text-text-muted">Specimen</p>
          <p className="mt-1 text-body font-medium">CBP Form 29 · Notice of Action</p>
        </div>
        <StatusPill notice={a.status} />
      </div>
      <ul className="mt-4 space-y-1.5">
        {a.lines.slice(0, 4).map((l, i) => (
          <HauntedLine key={i} index={i} state={l.state} label={l.label} stated={l.stated} computed={l.computed} />
        ))}
      </ul>
    </div>
  );
}
