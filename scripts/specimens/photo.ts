import type { Browser } from '@playwright/test';
import { renderJpg, SCALE, VIEWPORT } from './render';

/** Every photo parameter comes from this seed. Change it and the photo changes; nothing else does. */
export const PHOTO_SEED = 0x5eed1e57;
export const PHOTO_VIEWPORT = { width: 1200, height: 1600 } as const;
export const PHOTO_QUALITY = 82;

const BACKGROUNDS = ['#8b8178', '#7d756c', '#948a80', '#6f6a64'] as const;
const PAPER_RATIO = (VIEWPORT.height * SCALE) / (VIEWPORT.width * SCALE);
const MARGIN = 60;

/** mulberry32: a tiny seeded PRNG returning floats in [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type PhotoParams = {
  rotateDeg: number;
  tiltXDeg: number;
  tiltYDeg: number;
  perspectivePx: number;
  shadowAngleDeg: number;
  shadowCover: number;
  background: string;
  blurPx: number;
  noiseOpacity: number;
  paper: { left: number; top: number; width: number; height: number };
};

const round2 = (x: number) => Math.round(x * 100) / 100;

/** Photo transform parameters from a seed. Layout numbers only; no figure on the notice is touched. */
export function photoParams(seed: number): PhotoParams {
  const r = mulberry32(seed);
  const between = (lo: number, hi: number) => lo + (hi - lo) * r();
  const sign = () => (r() < 0.5 ? -1 : 1);
  const rotateDeg = round2(sign() * between(4, 12));
  const tiltXDeg = round2(sign() * between(1.5, 4));
  const tiltYDeg = round2(sign() * between(1.5, 4));
  // Largest paper whose rotated box still leaves background on every side, then an off-centre placement.
  const rad = (Math.abs(rotateDeg) * Math.PI) / 180;
  const [c, s] = [Math.cos(rad), Math.sin(rad)];
  const width = Math.floor(
    Math.min((PHOTO_VIEWPORT.width - 2 * MARGIN) / (c + PAPER_RATIO * s), (PHOTO_VIEWPORT.height - 2 * MARGIN) / (PAPER_RATIO * c + s)),
  );
  const height = Math.round(width * PAPER_RATIO);
  const boxW = width * c + height * s;
  const boxH = height * c + width * s;
  const left = Math.round((PHOTO_VIEWPORT.width - width) / 2 + between(-0.4, 0.4) * (PHOTO_VIEWPORT.width - 2 * MARGIN - boxW));
  const top = Math.round((PHOTO_VIEWPORT.height - height) / 2 + between(-0.4, 0.4) * (PHOTO_VIEWPORT.height - 2 * MARGIN - boxH));
  return {
    rotateDeg,
    tiltXDeg,
    tiltYDeg,
    perspectivePx: Math.round(between(1600, 2400)),
    shadowAngleDeg: Math.round(between(0, 360)),
    shadowCover: 0.33,
    background: BACKGROUNDS[Math.floor(r() * BACKGROUNDS.length)]!,
    blurPx: round2(between(0.4, 0.8)),
    noiseOpacity: round2(between(0.06, 0.1)),
    paper: { left, top, width, height },
  };
}

/** A self-contained page: the specimen PNG as paper on a table, tilted, shaded, blurred and grainy. */
export function photoHtml(pngBase64: string, p: PhotoParams): string {
  const { width: W, height: H } = PHOTO_VIEWPORT;
  const cover = Math.round(p.shadowCover * 100);
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
html, body { margin: 0; width: ${W}px; height: ${H}px; overflow: hidden; background: ${p.background}; }
.scene { position: absolute; inset: 0; perspective: ${p.perspectivePx}px; }
.paper {
  position: absolute; left: ${p.paper.left}px; top: ${p.paper.top}px; width: ${p.paper.width}px; height: ${p.paper.height}px;
  transform: rotateX(${p.tiltXDeg}deg) rotateY(${p.tiltYDeg}deg) rotateZ(${p.rotateDeg}deg);
  box-shadow: 0 22px 48px rgba(20,22,28,.45), 0 3px 8px rgba(20,22,28,.35); overflow: hidden; background: #fff;
}
.paper img { display: block; width: 100%; height: 100%; filter: blur(${p.blurPx}px); }
.shade { position: absolute; inset: 0; background: linear-gradient(${p.shadowAngleDeg}deg, rgba(20,22,28,.35) 0%, rgba(20,22,28,0) ${cover}%); }
.noise { position: absolute; inset: 0; opacity: ${p.noiseOpacity}; mix-blend-mode: multiply; }
</style></head><body>
<div class="scene"><div class="paper"><img src="data:image/png;base64,${pngBase64}" alt=""><div class="shade"></div></div></div>
<svg class="noise" width="${W}" height="${H}"><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="${PHOTO_SEED % 1000}" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#grain)"/></svg>
</body></html>
`;
}

/** Specimen PNG -> phone-photo JPG with the fixed seed. */
export const renderPhoto = (browser: Browser, png: Buffer): Promise<Buffer> =>
  renderJpg(browser, photoHtml(png.toString('base64'), photoParams(PHOTO_SEED)), PHOTO_VIEWPORT, PHOTO_QUALITY);
