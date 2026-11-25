# Tasks: haunting-ux

Run `bun run test` and `bun run typecheck` after each task. Run `bun run e2e` for tasks tagged `[e2e]` or `[a11y]`. Every task is test first: write the test, see it fail for the stated reason, then make the change that turns it green.

Test tags: `[unit]` Vitest on pure logic · `[component]` Vitest and Testing Library · `[css]` Vitest reading CSS or sources · `[e2e]` Playwright · `[a11y]` Playwright with axe-core.

The order follows the request: tests first (slice 1), then the implementation in `apps/web` (slice 2), then the README screenshots (slice 3). Slice 1 ends with new tests that fail for the right reason, so it is not a green stopping point. Each task in slice 2 turns the named tests green, and slice 2 ends with `bun run test`, `typecheck` and `e2e` all green. Where a test needs a hook that does not exist yet, slice 1 writes it against the planned name in `design.md`.

---

## Slice 1: Tests first (tasks 1 to 8)

- [ ] 1. [css] Close the gaps in `design/DESIGN.md`.
  - Test first: `apps/web/app/haunting.test.ts` "design gaps": reads `design/DESIGN.md` and fails until each item of the design's "Gaps" list has a value in section 3.1 or 2.2 (turbulence parameters and mask stops, pill pulse end frame, flicker stops, amber aura at rest, wisp size and opacity, ghost glyph geometry, direction and stagger readings).
  - Then: add the values to `design/DESIGN.md`, nothing else. Covers R10.1.
- [ ] 2. [unit] `inboxFog`.
  - Test first: `apps/web/lib/inbox-fog.test.ts`: empty list is `0.6`; all at peace is `0`; one haunted of one is `1`; one haunted of two is `0.575`; two unverified of four is `0.575`; a notice that needs confirmation or cannot be read counts in the denominator only; a mix of at-peace and other states with none haunted or unverified is `0`; the result is never below `0.15` unless it is `0`, never above `1`; adding an at-peace notice never raises the level (a fast-check property, `toBeCloseTo`).
  - Then: implement in `lib/inbox-fog.ts`. Covers R1.4.
- [ ] 3. [unit] `auraOf`.
  - Test first: `apps/web/lib/aura.test.ts`: any `disagrees` gives `haunt`; no disagreeing and any `unverified` gives `unverified`; only `verified`, `confirm`, `unsupported` or no lines gives `null`.
  - Then: implement `lib/aura.ts`. Covers R3.1, R3.6.
- [ ] 4. [css] Haunt tokens, keyframes and the reduced-motion block.
  - Test first: `apps/web/app/haunting.test.ts`:
    - tokens: `--mist-veil`, `--mist-shade`, `--aura-haunt`, `--aura-unverified`, `--ghost-haunt` equal the values in `design/DESIGN.md` 2.4;
    - every keyframe named in the design exists (`veil-lift`, `mist-manifest`, `mist-drift`, `flicker`, `materialize`, `aura-h`, `aura-u`, `afterimage`, `wisp`, `ghost-bob`, `ghost-blink`, `exorcise`, `exorcise-ring`, `pulse-pill`) and its durations match 2.2;
    - the media block sets `animation: none` for the veil, mist, ring and wisp, hides the veil, and holds the static values: aura `0 0 0 1px rgba(232,89,12,.16), 0 0 64px 8px var(--aura-haunt)`, afterimage `3px -2px 6px var(--ghost-haunt)`;
    - every `animation:` in the haunt classes is neutralised in the block (extends the existing check in `reduced-motion.test.ts`, which stays unchanged);
    - no haunt rule uses `var(--color-accent` and none uses `requestAnimationFrame` or `.animate(`.
  - Then: nothing yet; it fails on the missing tokens and rules. Covers R8.1, R8.2, R8.6, R10.2, R10.4.
- [ ] 5. [unit] Mist over canvas keeps text contrast.
  - Test first: in `haunting.test.ts`, composite `mist-veil` over `canvas` with alpha blending and assert WCAG ratios of `ink`, `text-secondary` and `text-muted` on the result are at least 4.5. Also assert `a11y-contrast.test.ts` is untouched (its documented pairs still pass).
  - Then: no code change expected; if it fails, fix the token or `design/DESIGN.md`, not the test. Covers R9.1, R9.2.
- [ ] 6. [component] Components carry the hooks.
  - Test first, one file each, written against `design.md`:
    - `Haunt.test.tsx`: level 0 renders nothing; level 1 renders `data-testid=haunt-fog` with `aria-hidden`, `--haunt-level: 1`, two tiles; `exorcised` sets `data-exorcised`; no text content, no focusable child.
    - `Paper.test.tsx`: `data-aura` follows `auraOf`; absent when all lines are calm.
    - `HauntedLine.test.tsx`: only a `disagrees` line wraps the stated figure in `data-possessed`, sets `--i` from the line index, and carries the materialize class on the recomputed figure; other states carry none; the stated figure text and `stated` tag are unchanged.
    - `StatusPill.test.tsx`: the notice-level haunt pill has the glow class and keeps `! Haunted · n`; `? Unverified`, `✓ At peace` and line-level pills have no glow class.
    - `InboxRow.test.tsx`: a haunted row's kind icon takes the haunt classes; other rows do not.
    - `GhostGlyph.test.tsx`: `aria-hidden`, a body group and an eyes group, no fill colour.
    - `DraftWorkspace.test.tsx`: level `0.6` while draft; `exorcised` only after the approval request resolves ok; a rejected approval keeps the mist and renders no ring; unticking removes `data-exorcised`; a draft loaded approved starts exorcised and renders no ring; the ring appears only on the transition.
  - Then: nothing yet. Covers R1.1, R1.7, R3.1, R4, R5.3, R5.8, R6.2, R6.4 to R6.6, R7.3, R9.3.
- [ ] 7. [e2e] `e2e/haunting.spec.ts`: first load.
  - Test first, at 1440×900 with `reducedMotion: 'no-preference'`:
    - Inbox with the specimen notices: `haunt-fog` exists, its opacity equals `0.4 + 0.6 × inboxFog` for the seeded states (computed from the same fixtures, not hard-coded); the haunted row's kind icon has the haunt fill; the `! Haunted · n` pill has a non-`none` box-shadow.
    - Empty Inbox (fresh data dir): `haunt-fog` opacity is `0.64`; the specimen card has `data-aura="haunt"` and a non-`none` box-shadow.
    - Veil: on a full load `haunt-veil` runs `veil-lift` and ends at opacity `0`; it never takes the pointer (`elementFromPoint` at the centre during the animation is not the veil) and the skip link still takes focus with Tab; after a client-side link to a notice the veil has no running animation.
    - Notice view of the Form 29 specimen: `haunt-fog` exists; the paper has `data-aura="haunt"`; the possessed line animates `flicker` then `pulse-h`; the stated figure has a non-`none` text-shadow; the recomputed figure and the Recomputed and Difference tiles run `materialize`, and `getByText` finds them before the animation ends; unverified, confirm, unsupported and verified lines have none of these.
    - At peace: after confirming and verifying all lines of a notice, `haunt-fog` is not in the DOM and `data-aura` is absent.
    - Ghost glyph: the logo glyph runs `ghost-bob` and `ghost-blink`.
  - Then: fail on the missing hooks. Covers R1, R2, R3, R4, R5, R7.
- [ ] 8. [e2e] [a11y] `e2e/haunting.spec.ts`: reduced motion, the exorcism and axe.
  - Test first:
    - Reduced motion (`emulateMedia({ reducedMotion: 'reduce' })`): on every screen in the Terms `await page.evaluate(() => document.getAnimations().length)` is `0`, also immediately after load and after ticking the approval; the veil is not visible; mist opacity equals the resting value; the aura, afterimage, pill and kind icon show the static shadows from `design/DESIGN.md` 3.1; the wisp is not displayed; toggling the emulation on one page switches without a reload and the veil does not replay.
    - Exorcism (motion on): on Exorcise the mist opacity is `0.64`; ticking approval makes `haunt-fog` take `data-exorcised` and its opacity reach `0` after the server answers; `haunt-ring` appears once and is gone after 900ms; unticking and an edit each bring the mist back; a stubbed 403 from the approval route leaves the mist and draws no ring; a reload with the draft approved shows no mist and no ring. With reduced motion the mist goes to `0` with no ring and `getAnimations()` stays empty. Approval state, hash and `Export PDF` behave exactly as in `approval.spec.ts` (the export control is still `aria-disabled` before approval).
    - Axe: use `scanScreen` from `accessibility-edge-cases` on `inbox-empty`, `inbox-list`, `notice-view`, `exorcise-draft` and `exorcise-approved` at 1440 and 390, with the haunt layer drawn (motion on, after the veil finished) and with reduced motion on. No serious violation and no new waiver in `e2e/a11y-waivers.ts`. The haunt elements are not in the accessibility tree.
  - Then: fail on the missing hooks. Covers R6, R8, R9.3 to R9.7.

**Slice 1 boundary:** the new tests exist and fail only because the haunt layer does not exist yet. The old suites are untouched and still pass.

---

## Slice 2: Implementation in `apps/web` (tasks 9 to 18)

- [ ] 9. [css] Haunt tokens and the reduced-motion block in `globals.css`.
  - Test first: task 4 and 5 (`haunting.test.ts`).
  - Then: add the five tokens from `design/DESIGN.md` 2.4, the keyframes and classes named in `design.md`, and the extra rules in the existing `@media (prefers-reduced-motion: reduce)` block. Every value is a token or a quoted literal. Covers R8.1, R8.2, R9.1, R10.1, R10.2, R10.4.
- [ ] 10. [unit] `inboxFog` and `auraOf` implementations.
  - Test first: tasks 2 and 3.
  - Then: `lib/inbox-fog.ts`, `lib/aura.ts`. No new dependency. Covers R1.4, R3.1.
- [ ] 11. [component] `Haunt.tsx`: page mist and veil.
  - Test first: `Haunt.test.tsx` from task 6.
  - Then: add `Haunt.tsx` with `Haunt`, `HauntClient` and `HauntVeil`: the two noise tiles as an inline SVG data URI, the gutter shade at 1280px, the roll-in, `data-exorcised`, and `null` at level 0. Covers R1.1 to R1.3, R1.5 to R1.7, R2.3, R9.3.
- [ ] 12. [e2e] Mount the veil and the mist per screen: `app/layout.tsx`, Inbox, Notice view.
  - Test first: the first-load and veil parts of `e2e/haunting.spec.ts` (task 7), plus the mist level checks on Inbox, empty Inbox and Notice view.
  - Then: render `HauntVeil` in `layout.tsx` before the children, `Haunt` with `inboxFog()` on the Inbox (`EMPTY_INBOX_LEVEL = 0.6` in `EmptyInbox`) and with the fog value on the Notice view, via the client wrapper that follows live line states. Check the tab order, skip link and `RouteFocus` are unchanged (`keyboard.spec.ts` stays green). Covers R1.4, R1.8, R1.10, R1.11, R2.1 to R2.6.
- [ ] 13. [component] `Paper`: aura.
  - Test first: `Paper.test.tsx` (task 6) and the aura checks in `haunting.spec.ts`.
  - Then: set `data-aura` from `auraOf` and add the aura classes. The empty-Inbox specimen card passes `haunt`. Covers R3.
- [ ] 14. [component] `HauntedLine`: flicker, afterimage, wisp, materialize.
  - Test first: `HauntedLine.test.tsx` (task 6) and the possessed-line checks in `haunting.spec.ts`.
  - Then: set `--i`, wrap the stated figure in `data-possessed`, add the materialize class to the recomputed figure and to the Recomputed and Difference tiles when the notice has a possessed line, and the `::after` wisp. Do not change `Figure` or the engine state logic. Check the `no-raw-money` test still passes. Covers R5.
- [ ] 15. [component] `StatusPill` and `InboxRow`: haunted glow.
  - Test first: `StatusPill.test.tsx`, `InboxRow.test.tsx`.
  - Then: add the glow class to the notice-level haunt pill and the haunt classes to the kind icon of a haunted row. Covers R4.
- [ ] 16. [component] `GhostGlyph`: bob and blink.
  - Test first: `GhostGlyph.test.tsx` and the glyph check in `haunting.spec.ts`.
  - Then: split the glyph into body and eyes groups and add the two animations. Covers R7.
- [ ] 17. [component] `DraftWorkspace` and `ApprovalCard`: the exorcism.
  - Test first: `DraftWorkspace.test.tsx` and the exorcism checks in `haunting.spec.ts` (task 8).
  - Then: mount `HauntClient` at level `0.6` (`EXORCISE_DRAFT_LEVEL`) with `exorcised` bound to the approval state returned by the server, and add the one-shot ring to `ApprovalCard` on the not-approved to approved transition. Do not touch `approval.ts`, the hash, or the export route; `approval.spec.ts` and the approval server tests stay unchanged. Covers R6.
- [ ] 18. [e2e] [a11y] Reduced motion and axe pass on every screen.
  - Test first: the reduced-motion and axe parts of `haunting.spec.ts` (task 8), then the whole suite: `bun run test`, `bun run typecheck`, `bun run e2e`.
  - Then: fix leftovers. If axe reports a pair, check the ratio first and a waiver is the last resort, with a reason in `e2e/a11y-waivers.ts`. Note any changed existing assertion here. Covers R8, R9, R10.8.

**Slice 2 boundary:** Inbox, empty Inbox, Notice view and Exorcise show the haunting; reduced motion keeps every effect still with `document.getAnimations()` empty; axe is clean; the approval gate is unchanged. The full suites are green.

---

## Slice 3: README screenshots (tasks 19 to 20)

- [ ] 19. [unit] A screenshot script and a check that the README images exist.
  - Test first: `test/readme-screenshots.test.ts`: every image path referenced from `README.md` under a "The haunting" heading exists, is a PNG, and is under 1 MB; the README still contains the in-sample caveat; the screenshot script name is listed in `package.json`.
  - Then: add `scripts/haunting-screenshots.ts` (Playwright, already a dependency) that starts the built app in fixture mode, loads the specimens, waits for the veil to finish, and writes `docs/haunting/inbox-empty.png`, `inbox.png`, `notice-possessed.png` and `exorcise-approved.png` at 1440×900, then a phone shot `notice-phone.png` at 390×844. Screenshots use the bundled specimens only. Covers R10.9.
- [ ] 20. [unit] README section "The haunting".
  - Test first: the same `readme-screenshots.test.ts` fails until the README references the five images with alt text.
  - Then: add a short "The haunting" section after "What it does" in `README.md` with the images, two sentences on what each effect is and the line "With reduced motion every effect is still." Keep the in-sample caveat and add no accuracy claim. Run the script and commit the PNGs. Covers R10.9.

**Slice 3 boundary:** the README shows the haunting from the running app on the bundled specimens, and the existing suites are still green. This closes the spec.
