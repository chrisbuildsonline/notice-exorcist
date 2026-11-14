import { describe, expect, it } from 'vitest';
import { PROVENANCE_KINDS } from './index';

describe('duty-engine', () => {
  it('exposes the three provenance kinds every figure must carry', () => {
    expect(PROVENANCE_KINDS).toEqual(['stated', 'computed', 'tariff']);
  });
});
