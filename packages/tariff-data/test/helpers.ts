import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildIndex } from '../src/build/build';
import { DATA_DIR } from '../src/config';
import { openIndex } from '../src/query';

/** Build the committed snapshot into a temp file and open it read-only. Any network call fails the test. */
export function freshIndex() {
  globalThis.fetch = (() => {
    throw new Error('tests must not use the network');
  }) as unknown as typeof fetch;
  const path = join(mkdtempSync(join(tmpdir(), 'tariff-it-')), 'tariff.sqlite');
  buildIndex(DATA_DIR, path);
  return openIndex(path);
}
