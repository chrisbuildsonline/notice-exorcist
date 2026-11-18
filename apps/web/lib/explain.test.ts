import { describe, expect, it, vi } from 'vitest';
import type { AssessedLine } from './assess';
import { explainLine } from './explain';

const line = (over: Partial<AssessedLine>): AssessedLine => ({
  label: 'Line 1 · Cotton towels',
  state: 'disagrees',
  stated: { value: '385.02', prov: 'stated', source: 'page 1' },
  computed: { value: '442.98', prov: 'computed', source: 'duty-engine duty.adValorem at 9.2%' },
  difference: { value: '57.96', prov: 'computed', source: 'duty-engine compare.difference' },
  description: 'Cotton towels',
  hts: '6302.91.00',
  rateText: '9.2%',
  confirm: [],
  calc: null,
  ...over,
});

describe('explainLine (plain English, checked by the explanation guard)', () => {
  it('a disagreeing line names the printed rate and says the stated figure is kept', () => {
    const t = explainLine(line({}));
    expect(t).toContain('9.2%');
    expect(t).toMatch(/does not match/);
    expect(t).not.toMatch(/\$|385|442|57\.96/);
  });

  it('a line whose rate text the engine cannot check says so with no digits (R5.3)', () => {
    const t = explainLine(line({ state: 'unsupported', rateText: '2.4¢/kg + 5% (see note)', computed: null, difference: null }));
    expect(t).toContain('Duty-engine cannot check this rate, so the figure is shown as printed on the notice');
    expect(t).not.toMatch(/\d/);
  });

  it('every state has its own explanation', () => {
    const states = ['verified', 'unverified', 'confirm', 'unsupported', 'disagrees'] as const;
    const texts = states.map((state) => explainLine(line({ state })));
    expect(new Set(texts).size).toBe(states.length);
    expect(explainLine(line({ state: 'confirm' }))).toMatch(/confirm/i);
  });

  it('a rate text that is not a figure with provenance is dropped by the guard, sentence and all', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    // a fee has no rate text or HTS code, so a number in the text could not be sourced
    const t = explainLine(line({ state: 'verified', rateText: null, hts: null, label: 'Merchandise Processing Fee' }));
    expect(t).not.toMatch(/\d/);
    expect(t.length).toBeGreaterThan(20);
    warn.mockRestore();
  });
});
