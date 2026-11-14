// `bun run data:build`: data/ -> SQLite index at TARIFF_INDEX_PATH (default .cache/tariff.sqlite).
import { DATA_DIR, INDEX_PATH } from '../config';
import { buildIndex } from './build';

try {
  const r = buildIndex(DATA_DIR, INDEX_PATH);
  console.log(`${INDEX_PATH}: ${JSON.stringify(r)}`);
} catch (e) {
  console.error((e as Error).message);
  process.exit(1);
}
