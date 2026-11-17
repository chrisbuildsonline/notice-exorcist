import { readFileSync } from 'node:fs';
import { computeTotal, type FeeResult, makeFig } from '@notice-exorcist/duty-engine';
import { extractNotice } from '@notice-exorcist/notice-extract';
import { type Assessment, assess, type FigureJson, figJson } from './assess';
import { SPECIMENS } from './db';
import { extractConfig, fixturesDir } from './intake';
import type { NoticeView } from './notice-view';

/** Engine total of every notice's amount at stake, or null when no notice has one. */
export function totalAtStake(views: NoticeView[]): FigureJson | null {
  const parts: FeeResult[] = views.flatMap((v) => {
    const s = v.assessment?.atStake;
    if (!s) return [];
    const fee = makeFig(s.value, { kind: 'computed', formulaId: 'notice.atStake', inputs: {}, rounding: 'none' });
    return [{ status: 'ok' as const, fee, unrounded: fee.value, formulaId: 'notice.atStake' }];
  });
  if (parts.length === 0) return null;
  const t = computeTotal(parts);
  return t.status === 'ok' ? figJson(t.total) : null;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** "at stake across 2 haunted notices · 1 at peace" */
export function inboxCaption(views: NoticeView[]): string {
  if (views.length === 0) return 'No notices yet';
  const count = (k: string) => views.filter((v) => v.assessment?.status.kind === k).length;
  const reading = views.filter((v) => v.status === 'reading').length;
  const parts = [
    count('haunted') && plural(count('haunted'), 'haunted notice', 'haunted notices'),
    count('unverified') && `${count('unverified')} unverified`,
    count('at_peace') && `${count('at_peace')} at peace`,
    reading && `${reading} reading`,
  ].filter(Boolean);
  return `at stake across ${parts.join(' · ') || plural(views.length, 'notice', 'notices')}`;
}

/** "just now", "5m", "2h", "3d" */
export function ago(iso: string, now = Date.now()): string {
  const s = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

let preview: Promise<Assessment | null> | undefined;

/** The haunted Form 29 specimen, read from its recording and checked by the engine, for the empty-state card. */
export function specimenPreview(): Promise<Assessment | null> {
  preview ??= (async () => {
    const bytes = new Uint8Array(readFileSync(SPECIMENS[0]!.path));
    const r = await extractNotice({ bytes }, { config: extractConfig('specimen'), fixturesDir: fixturesDir() });
    return r.ok ? assess(r) : null;
  })();
  return preview;
}
