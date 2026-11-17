import { createHash } from 'node:crypto';
import type { z } from 'zod';
import { DEFAULT_THRESHOLD, fieldsNeedingConfirmation, markNeedsConfirmation } from './confidence';
import { type Config, readConfig } from './config';
import { sniff } from './input/sniff';
import { buildPrompt, type PromptIssue, retryNote } from './prompt';
import { bedrockProvider, type LoadBedrock } from './providers/bedrock';
import { ollamaProvider } from './providers/ollama';
import { type PageImage, type Provider, ProviderError, type ProviderName } from './providers/types';
import { type Box, provSource } from './schema/field';
import { ModelNotice, Notice } from './schema/notice';
import type { NoticeKind } from './schema/common';

export type FailureReason =
  | 'not_json'
  | 'schema_invalid'
  | 'model_unreachable'
  | 'no_fixture'
  | 'unrecognized_document'
  | 'timeout'
  | 'unsupported_input'
  | 'too_many_pages';

export type ExtractMeta = { kind: NoticeKind; hash: string; provider: ProviderName; model: string };

export type ExtractOk = {
  ok: true;
  notice: Notice;
  /** Paths the user must confirm or correct before any value is used in a calculation. */
  needsConfirmation: string[];
  meta: ExtractMeta;
};

export type ExtractFailure = {
  ok: false;
  reason: FailureReason;
  /** Zod issues of the last reply, for schema_invalid. */
  issues?: z.core.$ZodIssue[];
  /** The last raw model reply, in memory only, for the caller to retry. Never logged. */
  raw?: string;
  /** A URL, error code or HTTP status. Never notice content. */
  detail?: string;
  hash: string;
};

export type ExtractResult = ExtractOk | ExtractFailure;

export type ExtractDeps = {
  config?: Config;
  /** Overrides the provider chosen from config (tests). */
  provider?: Provider;
  threshold?: number;
  /** Loader of the AWS SDK, used only when EXTRACT_PROVIDER=bedrock (tests pass a mock). */
  loadBedrock?: LoadBedrock;
};

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');

type Validated = { ok: true; notice: Notice } | { ok: false; reason: 'not_json' | 'schema_invalid' | 'unrecognized_document'; issues?: z.core.$ZodIssue[] };

/** Adds `prov` to every leaf the model wrote ({ value, confidence, page, box? }). Values are kept as they are. */
function addProv(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(addProv);
  if (v !== null && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    if ('value' in o && 'confidence' in o && 'page' in o) {
      return { ...o, prov: { kind: 'stated', source: provSource(o.page as number, o.box as Box | undefined) } };
    }
    return Object.fromEntries(Object.entries(o).map(([k, x]) => [k, addProv(x)]));
  }
  return v;
}

/** JSON.parse, then the model-shape schema, then provenance. No repair, coercion or default anywhere. */
export function validateResponse(raw: string): Validated {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, reason: 'not_json' };
  }
  if (json !== null && typeof json === 'object' && (json as { kind?: unknown }).kind === 'unknown') {
    return { ok: false, reason: 'unrecognized_document' };
  }
  const model = ModelNotice.safeParse(json);
  if (!model.success) return { ok: false, reason: 'schema_invalid', issues: model.error.issues };
  const notice = Notice.safeParse(addProv(json));
  if (!notice.success) return { ok: false, reason: 'schema_invalid', issues: notice.error.issues };
  return { ok: true, notice: notice.data };
}

/** Local unless EXTRACT_PROVIDER=bedrock. An unreachable local model is a failure, never a switch to the cloud. */
function defaultProvider(config: Config, deps: ExtractDeps): Provider {
  if (config.provider === 'bedrock') {
    return bedrockProvider({ model: config.model, timeoutMs: config.timeoutMs, ...(deps.loadBedrock ? { loadClient: deps.loadBedrock } : {}) });
  }
  return ollamaProvider(config);
}

async function pageImages(bytes: Uint8Array): Promise<PageImage[] | { reason: FailureReason }> {
  const type = sniff(bytes);
  if (type === 'png') return [{ mime: 'image/png', bytes }];
  if (type === 'jpeg') return [{ mime: 'image/jpeg', bytes }];
  return { reason: 'unsupported_input' };
}

const NOT_JSON_ISSUE: PromptIssue = { path: [], message: 'the reply was not a JSON object' };

/** Reads one notice (PNG, JPEG or PDF bytes) and returns schema-validated stated fields, or a typed failure. */
export async function extractNotice(input: { bytes: Uint8Array }, deps: ExtractDeps = {}): Promise<ExtractResult> {
  const hash = sha256(input.bytes);
  const fail = (reason: FailureReason, extra: Partial<ExtractFailure> = {}): ExtractFailure => ({ ok: false, reason, hash, ...extra });
  try {
    const config = deps.config ?? readConfig();
    const images = await pageImages(input.bytes);
    if (!Array.isArray(images)) return fail(images.reason);

    const provider = deps.provider ?? defaultProvider(config, deps);
    const prompt = buildPrompt();
    let raw = await provider.complete({ ...prompt, images });
    let v = validateResponse(raw);
    if (!v.ok && v.reason !== 'unrecognized_document') {
      const note = retryNote(v.reason === 'not_json' ? [NOT_JSON_ISSUE] : (v.issues ?? []));
      raw = await provider.complete({ system: prompt.system, user: prompt.user + note, images });
      v = validateResponse(raw);
    }
    if (!v.ok) return fail(v.reason, { raw, ...(v.issues ? { issues: v.issues } : {}) });

    const notice = markNeedsConfirmation(v.notice, deps.threshold ?? DEFAULT_THRESHOLD);
    return {
      ok: true,
      notice,
      needsConfirmation: fieldsNeedingConfirmation(notice),
      meta: { kind: notice.kind, hash, provider: provider.name, model: provider.model },
    };
  } catch (e) {
    if (e instanceof ProviderError) return fail(e.code, { detail: e.detail });
    throw e;
  }
}
