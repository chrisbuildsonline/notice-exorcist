/** Neutral grey haze behind the rows (z below them, so text contrast is untouched). Gone when every line is verified. */
export function Fog({ opacity }: { opacity: number }) {
  if (opacity <= 0) return null;
  return <div aria-hidden="true" data-testid="fog" className="fog absolute inset-0 -z-10 rounded-lg" style={{ opacity }} />;
}
