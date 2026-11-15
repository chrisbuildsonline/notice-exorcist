import { describe, expect, it } from 'bun:test';
import { parseRateText } from '@notice-exorcist/duty-engine';
import { lookupHts, openIndex } from '@notice-exorcist/tariff-data';
import { HTS_PICKS, SPECIMENS } from './data';

// Runs under `bun test`: the tariff index needs bun:sqlite. Build it with `bun run --cwd packages/tariff-data data:build`.
const db = openIndex();
const lines = SPECIMENS.flatMap((s) => s.lines.map((l) => ({ id: s.specimenId, notes: s.notes, ...l })));

describe('HTS picks', () => {
  it('lists at least one free, one ad valorem and one compound or specific rate', () => {
    const kinds = new Set(HTS_PICKS.map((p) => parseRateText(p.rateText).kind));
    expect(kinds.has('free')).toBe(true);
    expect(kinds.has('ad_valorem')).toBe(true);
    expect(kinds.has('compound') || kinds.has('specific')).toBe(true);
  });

  it.each(HTS_PICKS.map((p) => [p.hts, p]))('%s exists with the exact general rate text and a supported rate', (_, p) => {
    const r = lookupHts(db, p.hts);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.code).toBe(p.hts);
    expect(r.general).toBe(p.rateText);
    expect(parseRateText(p.rateText).kind).not.toBe('unsupported');
  });
});

describe('specimen lines', () => {
  it.each(lines.map((l) => [`${l.id} line ${l.n}`, l]))('%s uses a picked code with its index rate text', (_, l) => {
    expect(HTS_PICKS.some((p) => p.hts === l.hts && p.rateText === l.rateText)).toBe(true);
    const r = lookupHts(db, l.hts);
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    expect(r.general).toBe(l.rateText);
    if (parseRateText(l.rateText).kind === 'unsupported') {
      expect(l.notes.some((n) => n.includes(l.hts))).toBe(true);
    }
  });
});
