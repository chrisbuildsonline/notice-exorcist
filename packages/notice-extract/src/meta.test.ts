import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readConfig } from './config';
import { extractNotice } from './extract';
import type { BedrockModule } from './providers/bedrock';
import { form29ModelReply, specimenBytes, stubProvider } from './test/stub-provider';

const png = specimenBytes('specimen-2-form29.png');
const reply = JSON.stringify(form29ModelReply());
const sha = (b: Uint8Array | string) => createHash('sha256').update(b).digest('hex');

describe('meta.provider, so the UI can show the cloud notice when Bedrock is on', () => {
  it('ollama for the local provider', async () => {
    const r = await extractNotice({ bytes: png }, { config: readConfig({}), provider: stubProvider([reply]) });
    expect(r.ok && r.meta.provider).toBe('ollama');
  });

  it('fixture in fixture mode', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'meta-'));
    const f = { inputSha256: sha(png), responseSha256: sha(reply), raw: reply, provider: 'ollama', model: 'qwen2.5vl:7b', recordedAt: '2026-11-17T00:00:00.000Z', recordedFrom: 'live' };
    writeFileSync(join(dir, `${sha(png)}.json`), JSON.stringify(f));
    const r = await extractNotice({ bytes: png }, { config: readConfig({ EXTRACT_MODE: 'fixture' }), fixturesDir: dir });
    expect(r.ok && r.meta.provider).toBe('fixture');
  });

  it('bedrock when EXTRACT_PROVIDER=bedrock', async () => {
    const mod: BedrockModule = {
      BedrockRuntimeClient: class {
        async send() {
          return { output: { message: { content: [{ text: reply }] } } };
        }
      },
      ConverseCommand: class {},
    };
    const r = await extractNotice({ bytes: png }, { config: readConfig({ EXTRACT_PROVIDER: 'bedrock', EXTRACT_MODEL: 'example.model' }), loadBedrock: async () => mod });
    expect(r.ok && r.meta.provider).toBe('bedrock');
  });
});
