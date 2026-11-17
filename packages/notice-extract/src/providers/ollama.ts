import { dataUrl, fetchOrFail, type Provider, ProviderError } from './types';

export type OllamaOpts = { baseUrl: string; model: string; timeoutMs: number };

/** Ollama through its OpenAI-compatible chat completions endpoint, with plain fetch. */
export function ollamaProvider({ baseUrl, model, timeoutMs }: OllamaOpts): Provider {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  return {
    name: 'ollama',
    model,
    async complete({ system, user, images }) {
      const body = {
        model,
        stream: false,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: [{ type: 'text', text: user }, ...images.map((img) => ({ type: 'image_url', image_url: { url: dataUrl(img) } }))],
          },
        ],
      };
      const res = await fetchOrFail(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }, timeoutMs);
      let json: { choices?: { message?: { content?: unknown } }[] };
      try {
        json = (await res.json()) as typeof json;
      } catch (e) {
        if ((e as { name?: string })?.name === 'TimeoutError') throw new ProviderError('timeout', `${url} reply did not finish within ${timeoutMs} ms`);
        return '';
      }
      const content = json.choices?.[0]?.message?.content;
      return typeof content === 'string' ? content : '';
    },
  };
}
