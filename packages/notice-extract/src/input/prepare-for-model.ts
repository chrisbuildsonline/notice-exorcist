import type { ImageMime, PageImage } from '../providers/types';
import { type ImageInfo, imageInfo } from './image-info';

/**
 * Longest side, in pixels, of an image sent to the model. Bedrock's Claude refuses sides over 8000 and the local
 * Qwen2.5-VL caps its input near 3584², so 4096 keeps a long receipt readable for both without wasting tokens.
 */
export const MODEL_MAX_SIDE = 4096;

/** Draws `bytes` at `size` and returns the same type (PNG stays PNG, JPEG stays JPEG). */
export type Resize = (bytes: Uint8Array, mime: ImageMime, size: ImageInfo) => Promise<Uint8Array>;

/** The size whose longest side is at most `max`, aspect ratio kept (whole pixels, at least 1). */
export function fitWithin({ width, height }: ImageInfo, max: number): ImageInfo {
  const scale = max / Math.max(width, height);
  if (scale >= 1) return { width, height };
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Runs in the page: decode, draw scaled on a canvas, encode as the same type. */
const DRAW = `async ({ b64, mime, width, height }) => {
  const blob = await (await fetch('data:' + mime + ';base64,' + b64)).blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, width, height);
  const out = await canvas.convertToBlob({ type: mime, quality: 0.92 });
  const bytes = new Uint8Array(await out.arrayBuffer());
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}`;

/** The default resizer: a canvas in Playwright's Chromium, as the PDF rasterizer uses. No network; always closed. */
const chromiumResize: Resize = async (bytes, mime, size) => {
  const { chromium } = await import('@playwright/test');
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.route('**/*', (route) => route.abort());
    const args = { b64: Buffer.from(bytes).toString('base64'), mime, ...size };
    const b64 = (await page.evaluate(`(${DRAW})(${JSON.stringify(args)})`)) as string;
    return new Uint8Array(Buffer.from(b64, 'base64'));
  } finally {
    await browser.close();
  }
};

/**
 * The copy of an image the model sees: when its longest side is over MODEL_MAX_SIDE, a new image scaled down with
 * the aspect ratio kept; otherwise the same image. The input bytes (the stored original) are never changed.
 */
export async function prepareForModel(img: PageImage, opts: { resize?: Resize; maxSide?: number } = {}): Promise<PageImage> {
  const size = imageInfo(img.bytes);
  const max = opts.maxSide ?? MODEL_MAX_SIDE;
  if (!size || Math.max(size.width, size.height) <= max) return img;
  const bytes = await (opts.resize ?? chromiumResize)(img.bytes, img.mime, fitWithin(size, max));
  return { mime: img.mime, bytes };
}
