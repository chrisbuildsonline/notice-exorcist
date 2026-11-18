import { describe, expect, it } from 'vitest';
import { formatBytes } from './format-bytes';

describe('formatBytes: file sizes, not money', () => {
  it('uses MB from 1 MB up, with one decimal', () => {
    expect(formatBytes(10 * 1024 * 1024)).toBe('10.0 MB');
    expect(formatBytes(13 * 1024 * 1024)).toBe('13.0 MB');
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
  });

  it('rounds up, so a file just over a limit never looks equal to it', () => {
    expect(formatBytes(10 * 1024 * 1024 + 1)).toBe('10.1 MB');
    expect(formatBytes(1536 + 1)).toBe('1.6 KB');
  });

  it('uses KB under 1 MB and bytes under 1 KB', () => {
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(512 * 1024)).toBe('512.0 KB');
    expect(formatBytes(0)).toBe('0 bytes');
    expect(formatBytes(1)).toBe('1 byte');
    expect(formatBytes(900)).toBe('900 bytes');
  });
});
