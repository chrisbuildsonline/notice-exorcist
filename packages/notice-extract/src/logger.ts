/**
 * The only logger in the package. It takes whitelisted keys only, so notice contents, extracted values
 * and model responses cannot reach a log by accident.
 */
const ALLOWED = ['kind', 'hash', 'durationMs', 'code', 'provider', 'model', 'mode'] as const;
type Key = (typeof ALLOWED)[number];

export type LogFields = Partial<Record<Key, string | number>>;

export function logEvent(event: string, fields: LogFields): void {
  const safe: Record<string, string | number> = {};
  for (const k of ALLOWED) {
    const v = fields[k];
    if (typeof v === 'number' || (typeof v === 'string' && /^[\w.:/-]{0,100}$/.test(v))) safe[k] = v;
  }
  console.info(`[notice-extract] ${event} ${JSON.stringify(safe)}`);
}
