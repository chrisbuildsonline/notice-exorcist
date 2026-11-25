import type { CSSProperties } from 'react';

/**
 * The page mist (DESIGN.md 3.1): fixed behind every surface, lighter than the canvas, at opacity 0.4 + 0.6 × level.
 * Level 0 (at peace) draws nothing. `exorcised` lifts it away: the approved reply.
 */
export function Haunt({ level, exorcised = false }: { level: number; exorcised?: boolean }) {
  if (level <= 0) return null;
  return (
    <div
      aria-hidden="true"
      data-testid="haunt-fog"
      data-exorcised={exorcised ? '' : undefined}
      className="haunt"
      style={{ '--haunt': Math.min(1, level) } as CSSProperties}
    >
      <div className="haunt-mist" />
      <div className="haunt-mist haunt-mist-b" />
    </div>
  );
}

/** The first-load veil (DESIGN.md 3.1): in the root layout, so it lifts once per full load. Hidden at rest. */
export function HauntVeil() {
  return <div aria-hidden="true" data-testid="haunt-veil" className="haunt-veil" />;
}
