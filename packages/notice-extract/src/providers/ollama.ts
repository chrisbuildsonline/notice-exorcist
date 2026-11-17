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
        // Streamed so headers and chunks arrive while the model works; fetch idle limits never see a silent socket.
        stream: true,
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
      let text: string;
      try {
        text = await res.text();
      } catch (e) {
        const name = (e as { name?: string })?.name;
        if (name === 'TimeoutError' || name === 'AbortError') throw new ProviderError('timeout', `${url} reply did not finish within ${timeoutMs} ms`);
        return '';
      }
      return (res.headers.get('content-type') ?? '').includes('text/event-stream') ? joinStream(text) : messageContent(text);
    },
  };
}

type Choice = { message?: { content?: unknown }; delta?: { content?: unknown } };

const parse = (s: string): { choices?: Choice[] } | undefined => {
  try {
    return JSON.parse(s) as { choices?: Choice[] };
  } catch {
    return undefined;
  }
};

/** Content of a whole (non-streamed) chat completion, or '' when there is none. */
function messageContent(text: string): string {
  const content = parse(text)?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content : '';
}

/** Joins the delta content of every `data:` event of a streamed chat completion. */
function joinStream(text: string): string {
  let out = '';
  for (const line of text.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trim();
    if (data === '[DONE]') break;
    const content = parse(data)?.choices?.[0]?.delta?.content;
    if (typeof content === 'string') out += content;
  }
  return out;
}
