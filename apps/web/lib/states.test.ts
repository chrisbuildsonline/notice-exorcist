import { describe, expect, it } from 'vitest';
import { fogOpacity, inboxFog, lineState, noticeStatus, type LineState } from './states';

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

describe('inboxFog (DESIGN.md 3.1)', () => {
  it('is 0.6 on the empty Inbox, whose hero is the haunted specimen', () => {
    expect(inboxFog([])).toBe(0.6);
  });
  it('is 0.15 + 0.85 x (haunted + unverified) / notices', () => {
    expect(inboxFog(['haunted', 'at_peace'])).toBeCloseTo(0.15 + 0.85 / 2, 10);
    expect(inboxFog(['haunted', 'unverified', 'at_peace', 'reading'])).toBeCloseTo(0.15 + (0.85 * 2) / 4, 10);
    expect(inboxFog(['haunted'])).toBeCloseTo(1, 10);
  });
  it('is 0 when no notice is haunted or unverified', () => {
    expect(inboxFog(['at_peace', 'at_peace'])).toBe(0);
    expect(inboxFog(['reading', 'failed'])).toBe(0);
  });
});
