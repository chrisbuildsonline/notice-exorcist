import { z } from 'zod';

const intString = (min: number) =>
  z
    .string()
    .regex(/^\d+$/, 'must be a whole number')
    .transform(Number)
    .pipe(z.number().int().min(min));

const Env = z.object({
  EXTRACT_PROVIDER: z.enum(['local', 'bedrock']).default('local'),
  EXTRACT_MODE: z.enum(['live', 'fixture', 'record']).default('live'),
  EXTRACT_BASE_URL: z.url().default('http://localhost:11434/v1'),
  EXTRACT_MODEL: z.string().min(1).default('qwen2.5vl:7b'),
  EXTRACT_TIMEOUT_MS: intString(1).default(120000),
  EXTRACT_MAX_PAGES: intString(0).default(5),
  /** `require`: a live test fails instead of skipping when Ollama or Chromium is down. */
  EXTRACT_LIVE: z.enum(['auto', 'require']).default('auto'),
});

export type Config = {
  provider: 'local' | 'bedrock';
  mode: 'live' | 'fixture' | 'record';
  baseUrl: string;
  model: string;
  timeoutMs: number;
  maxPages: number;
  live: 'auto' | 'require';
};

/** Reads the EXTRACT_* env vars. Empty strings count as unset. Throws naming the bad variable. */
export function readConfig(env: Record<string, string | undefined> = process.env): Config {
  const set = Object.fromEntries(Object.entries(env).filter(([k, v]) => k.startsWith('EXTRACT_') && v !== undefined && v !== ''));
  const r = Env.safeParse(set);
  if (!r.success) {
    const bad = r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`invalid extract config: ${bad}`);
  }
  const e = r.data;
  return {
    provider: e.EXTRACT_PROVIDER,
    mode: e.EXTRACT_MODE,
    baseUrl: e.EXTRACT_BASE_URL,
    model: e.EXTRACT_MODEL,
    timeoutMs: e.EXTRACT_TIMEOUT_MS,
    maxPages: e.EXTRACT_MAX_PAGES,
    live: e.EXTRACT_LIVE,
  };
}
