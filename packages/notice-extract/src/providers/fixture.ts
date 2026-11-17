import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

/**
 * packages/notice-extract/fixtures: recorded live replies, one file per input, named by the input's sha256.
 * Built with join, not `new URL('../../fixtures', import.meta.url)`, which bundlers treat as an asset to resolve.
 */
export const DEFAULT_FIXTURES_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'fixtures');

const Sha = z.string().regex(/^[0-9a-f]{64}$/);

export const Fixture = z
  .object({
    inputSha256: Sha,
    responseSha256: Sha,
    raw: z.string(),
    provider: z.enum(['ollama', 'bedrock']),
    model: z.string().min(1),
    recordedAt: z.iso.datetime(),
    recordedFrom: z.literal('live'),
  })
  .strict();
export type Fixture = z.infer<typeof Fixture>;

export const sha256 = (data: Uint8Array | string) => createHash('sha256').update(data).digest('hex');

/** The fixture for an input hash, or null when there is none or it does not check out (bad shape, hash mismatch). */
export async function readFixture(dir: string, inputSha256: string): Promise<Fixture | null> {
  let text: string;
  try {
    text = await readFile(join(dir, `${inputSha256}.json`), 'utf8');
  } catch {
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  const f = Fixture.safeParse(parsed);
  if (!f.success || f.data.inputSha256 !== inputSha256 || f.data.responseSha256 !== sha256(f.data.raw)) return null;
  return f.data;
}

/** Writes a live reply as a fixture. Only record mode calls this. */
export async function recordFixture(
  dir: string,
  r: { inputSha256: string; raw: string; provider: 'ollama' | 'bedrock'; model: string; recordedAt: Date },
): Promise<void> {
  const fixture: Fixture = {
    inputSha256: r.inputSha256,
    responseSha256: sha256(r.raw),
    raw: r.raw,
    provider: r.provider,
    model: r.model,
    recordedAt: r.recordedAt.toISOString(),
    recordedFrom: 'live',
  };
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, `${r.inputSha256}.json`), `${JSON.stringify(fixture, null, 2)}\n`);
}
