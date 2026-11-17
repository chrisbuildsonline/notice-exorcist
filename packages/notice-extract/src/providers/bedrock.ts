import { type Provider, ProviderError } from './types';

/** The two classes used from @aws-sdk/client-bedrock-runtime. Typed here so the SDK is not needed to typecheck. */
export type BedrockModule = {
  BedrockRuntimeClient: new (cfg: object) => { send(cmd: never, opts?: object): Promise<unknown> };
  ConverseCommand: new (input: object) => unknown;
};

export type LoadBedrock = () => Promise<BedrockModule>;

const SDK = '@aws-sdk/client-bedrock-runtime';

/** Loaded only when EXTRACT_PROVIDER=bedrock. The module name is a variable so bundlers and tsc do not resolve it. */
export const loadBedrockSdk: LoadBedrock = () => import(/* @vite-ignore */ /* webpackIgnore: true */ SDK) as Promise<BedrockModule>;

export type BedrockOpts = { model: string; timeoutMs: number; loadClient?: LoadBedrock };

/**
 * Claude through Amazon Bedrock's Converse API, with the same prompt as the local path.
 * Credentials and region come from the standard AWS env vars via the SDK; this code never reads, stores or logs them.
 * Errors keep only the SDK error name, so no message text (which could quote a key) leaves this function.
 */
export function bedrockProvider({ model, timeoutMs, loadClient = loadBedrockSdk }: BedrockOpts): Provider {
  return {
    name: 'bedrock',
    model,
    async complete({ system, user, images }) {
      let sdk: BedrockModule;
      try {
        sdk = await loadClient();
      } catch {
        throw new ProviderError('model_unreachable', `bedrock client not installed: add ${SDK}`);
      }
      const client = new sdk.BedrockRuntimeClient({});
      const command = new sdk.ConverseCommand({
        modelId: model,
        system: [{ text: system }],
        messages: [
          {
            role: 'user',
            content: [{ text: user }, ...images.map((img) => ({ image: { format: img.mime === 'image/png' ? 'png' : 'jpeg', source: { bytes: img.bytes } } }))],
          },
        ],
        inferenceConfig: { temperature: 0 },
      });
      let out: unknown;
      try {
        out = await client.send(command as never, { abortSignal: AbortSignal.timeout(timeoutMs) });
      } catch (e) {
        const name = (e as { name?: unknown })?.name;
        if (name === 'TimeoutError' || name === 'AbortError') throw new ProviderError('timeout', `bedrock gave no reply within ${timeoutMs} ms`);
        throw new ProviderError('model_unreachable', `bedrock request failed: ${typeof name === 'string' ? name : 'error'}`);
      }
      const content = (out as { output?: { message?: { content?: { text?: unknown }[] } } })?.output?.message?.content ?? [];
      return content.map((c) => (typeof c.text === 'string' ? c.text : '')).join('');
    },
  };
}
