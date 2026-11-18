/**
 * The only axe rule exclusions allowed (R2.3). Each names the rule, the screen and why. scanScreen fails on a
 * waiver that no longer matches a violation, so this list cannot go stale.
 */
export type Waiver = { rule: string; screen: string; reason: string };

export const waivers: Waiver[] = [];
