import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LICENSE_TEXT } from './license';

const MIT_PERMISSION =
  'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:';

const flat = (t: string) => t.replace(/\s+/g, ' ');

describe('specimen LICENSE.txt', () => {
  it('says the specimens are synthetic and original, with no real person, company or entry', () => {
    const t = flat(LICENSE_TEXT);
    expect(t).toContain('synthetic');
    expect(t).toContain('original');
    expect(t).toMatch(/no real person, company or (customs )?entry/);
    expect(t).toContain('Not issued by CBP or any courier');
  });

  it('is the MIT license with its permission sentence', () => {
    const t = flat(LICENSE_TEXT);
    expect(t).toContain('MIT License');
    expect(t).toContain(MIT_PERMISSION);
    expect(t).toContain('THE SOFTWARE IS PROVIDED "AS IS"');
  });

  it('keeps the copyright line of the repository LICENSE', () => {
    const repoCopyright = /^Copyright .*$/m.exec(readFileSync(join(import.meta.dirname, '../../LICENSE'), 'utf8'))![0];
    expect(LICENSE_TEXT).toContain(repoCopyright);
  });

  it('ends with a newline and has no clock input', () => {
    expect(LICENSE_TEXT.endsWith('\n')).toBe(true);
    expect(readFileSync(join(import.meta.dirname, 'license.ts'), 'utf8')).not.toMatch(/new Date|Date\.now/);
  });
});
