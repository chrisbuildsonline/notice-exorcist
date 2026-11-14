import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import type { z } from 'zod';
import { chapterOf, headingOf, normalizeHts, parseTariffField } from '../codes';
import { CROSS_BASE, SCOPE_CHAPTERS } from '../config';
import { CrossRuling, HtsExport, Manifest } from '../schemas';

function load<T>(dataDir: string, path: string, schema: z.ZodType<T>): T {
  const file = join(dataDir, path);
  if (!existsSync(file)) throw new Error(`data/${path}: missing`);
  let json: unknown;
  try {
    json = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`data/${path}: not valid JSON`);
  }
  const r = schema.safeParse(json);
  if (!r.success) {
    const i = r.error.issues[0]!;
    throw new Error(`data/${path}: ${i.path.join('.')}: ${i.message}`);
  }
  return r.data;
}

type HtsRow = [chapter: string, code: string, indent: number, description: string, general: string, special: string, other: string, units: string, source: string];

/** Validate every file under `dataDir`, then write the SQLite index to `outPath` via a temp file. */
export function buildIndex(dataDir: string, outPath: string) {
  if (!existsSync(join(dataDir, 'SOURCES.md'))) throw new Error('data/SOURCES.md: missing; the snapshot must ship its sources note');
  const { edition } = load(dataDir, 'manifest.json', Manifest);

  const hts: HtsRow[] = [];
  for (const ch of SCOPE_CHAPTERS) {
    const path = `hts/ch${ch}.json`;
    load(dataDir, path, HtsExport).forEach((r, i) => {
      const code = r.htsno === '' ? '' : normalizeHts(r.htsno);
      if (code === null || (code && chapterOf(code) !== ch)) throw new Error(`data/${path}: ${i}.htsno: bad code for chapter ${ch}: ${r.htsno}`);
      hts.push([ch, code, Number(r.indent), r.description, r.general, r.special, r.other, JSON.stringify(r.units), `data/${path}; ${edition}`]);
    });
  }

  const rulingFiles = existsSync(join(dataDir, 'rulings'))
    ? readdirSync(join(dataDir, 'rulings')).filter((f) => f.endsWith('.json')).sort()
    : [];
  const rulings = rulingFiles.map((f) => {
    const r = load(dataDir, `rulings/${f}`, CrossRuling);
    if (`${r.rulingNumber}.json` !== f) throw new Error(`data/rulings/${f}: rulingNumber is ${r.rulingNumber}`);
    const url = `${CROSS_BASE}/ruling/${r.rulingNumber}`;
    const codes = parseTariffField(r.tariffs);
    return { number: r.rulingNumber, date: r.rulingDate.slice(0, 10), title: r.subject, codes, text: r.text, url };
  });

  const tmp = `${outPath}.tmp`;
  mkdirSync(dirname(outPath), { recursive: true });
  rmSync(tmp, { force: true });
  const db = new Database(tmp, { create: true, strict: true });
  try {
    db.exec(readFileSync(join(import.meta.dir, 'schema.sql'), 'utf8'));
    db.transaction(() => {
      const ins = db.prepare('INSERT INTO hts_lines (seq, chapter, code, indent, description, general, special, other, units, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      hts.forEach((r, i) => ins.run(i + 1, ...r));
      const insR = db.prepare('INSERT INTO rulings (rowid, number, date, title, hts_codes, text, url, source) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      const insC = db.prepare('INSERT INTO ruling_codes (number, code, heading) VALUES (?, ?, ?)');
      rulings.forEach((r, i) => {
        insR.run(i + 1, r.number, r.date, r.title, r.codes.join(' '), r.text, r.url, r.url);
        for (const c of r.codes) insC.run(r.number, c, headingOf(c));
      });
      db.exec("INSERT INTO hts_fts(hts_fts) VALUES ('rebuild')");
      db.exec("INSERT INTO rulings_fts(rulings_fts) VALUES ('rebuild')");
      const meta = db.prepare('INSERT INTO meta (key, value) VALUES (?, ?)');
      meta.run('edition', edition);
      meta.run('built_at', new Date().toISOString());
      meta.run('hts_lines', String(hts.length));
      meta.run('rulings', String(rulings.length));
    })();
    db.close();
  } catch (e) {
    db.close();
    rmSync(tmp, { force: true });
    throw e;
  }
  renameSync(tmp, outPath);
  return { edition, htsLines: hts.length, rulings: rulings.length };
}
