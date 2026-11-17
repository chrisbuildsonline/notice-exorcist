import { describe, expect, it, vi } from 'vitest';
import { guardExplanation } from './explanation-guard';

// Figures with provenance for one line, as pre-formatted strings the text may quote.
const sourced = ['$385.02', '$442.98', '9.2%', '6302.91.00', '12.1¢/kg + 4.6%'];

describe('guardExplanation', () => {
  it('keeps sentences that quote only figures with provenance', () => {
    const text = 'The notice says $385.02. Duty-engine gets $442.98 at 9.2% under 6302.91.00. The rate is 12.1¢/kg + 4.6%.';
    expect(guardExplanation(text, sourced)).toEqual({ text, dropped: 0 });
  });

  it('keeps sentences with no numbers at all', () => {
    const text = 'Ad valorem means a share of the value. Nothing here is a number.';
    expect(guardExplanation(text, sourced).text).toBe(text);
  });

  it('drops a sentence with an unknown number and logs a warning code, not the text', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const r = guardExplanation('The notice says $385.02. You may owe $57.96 more. Check the rate.', sourced);
    expect(r).toEqual({ text: 'The notice says $385.02. Check the rate.', dropped: 1 });
    expect(warn).toHaveBeenCalledWith('explanation_unsourced_figure', { dropped: 1 });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('57.96');
    warn.mockRestore();
  });

  it('drops an "approximately" value even when the number is sourced', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(guardExplanation('The duty is approximately $442.98. The rate is 9.2%.', sourced)).toEqual({ text: 'The rate is 9.2%.', dropped: 1 });
    expect(guardExplanation('Roughly 9% of the value. About 9.2% applies.', sourced).dropped).toBe(2);
    warn.mockRestore();
  });

  it('a number must match a whole sourced figure, not a fragment of one', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(guardExplanation('It is 385.0 or 6302.', sourced).dropped).toBe(1);
    expect(guardExplanation('Spelled 385.02 without the sign.', sourced).dropped).toBe(0);
    vi.restoreAllMocks();
  });
});
