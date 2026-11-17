export type ImageMime = 'image/png' | 'image/jpeg';
export type PageImage = { mime: ImageMime; bytes: Uint8Array };

export type ProviderRequest = { system: string; user: string; images: PageImage[] };

export type ProviderName = 'ollama' | 'bedrock' | 'fixture';

/** A model that reads page images and returns the raw response text. */
export interface Provider {
  name: ProviderName;
  model: string;
  complete(req: ProviderRequest): Promise<string>;
}

export type ProviderErrorCode = 'model_unreachable' | 'timeout';

/** A failure to get a reply. `detail` is a URL, an error code or an HTTP status, never notice content. */
export class ProviderError extends Error {
  constructor(
    readonly code: ProviderErrorCode,
    readonly detail: string,
  ) {
    super(`${code}: ${detail}`);
    this.name = 'ProviderError';
  }
}

export const dataUrl = (img: PageImage) => `data:${img.mime};base64,${Buffer.from(img.bytes).toString('base64')}`;

/** The network error code of a failed fetch (Node puts it on `cause`), with Bun's name mapped to the usual one. */
export function netErrorCode(e: unknown): string {
  const err = e as { code?: unknown; cause?: { code?: unknown }; name?: string; message?: string };
  const code = err?.cause?.code ?? err?.code;
  if (typeof code === 'string') return code === 'ConnectionRefused' ? 'ECONNREFUSED' : code;
  return err?.name === 'TimeoutError' ? 'ETIMEDOUT' : (err?.message ?? String(e));
}

const isTimeout = (e: unknown) => {
  const name = (e as { name?: string })?.name;
  return name === 'TimeoutError' || name === 'AbortError';
};

/** fetch with a timeout, turning network failures into ProviderError. */
export async function fetchOrFail(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e) {
    if (isTimeout(e)) throw new ProviderError('timeout', `${url} gave no reply within ${timeoutMs} ms`);
    throw new ProviderError('model_unreachable', `${init.method ?? 'GET'} ${url} failed: ${netErrorCode(e)}`);
  }
  if (!res.ok) throw new ProviderError('model_unreachable', `${init.method ?? 'GET'} ${url} returned HTTP ${res.status}`);
  return res;
}
