// `bun run data:fetch`: the only network code in this package. Downloads into data/ and updates manifest.json.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR } from '../config';
import { Manifest } from '../schemas';
import { fetchHts } from './hts';
import { writeAtomic } from './io';

const manifestPath = join(DATA_DIR, 'manifest.json');
const old: Manifest | null = existsSync(manifestPath) ? Manifest.parse(JSON.parse(readFileSync(manifestPath, 'utf8'))) : null;

try {
  const hts = await fetchHts(DATA_DIR);
  const manifest: Manifest = { edition: hts.edition, files: { ...old?.files, ...hts.files } };
  writeAtomic(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`HTS ${hts.edition}: ${Object.keys(hts.files).length} chapters`);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
