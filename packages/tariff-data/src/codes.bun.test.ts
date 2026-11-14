import { describe, expect, test } from 'bun:test';
import { chapterOf, headingOf, isInScope, normalizeHts } from './codes';

describe('normalizeHts', () => {
  test('formats 4, 6, 8 and 10 digit codes with dots', () => {
    expect(normalizeHts('6109100012')).toBe('6109.10.00.12');
    expect(normalizeHts('6109.10.00.12')).toBe('6109.10.00.12');
    expect(normalizeHts('6109.10.00')).toBe('6109.10.00');
    expect(normalizeHts('610910')).toBe('6109.10');
    expect(normalizeHts('6109')).toBe('6109');
    expect(normalizeHts(' 6109.10.0012 ')).toBe('6109.10.00.12');
  });

  test('rejects other lengths and non-digit input', () => {
    expect(normalizeHts('61091')).toBeNull();
    expect(normalizeHts('61')).toBeNull();
    expect(normalizeHts('')).toBeNull();
    expect(normalizeHts('abc')).toBeNull();
    expect(normalizeHts('6109x10000')).toBeNull();
    expect(normalizeHts('0009.10.00')).toBeNull();
  });
});

describe('chapters and headings', () => {
  test('chapterOf and headingOf read the leading digits', () => {
    expect(chapterOf('6109.10.00.12')).toBe('61');
    expect(headingOf('6109.10.00.12')).toBe('6109');
  });

  test('isInScope is true for scope chapters only', () => {
    expect(isInScope('3926.90.99')).toBe(true);
    expect(isInScope('6109.10.00')).toBe(true);
    expect(isInScope('9903.88.15')).toBe(false);
    expect(isInScope('8703.23.01')).toBe(false);
  });
});
