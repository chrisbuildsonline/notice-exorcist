import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SPECIMEN_DIR } from '../test/wrap';
import { sniff } from './sniff';

const file = (name: string) => new Uint8Array(readFileSync(join(SPECIMEN_DIR, name)));

describe('sniff: type from magic bytes, never from the name', () => {
  it.each([
    ['specimen-1-form28.pdf', 'pdf'],
    ['specimen-2-form29.pdf', 'pdf'],
    ['specimen-3-courier.pdf', 'pdf'],
    ['specimen-2-form29.png', 'png'],
    ['specimen-2-form29.photo.jpg', 'jpeg'],
  ])('%s is %s', (name, type) => {
    expect(sniff(file(name))).toBe(type);
  });

  it('ignores the file name: the bytes decide', () => {
    const renamed = { name: 'notice.pdf', bytes: file('specimen-2-form29.photo.jpg') };
    expect(sniff(renamed.bytes)).toBe('jpeg');
  });

  it('returns null (unsupported_input) for a GIF header, empty bytes and a text file named .pdf', () => {
    expect(sniff(new TextEncoder().encode('GIF89a\x01\x00'))).toBeNull();
    expect(sniff(new Uint8Array())).toBeNull();
    expect(sniff(new TextEncoder().encode('this is not a pdf, just text in a file named notice.pdf'))).toBeNull();
    expect(sniff(new Uint8Array([0x89, 0x50]))).toBeNull();
  });
});
