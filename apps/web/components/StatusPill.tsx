import type { LineState, NoticeStatus } from '../lib/states';

type Look = { icon: string; word: string; cls: string };

const HAUNT = 'bg-haunt-bg text-haunt-fg';
const UNVERIFIED = 'bg-unverified-bg text-unverified-fg';
const CALM = 'bg-calm-bg text-calm-fg';
const NEUTRAL = 'bg-unsupported-bg text-unsupported-fg';

const LINE: Record<LineState, Look> = {
  disagrees: { icon: '!', word: 'Disagrees', cls: HAUNT },
  unverified: { icon: '?', word: 'Unverified', cls: UNVERIFIED },
  verified: { icon: '✓', word: 'Verified', cls: CALM },
  confirm: { icon: '◐', word: 'Confirm', cls: 'bg-confirm-bg text-confirm-fg' },
  unsupported: { icon: '⊘', word: 'Not checked', cls: NEUTRAL },
};

export type PillStatus = NoticeStatus | { kind: 'reading' } | { kind: 'failed' };

function noticeLook(s: PillStatus): Look {
  switch (s.kind) {
    case 'haunted':
      return { icon: '!', word: `Haunted · ${s.count}`, cls: `${HAUNT} pill-haunted` };
    case 'unverified':
      return { icon: '?', word: 'Unverified', cls: UNVERIFIED };
    case 'at_peace':
      return { icon: '✓', word: 'At peace', cls: CALM };
    case 'reading':
      return { icon: '◌', word: 'Reading', cls: NEUTRAL };
    case 'failed':
      return { icon: '⊘', word: 'Couldn’t read', cls: NEUTRAL };
  }
}

/** Status is never colour alone: every pill has an icon and a word. Status hues only, never the accent. */
export function StatusPill(props: { notice: PillStatus } | { line: LineState } | { match: boolean } | { draft: 'draft' | 'approved' }) {
  const look =
    'draft' in props
      ? props.draft === 'approved'
        ? { icon: '✓', word: 'Approved', cls: CALM }
        : { icon: '✎', word: 'Draft', cls: NEUTRAL }
      : 'line' in props
      ? LINE[props.line]
      : 'match' in props
        ? props.match
          ? { icon: '✓', word: 'Match', cls: CALM }
          : { icon: '!', word: 'Mismatch', cls: HAUNT }
        : noticeLook(props.notice);
  return (
    <span className={`inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-[12px] leading-4 font-semibold whitespace-nowrap ${look.cls}`}>
      <span aria-hidden="true">{look.icon}</span>
      {look.word}
    </span>
  );
}
