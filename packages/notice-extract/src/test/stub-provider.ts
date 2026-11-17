import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Provider, ProviderName, ProviderRequest } from '../providers/types';
import { loadTruth, SPECIMEN_DIR, wrapTruthAsModel } from './wrap';

/** Test helper: a provider that replies with the given texts in turn (the last one repeats) and keeps every request. */
export function stubProvider(replies: string[], name: ProviderName = 'ollama'): Provider & { calls: ProviderRequest[] } {
  const calls: ProviderRequest[] = [];
  return {
    name,
    model: 'stub-model',
    calls,
    async complete(req) {
      calls.push(req);
      return replies[Math.min(calls.length - 1, replies.length - 1)] ?? '';
    },
  };
}

export const specimenBytes = (name: string) => new Uint8Array(readFileSync(join(SPECIMEN_DIR, name)));

/** The Form 29 truth as the model would write it. */
export const form29ModelReply = (confidence = 0.95) => wrapTruthAsModel(loadTruth('specimen-2-form29'), confidence) as Record<string, any>;
