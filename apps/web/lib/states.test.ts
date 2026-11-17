import { describe, expect, it } from 'vitest';
import { fogOpacity, lineState, noticeStatus, type LineState } from './states';

describe('lineState', () => {
  it('follows confirm > unsupported > disagrees > unverified > verified', () => {
    expect(lineState({ comparison: 'disagrees', needsConfirmation: true })).toBe('confirm');
    expect(lineState({ comparison: 'unsupported', needsConfirmation: true })).toBe('confirm');
    expect(lineState({ comparison: 'unsupported', needsConfirmation: false })).toBe('unsupported');
    expect(lineState({ comparison: 'disagrees', needsConfirmation: false })).toBe('disagrees');
    expect(lineState({ comparison: null, needsConfirmation: false })).toBe('unverified');
    expect(lineState({ comparison: 'verified', needsConfirmation: false })).toBe('verified');
  });
});

describe('noticeStatus', () => {
  it('is haunted with the count of disagreeing lines', () => {
    expect(noticeStatus(['verified', 'disagrees', 'unverified', 'disagrees'])).toEqual({ kind: 'haunted', count: 2 });
  });
  it('is unverified while any line is unverified or needs confirmation', () => {
    expect(noticeStatus(['verified', 'unverified'])).toEqual({ kind: 'unverified' });
    expect(noticeStatus(['verified', 'confirm'])).toEqual({ kind: 'unverified' });
  });
  it('is at peace when every checkable line is verified', () => {
    expect(noticeStatus(['verified', 'verified'])).toEqual({ kind: 'at_peace' });
    expect(noticeStatus(['verified', 'unsupported'])).toEqual({ kind: 'at_peace' });
    expect(noticeStatus([])).toEqual({ kind: 'at_peace' });
  });
});

describe('fogOpacity', () => {
  it('is 0.15 + 0.85 x (unverified + disagreeing) / total', () => {
    const s: LineState[] = ['verified', 'disagrees', 'unverified', 'confirm'];
    expect(fogOpacity(s)).toBeCloseTo(0.15 + 0.85 * (2 / 4), 10);
    expect(fogOpacity(['disagrees'])).toBeCloseTo(1, 10);
  });
  it('is 0 when all lines are verified, or there are none', () => {
    expect(fogOpacity(['verified', 'verified'])).toBe(0);
    expect(fogOpacity([])).toBe(0);
  });
});
