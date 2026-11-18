import { expect, test } from '@playwright/test';
import { scanScreen } from './a11y';

// scanScreen itself, on inline pages with known results, so a broken harness cannot pass every screen.
const page = (body: string) => `<!doctype html><html lang="en"><head><title>Fixture</title></head><body><main><h1>Fixture</h1>${body}</main></body></html>`;

test('a serious violation fails with the rule id and selector', async ({ page: p }) => {
  await p.setContent(page('<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" id="no-alt"><button id="no-name"></button>'));
  const scan = scanScreen(p, 'fixture', []);
  await expect(scan).rejects.toThrow(/image-alt[\s\S]*#no-alt/);
  await expect(scanScreen(p, 'fixture', [])).rejects.toThrow(/button-name[\s\S]*#no-name/);
});

test('a minor-only page passes with a logged note', async ({ page: p }) => {
  // aria-deprecated-role is a WCAG 2 A rule with impact minor (directory was deprecated in ARIA 1.2)
  await p.setContent(page('<div role="directory" id="old-role">Contents</div>'));
  const notes = await scanScreen(p, 'fixture', []);
  expect(notes).toHaveLength(1);
  expect(notes[0]).toMatch(/^minor aria-deprecated-role[\s\S]*#old-role/);
});

test('a waiver drops its rule on its screen only', async ({ page: p }) => {
  await p.setContent(page('<button id="no-name"></button>'));
  const waiver = { rule: 'button-name', screen: 'fixture', reason: 'test' };
  await expect(scanScreen(p, 'fixture', [waiver])).resolves.toEqual([]);
  await expect(scanScreen(p, 'other', [waiver])).rejects.toThrow(/button-name/);
});

test('an unused waiver fails', async ({ page: p }) => {
  await p.setContent(page('<p>Clean</p>'));
  await expect(scanScreen(p, 'fixture', [{ rule: 'image-alt', screen: 'fixture', reason: 'test' }])).rejects.toThrow(/Unused a11y waiver on fixture: image-alt/);
});
