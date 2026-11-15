import { type Browser, chromium } from '@playwright/test';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SPECIMENS } from './data';
import { specimenHtml } from './html';
import { PHOTO_SEED, PHOTO_VIEWPORT, photoHtml, photoParams, renderPhoto } from './photo';
import { renderSpecimen } from './render';

/** Width and height from the first SOF marker of a JPEG. */
export function jpegSize(jpg: Buffer): { width: number; height: number } {
  let i = 2;
  while (i < jpg.length) {
    if (jpg[i] !== 0xff) throw new Error(`bad marker at ${i}`);
    const marker = jpg[i + 1]!;
    const len = jpg.readUInt16BE(i + 2);
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: jpg.readUInt16BE(i + 5), width: jpg.readUInt16BE(i + 7) };
    }
    i += 2 + len;
  }
  throw new Error('no SOF marker');
}

describe('photo parameters', () => {
  const p = photoParams(PHOTO_SEED);

  it('come from the fixed seed: same seed, same parameters', () => {
    expect(PHOTO_SEED).toBe(0x5eed1e57);
    expect(photoParams(PHOTO_SEED)).toEqual(p);
    expect(photoParams(PHOTO_SEED + 1)).not.toEqual(p);
  });

  it('rotate 4 to 12 degrees, tilt a few degrees, blur 0.4 to 0.8px', () => {
    expect(Math.abs(p.rotateDeg)).toBeGreaterThanOrEqual(4);
    expect(Math.abs(p.rotateDeg)).toBeLessThanOrEqual(12);
    expect(Math.abs(p.tiltXDeg)).toBeLessThanOrEqual(6);
    expect(Math.abs(p.tiltYDeg)).toBeLessThanOrEqual(6);
    expect(p.blurPx).toBeGreaterThanOrEqual(0.4);
    expect(p.blurPx).toBeLessThanOrEqual(0.8);
    expect(p.noiseOpacity).toBeGreaterThan(0);
    expect(p.shadowCover).toBeCloseTo(1 / 3, 1);
  });

  it('stays inside the range for many seeds', () => {
    for (let seed = 1; seed < 500; seed++) {
      const q = photoParams(seed);
      expect(Math.abs(q.rotateDeg)).toBeGreaterThanOrEqual(4);
      expect(Math.abs(q.rotateDeg)).toBeLessThanOrEqual(12);
    }
  });

  it('builds a self-contained page with the shadow, noise, blur and transform', () => {
    const html = photoHtml('AAAA', p);
    expect(html).toBe(photoHtml('AAAA', p));
    expect(html).toContain('src="data:image/png;base64,AAAA"');
    expect(html).toContain('feTurbulence');
    expect(html).toContain(`blur(${p.blurPx}px)`);
    expect(html).toContain(`rotateZ(${p.rotateDeg}deg)`);
    expect(html).toMatch(/class="shade"/);
    expect(html).not.toMatch(/https?:|<script/i);
  });
});

describe('phone photo of specimen 2', () => {
  let browser: Browser;
  let jpg: Buffer;
  beforeAll(async () => {
    browser = await chromium.launch();
    const { png } = await renderSpecimen(browser, specimenHtml(SPECIMENS.find((s) => s.specimenId === 'specimen-2-form29')!));
    jpg = await renderPhoto(browser, png);
  }, 60_000);
  afterAll(async () => {
    await browser?.close();
  });

  it('is a JPEG of 1200 x 1600', () => {
    expect([jpg[0], jpg[1]]).toEqual([0xff, 0xd8]);
    expect(jpegSize(jpg)).toEqual({ width: 1200, height: 1600 });
    expect(PHOTO_VIEWPORT).toEqual({ width: 1200, height: 1600 });
  });

  it('has an aspect ratio that is not Letter, A4 or square', () => {
    const { width, height } = jpegSize(jpg);
    const r = width / height;
    for (const paper of [8.5 / 11, 210 / 297, 1]) expect(Math.abs(r - paper)).toBeGreaterThan(0.02);
  });
});
