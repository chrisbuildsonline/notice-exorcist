import { afterAll, describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR, SCOPE_CHAPTERS } from '../src/config';
import { freshIndex } from './helpers';

const db = freshIndex();
afterAll(() => db.close());

type Raw = { htsno: string; description: string; general: string; special: string; other: string };

describe('data integrity', () => {
  test('every stored rate and description equals the raw USITC JSON', () => {
    const raw = SCOPE_CHAPTERS.flatMap((ch) => JSON.parse(readFileSync(join(DATA_DIR, 'hts', `ch${ch}.json`), 'utf8')) as Raw[]);
    const rows = db.query('SELECT description, general, special, other FROM hts_lines ORDER BY seq').all() as Omit<Raw, 'htsno'>[];
    expect(rows).toHaveLength(raw.length);
    const diffs = rows.filter((r, i) => {
      const s = raw[i]!;
      return r.general !== s.general || r.special !== s.special || r.other !== s.other || r.description !== s.description;
    });
    expect(diffs).toEqual([]);
  });

  test('every line names its source and meta.edition matches the manifest', () => {
    expect(db.query("SELECT count(*) AS n FROM hts_lines WHERE source = ''").get()).toEqual({ n: 0 });
    const { edition } = JSON.parse(readFileSync(join(DATA_DIR, 'manifest.json'), 'utf8'));
    expect(db.query("SELECT value FROM meta WHERE key = 'edition'").get()).toEqual({ value: edition });
  });

  test('every ruling links to rulings.cbp.gov', () => {
    const urls = (db.query('SELECT url FROM rulings').all() as { url: string }[]).map((r) => r.url);
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.filter((u) => !u.startsWith('https://rulings.cbp.gov/'))).toEqual([]);
  });

  test('every raw file is listed in the manifest with its sha256', () => {
    const { files } = JSON.parse(readFileSync(join(DATA_DIR, 'manifest.json'), 'utf8')) as { files: Record<string, { sha256: string }> };
    for (const [path, f] of Object.entries(files)) {
      expect({ path, sha: new Bun.CryptoHasher('sha256').update(readFileSync(join(DATA_DIR, path))).digest('hex') }).toEqual({ path, sha: f.sha256 });
    }
    const onDisk = [...new Bun.Glob('{hts,rulings}/*.json').scanSync(DATA_DIR)].sort();
    expect(Object.keys(files).sort()).toEqual(onDisk);
  });
});
