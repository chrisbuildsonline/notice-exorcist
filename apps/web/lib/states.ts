/** Line and notice states. Pure functions over engine comparisons and extraction confidence, never model output. */

export type LineState = 'confirm' | 'unsupported' | 'disagrees' | 'unverified' | 'verified';

export type NoticeStatus = { kind: 'haunted'; count: number } | { kind: 'unverified' } | { kind: 'at_peace' };

/**
 * `comparison` is the duty-engine result for the line, or null when the engine has not checked it.
 * Precedence: confirm > unsupported > disagrees > unverified > verified.
 */
export function lineState(input: { comparison: 'verified' | 'disagrees' | 'unsupported' | null; needsConfirmation: boolean }): LineState {
  if (input.needsConfirmation) return 'confirm';
  if (input.comparison === 'unsupported') return 'unsupported';
  if (input.comparison === 'disagrees') return 'disagrees';
  if (input.comparison === null) return 'unverified';
  return 'verified';
}

/** `! Haunted · n` when any line disagrees, `? Unverified` while any is unchecked or unconfirmed, else `✓ At peace`. */
export function noticeStatus(states: LineState[]): NoticeStatus {
  const count = states.filter((s) => s === 'disagrees').length;
  if (count > 0) return { kind: 'haunted', count };
  if (states.some((s) => s === 'unverified' || s === 'confirm')) return { kind: 'unverified' };
  return { kind: 'at_peace' };
}

/** DESIGN.md 3.1: the paper's aura. Ember while any line disagrees, amber while any is only unverified, else none. */
export function auraOf(states: LineState[]): 'haunt' | 'unverified' | null {
  if (states.includes('disagrees')) return 'haunt';
  return states.includes('unverified') ? 'unverified' : null;
}

/** DESIGN.md 3: 0.15 + 0.85 × (unverified + disagreeing) / total, and 0 when every line is verified. */
export function fogOpacity(states: LineState[]): number {
  if (states.length === 0 || states.every((s) => s === 'verified')) return 0;
  const haunted = states.filter((s) => s === 'unverified' || s === 'disagrees').length;
  return 0.15 + (0.85 * haunted) / states.length;
}

/**
 * DESIGN.md 3.1: the Inbox mist level. 0.15 + 0.85 × (haunted + unverified notices) / notices, 0 when none is, and
 * 0.6 on the empty Inbox, whose hero is the haunted specimen.
 */
export function inboxFog(kinds: Array<NoticeStatus['kind'] | 'reading' | 'failed'>): number {
  if (kinds.length === 0) return 0.6;
  const haunted = kinds.filter((k) => k === 'haunted' || k === 'unverified').length;
  return haunted === 0 ? 0 : 0.15 + (0.85 * haunted) / kinds.length;
}
