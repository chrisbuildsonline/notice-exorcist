import { GUARD_RULES, type GuardRule } from './honesty';

/**
 * The only logger in the package. It takes whitelisted keys only, so notice contents, extracted values
 * and model responses cannot reach a log by accident.
 */
const ALLOWED = ['kind', 'hash', 'durationMs', 'code', 'provider', 'model', 'mode'] as const;
type Key = (typeof ALLOWED)[number];

/** `guards` holds honesty guard counts by rule name, never a path or a value. */
export type LogFields = Partial<Record<Key, string | number>> & { guards?: Partial<Record<GuardRule, number>> };

export function logEvent(event: string, fields: LogFields): void {
  const safe: Record<string, string | number | Record<string, number>> = {};
  for (const k of ALLOWED) {
    const v = fields[k];
    if (typeof v === 'number' || (typeof v === 'string' && /^[\w.:/-]{0,100}$/.test(v))) safe[k] = v;
  }
  const guards: Record<string, number> = {};
  for (const rule of GUARD_RULES) {
    const n = fields.guards?.[rule];
    if (typeof n === 'number') guards[rule] = n;
  }
  if (Object.keys(guards).length > 0) safe.guards = guards;
  console.info(`[notice-extract] ${event} ${JSON.stringify(safe)}`);
}
