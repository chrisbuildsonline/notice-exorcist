/**
 * Writes the specimen notices to fixtures/specimens/ (or `--out <dir>`): per specimen a PDF, a PNG of
 * page 1 and the ground-truth fields JSON, plus a seeded phone-photo JPG of specimen 2. Run with `bun run specimens:generate` from the repo root.
 *
 * The fields JSON and the HTML are deterministic: no clock, locale or random input. PDF, PNG and JPG
 * bytes are NOT guaranteed identical across runs or Chromium versions (Chromium embeds dates and its
 * version); the fields JSON is the stable contract.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { IndexNotBuiltError, openIndex } from '@notice-exorcist/tariff-data';
import { SPECIMENS } from './data';
import { specimenHtml } from './html';
import { renderPhoto } from './photo';
import { chromiumMissing, renderSpecimen, withBrowser } from './render';
import { Fields } from './schema';
import { serialize } from './serialize';

export const PHOTO_OF = 'specimen-2-form29';
export const DEFAULT_OUT = resolve(import.meta.dir, '../../fixtures/specimens');

/** Null when every prerequisite is in place, else the step that is missing. */
export function preflight(): string | null {
  try {
    openIndex().close();
  } catch (e) {
    if (e instanceof IndexNotBuiltError) return 'Tariff index is not built: run `bun run --cwd packages/tariff-data data:build`';
    throw e;
  }
  return chromiumMissing();
}

/** Render every specimen into `outDir`. Returns the file names written. */
export async function generate(outDir: string): Promise<string[]> {
  const specimens = SPECIMENS.map((s) => Fields.parse(s));
  const files = new Map<string, string | Buffer>();
  await withBrowser(async (browser) => {
    for (const s of specimens) {
      const { pdf, png } = await renderSpecimen(browser, specimenHtml(s));
      files.set(`${s.specimenId}.pdf`, pdf);
      files.set(`${s.specimenId}.png`, png);
      files.set(`${s.specimenId}.fields.json`, serialize(s));
      // The photo shares specimen 2's fields JSON; it gets no fields file of its own.
      if (s.specimenId === PHOTO_OF) files.set(`${s.specimenId}.photo.jpg`, await renderPhoto(browser, png));
    }
  });
  mkdirSync(outDir, { recursive: true });
  for (const [name, data] of files) writeFileSync(join(outDir, name), data);
  return [...files.keys()];
}

if (import.meta.main) {
  const i = process.argv.indexOf('--out');
  const outDir = i > 0 && process.argv[i + 1] ? resolve(process.argv[i + 1]!) : DEFAULT_OUT;
  const missing = preflight();
  if (missing) {
    console.error(`specimens:generate: ${missing}`);
    process.exit(1);
  }
  const written = await generate(outDir);
  console.log(`wrote ${written.length} files to ${outDir}`);
}
