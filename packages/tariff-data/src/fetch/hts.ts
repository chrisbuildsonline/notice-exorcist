import { join } from 'node:path';
import { HTS_BASE, SCOPE_CHAPTERS, USER_AGENT } from '../config';
import { HtsExport } from '../schemas';
import { type FileEntry, sha256, writeAtomic } from './io';

const exportUrl = (ch: string) => `${HTS_BASE}/exportList?from=${ch}00&to=${ch}99&format=JSON&styles=false`;

async function get(fetchFn: typeof fetch, url: string, what: string) {
  const res = await fetchFn(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${what}: HTTP ${res.status} from ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Download the USITC export for every scope chapter into `<dataDir>/hts/chNN.json`, byte for byte.
 * All chapters are downloaded and validated before any file is replaced.
 */
export async function fetchHts(dataDir: string, fetchFn: typeof fetch = fetch) {
  const release = JSON.parse(new TextDecoder().decode(await get(fetchFn, `${HTS_BASE}/currentRelease`, 'HTS release')));
  const edition: unknown = release?.description;
  if (typeof edition !== 'string' || !edition) throw new Error('HTS release: no edition description');

  const downloads = [];
  for (const ch of SCOPE_CHAPTERS) {
    const url = exportUrl(ch);
    const bytes = await get(fetchFn, url, `chapter ${ch}`);
    const retrievedAt = new Date().toISOString();
    let json: unknown;
    try {
      json = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw new Error(`chapter ${ch}: response is not valid JSON`);
    }
    const parsed = HtsExport.safeParse(json);
    if (!parsed.success) throw new Error(`chapter ${ch}: ${parsed.error.issues[0]?.path.join('.')}: ${parsed.error.issues[0]?.message}`);
    const stray = parsed.data.find((r) => r.htsno && !r.htsno.startsWith(ch));
    if (stray) throw new Error(`chapter ${ch}: row ${stray.htsno} belongs to another chapter`);
    downloads.push({ path: `hts/ch${ch}.json`, bytes, entry: { url, retrievedAt, sha256: sha256(bytes) } });
  }

  const files: Record<string, FileEntry> = {};
  for (const d of downloads) {
    writeAtomic(join(dataDir, d.path), d.bytes);
    files[d.path] = d.entry;
  }
  return { edition, files };
}
