// `bun run data:fetch [--refresh]`: the only network code in this package. Downloads into data/,
// updates manifest.json and the generated lines of SOURCES.md.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR, RULING_SELECTION } from '../config';
import { Manifest } from '../schemas';
import { fetchRulings } from './cross';
import { fetchHts } from './hts';
import { writeAtomic } from './io';
import { regenerateSourcesNote } from './sources-note';

const manifestPath = join(DATA_DIR, 'manifest.json');
const sourcesPath = join(DATA_DIR, 'SOURCES.md');
const old: Manifest | null = existsSync(manifestPath) ? Manifest.parse(JSON.parse(readFileSync(manifestPath, 'utf8'))) : null;

try {
  const hts = await fetchHts(DATA_DIR);
  console.log(`HTS ${hts.edition}: ${Object.keys(hts.files).length} chapters`);
  const rulings = await fetchRulings(DATA_DIR, RULING_SELECTION, { refresh: process.argv.includes('--refresh') });
  console.log(`CROSS: ${Object.keys(rulings.files).length} rulings downloaded`);

  const manifest: Manifest = { edition: hts.edition, files: { ...old?.files, ...hts.files, ...rulings.files } };
  writeAtomic(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  writeAtomic(sourcesPath, regenerateSourcesNote(readFileSync(sourcesPath, 'utf8'), manifest));

  if (rulings.failures.length) {
    console.error(`${rulings.failures.length} rulings failed:\n${rulings.failures.join('\n')}`);
    process.exit(1);
  }
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
