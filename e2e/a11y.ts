import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { type Waiver, waivers as allWaivers } from './a11y-waivers';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
const FAILING = new Set(['serious', 'critical']);

/**
 * Runs axe (WCAG 2.0 to 2.2 A and AA) on the page as it is, with reduced motion on so axe never samples a
 * glow mid-pulse (R2.1). Serious and critical violations throw with rule, selector and help URL; moderate and
 * minor ones are logged and returned (R2.2). A waiver for this screen drops its rule; a waiver that matched
 * nothing throws (R2.3).
 */
export async function scanScreen(page: Page, screen: string, waivers: Waiver[] = allWaivers): Promise<string[]> {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { violations } = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  const mine = waivers.filter((w) => w.screen === screen);
  const unused = mine.filter((w) => !violations.some((v) => v.id === w.rule));
  if (unused.length) throw new Error(`Unused a11y waiver on ${screen}: ${unused.map((w) => w.rule).join(', ')}`);

  const kept = violations.filter((v) => !mine.some((w) => w.rule === v.id));
  const describe = (v: (typeof kept)[number]) =>
    `${v.impact} ${v.id}: ${v.help}\n${v.nodes.map((n) => `    ${n.target.join(' ')}`).join('\n')}\n    ${v.helpUrl}`;
  const serious = kept.filter((v) => FAILING.has(v.impact ?? ''));
  if (serious.length) throw new Error(`Serious a11y violations on ${screen}:\n${serious.map(describe).join('\n')}`);

  const notes = kept.map(describe);
  if (notes.length) console.log(`a11y notes on ${screen}:\n${notes.join('\n')}`);
  return notes;
}
