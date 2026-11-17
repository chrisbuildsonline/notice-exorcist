import { describe, expect, it, vi } from 'vitest';
import { readConfig } from '../config';
import { extractNotice } from '../extract';
import { buildPrompt } from '../prompt';
import { form29ModelReply, specimenBytes, stubProvider } from '../test/stub-provider';
import { type BedrockModule, bedrockProvider } from './bedrock';

const SECRET = 'example-secret-key-not-real-0123456789';
const KEY_ID = 'test-key-id-0000';

/** A mock of the two classes the provider uses from @aws-sdk/client-bedrock-runtime. */
function mockModule(reply: () => Promise<unknown>) {
  const sent: unknown[] = [];
  const configs: unknown[] = [];
  const mod: BedrockModule = {
    BedrockRuntimeClient: class {
      constructor(cfg: object) {
        configs.push(cfg);
      }
      async send(cmd: { input: unknown }) {
        sent.push(cmd.input);
        return reply();
      }
    },
    ConverseCommand: class {
      constructor(readonly input: object) {}
    },
  };
  return { mod, sent, configs };
}

const png = specimenBytes('specimen-2-form29.png');
const bedrockEnv = { EXTRACT_PROVIDER: 'bedrock', EXTRACT_MODEL: 'example.bedrock-model-id' };
const textReply = (text: string) => async () => ({ output: { message: { role: 'assistant', content: [{ text }] } } });

describe('bedrock provider (mocked, no AWS)', () => {
  it('sends the same prompt as the local path, with the page image, and goes through the same validation', async () => {
    const { mod, sent } = mockModule(textReply(JSON.stringify(form29ModelReply())));
    const loadBedrock = vi.fn(async () => mod);
    const r = await extractNotice({ bytes: png }, { config: readConfig(bedrockEnv), loadBedrock });
    expect(loadBedrock).toHaveBeenCalledOnce();
    expect(r).toMatchObject({ ok: true, meta: { provider: 'bedrock', model: 'example.bedrock-model-id', kind: 'cbp_form_29' } });

    const input = sent[0] as any;
    const { system, user } = buildPrompt();
    expect(input.modelId).toBe('example.bedrock-model-id');
    expect(input.system).toEqual([{ text: system }]);
    expect(input.messages[0].content[0]).toEqual({ text: user });
    expect(input.messages[0].content[1].image.format).toBe('png');
    expect(Buffer.from(input.messages[0].content[1].image.source.bytes).equals(Buffer.from(png))).toBe(true);
  });

  it('the same validation applies: invalid output is schema_invalid after one retry', async () => {
    const bad = form29ModelReply();
    bad.lines[0].value.value = 4815;
    const { mod, sent } = mockModule(textReply(JSON.stringify(bad)));
    const r = await extractNotice({ bytes: png }, { config: readConfig(bedrockEnv), loadBedrock: async () => mod });
    expect(r).toMatchObject({ ok: false, reason: 'schema_invalid' });
    expect(sent).toHaveLength(2);
  });

  it('with the provider unset, the loader is never called', async () => {
    const loadBedrock = vi.fn(async () => mockModule(textReply('{}')).mod);
    const provider = stubProvider([JSON.stringify(form29ModelReply())]);
    await extractNotice({ bytes: png }, { config: readConfig({}), provider, loadBedrock });
    expect(loadBedrock).not.toHaveBeenCalled();
  });

  it('credentials never appear in errors: a client error becomes model_unreachable with the error name only', async () => {
    const { mod } = mockModule(async () => {
      const e = new Error(`The security token ${KEY_ID} with secret ${SECRET} is invalid`);
      e.name = 'UnrecognizedClientException';
      throw e;
    });
    const r = await extractNotice({ bytes: png }, { config: readConfig(bedrockEnv), loadBedrock: async () => mod });
    expect(r).toMatchObject({ ok: false, reason: 'model_unreachable' });
    const text = JSON.stringify(r);
    expect(text).toContain('UnrecognizedClientException');
    expect(text).not.toContain(SECRET);
    expect(text).not.toContain(KEY_ID);
  });

  it('a missing AWS SDK gives model_unreachable with an install hint, not a crash', async () => {
    const p = bedrockProvider({
      model: 'm',
      timeoutMs: 1000,
      loadClient: async () => {
        throw new Error("Cannot find package '@aws-sdk/client-bedrock-runtime'");
      },
    });
    const err = await p.complete({ system: 's', user: 'u', images: [] }).catch((e) => e);
    expect(err.code).toBe('model_unreachable');
    expect(err.detail).toMatch(/@aws-sdk\/client-bedrock-runtime/);
  });

  it('credentials come from the standard AWS env vars: the provider passes none to the client', async () => {
    const { mod, configs } = mockModule(textReply(JSON.stringify(form29ModelReply())));
    await extractNotice({ bytes: png }, { config: readConfig(bedrockEnv), loadBedrock: async () => mod });
    expect(JSON.stringify(configs)).not.toMatch(/credential|secret|accessKey/i);
  });

  it('Bedrock needs an explicit model id', () => {
    expect(() => readConfig({ EXTRACT_PROVIDER: 'bedrock' })).toThrow('EXTRACT_MODEL');
  });
});
