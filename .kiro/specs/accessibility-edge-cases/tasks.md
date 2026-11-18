# Tasks: accessibility-edge-cases

Run `bun run test` and `bun run typecheck` after each task. Run `bun run e2e` for tasks tagged `[e2e]` or `[a11y]`. Every task is test first: write the test, see it fail for the stated reason, then make the change that turns it green. A task is done when its test passes and the full suites still pass.

Test tags: `[unit]` Vitest on pure logic · `[component]` Vitest and Testing Library · `[route]` Vitest on a route handler · `[css]` Vitest reading CSS or sources · `[e2e]` Playwright · `[a11y]` Playwright with axe-core.

Slices are independent stopping points. Each ends with a green `bun run test`, `typecheck` and `e2e`, and can be merged on its own. Take them in order: later slices reuse the helpers from earlier ones.

---

## Slice 1: Foundations (tasks 1 to 8)
Contrast proof, the axe harness, skip link, landmarks, focus rings, route focus.

- [x] 1. [unit] Contrast of the `design/DESIGN.md` pairs.
  - Test first: `app/a11y-contrast.test.ts` parses `globals.css`, computes WCAG 2.x ratios for the table in the design, and asserts each documented ratio (one decimal) and the AA minimums. Include `ink` on every status `-bg` and the focus ring on `canvas` and `surface`.
  - Then: if a documented ratio is off, fix `design/DESIGN.md`, not the test. Covers R2.4 to R2.6.
- [x] 2. [e2e] Add `@axe-core/playwright` (dev) and the `scanScreen` helper with waivers.
  - Test first: `e2e/a11y.helper.spec.ts` loads an inline page with a known serious violation (an image with no alt, a button with no name) and expects `scanScreen` to fail with rule id and selector; a minor-only page passes with a logged note; an unused waiver fails.
  - Then: add `e2e/a11y.ts` and an empty `e2e/a11y-waivers.ts`. State the dependency reason in the PR (R8.2). Covers R2.1 to R2.3.
- [x] 3. [component] Skip link.
  - Test first: `SkipLink.test.tsx` renders the link as the first element in the layout, `href="#main"`, text `Skip to main content`.
  - Then: add `SkipLink.tsx`, its `.skip-link` CSS (hidden until focus, then fixed top-left, 44px high, `z-50`), and render it first in `layout.tsx`. Covers R1.5.
- [x] 4. [e2e] One `<main id="main" tabIndex={-1}>` on every page, and the skip link works.
  - Test first: `keyboard.spec.ts` "skip link": on Inbox, notice and Exorcise pages press Tab once, expect the skip link focused and visible, press Enter, expect focus on `#main`.
  - Then: add a `Page` wrapper that owns the landmark and use it in the three pages. Check there is exactly one `main` per page. Covers R1.5.
- [x] 5. [e2e] Round controls keep a round focus ring.
  - Test first: `focus-ring.spec.ts` focuses every `.rounded-full` focusable on Inbox, notice view, drawer and Exorcise at 1440 and 390, and fails on `borderRadius` of `0px`, outline other than `2px solid rgb(91, 61, 245)`, or a ring clipped by an `overflow` ancestor.
  - Then: remove `border-radius: inherit` from the base `:focus-visible` rule in `globals.css`, add `.focus-inset` where a parent clips. Covers R1.3, R7.1.
- [x] 6. [e2e] Label-wrapped inputs show the ring on the label.
  - Test first: in `focus-ring.spec.ts`, Tab to the Dropzone file input and to the phone `Take a photo` input; the nearest `label` has a visible 2px outline matching its radius.
  - Then: switch `focus-within` utilities to `has-[:focus-visible]` on both labels in `Dropzone.tsx`. Covers R1.3, R1.7.
- [x] 7. [e2e] Focus moves to the page title on navigation.
  - Test first: `keyboard.spec.ts` "route focus": from Inbox open a specimen notice with Enter, expect `document.activeElement` to be the `h1`; go Back to Inbox, expect the Inbox `h1`; first page load leaves focus on `body`.
  - Then: add `RouteFocus.tsx` using `usePathname`, mount it in the layout, give each `h1` `tabIndex={-1}` with no outline. Covers R1.6.
- [x] 8. [a11y] Axe on Inbox (with notices) and notice view.
  - Test first: `a11y.spec.ts` rows `inbox-list` and `notice-view` at 1440 and 390, using `scanScreen`.
  - Then: fix every serious violation in the markup or tokens. Add a waiver only with a reason and a note in the PR. Covers R2.1, R2.7.

**Slice 1 boundary:** contrast test, axe harness and two axe screens are green; skip link, landmarks, focus rings and route focus ship. Nothing here changes behaviour of the approval flow.

---

## Slice 2: Keyboard path and the remaining screens (tasks 9 to 16)
The whole flow by keyboard, plus axe on the other screens.

- [x] 9. [e2e] Keyboard: Inbox to a notice.
  - Test first: `keyboard.spec.ts` "inbox to notice": from a fresh page, using only `keyboard.press`, reach `Try a specimen`, activate it, land on the notice. Assert focus is visible on each stop and tab order matches DOM order.
  - Then: fix any control that is not focusable or is out of order. Covers R1.1 to R1.3.
- [x] 10. [e2e] Keyboard: upload by keyboard.
  - Test first: focus the Dropzone input by Tab, expect the file chooser to open on Enter and on Space (`page.waitForEvent('filechooser')`), set the PNG fixture, expect the row to appear.
  - Then: adjust `Dropzone` so the visually hidden input is the focus target and nothing steals the key. Covers R1.1, R1.7.
- [x] 11. [e2e] Keyboard: notice view, line selection and confirm form.
  - Test first: select a line with Enter on its link, move through the side panel, fill the confirm form with the keyboard and submit. No Tab step skips a control or lands on a hidden one.
  - Then: fix order or missing names. Covers R1.1, R1.2.
- [x] 12. [e2e] Keyboard: calculation drawer.
  - Test first: `See the math` with Enter opens the dialog, focus lands inside, Tab and Shift+Tab cycle within it, Esc closes, focus returns to the trigger.
  - Then: only fix gaps (the dialog exists already). Covers R1.4.
- [x] 13. [e2e] Keyboard: approve and export without auto-approval.
  - Test first: `keyboard.spec.ts` "approval": on Exorcise, Tab reaches the checkbox; Enter on `Export PDF` while unticked does nothing and the control is still focusable; Space ticks the box and the download starts on Enter; an edit by keyboard unticks and re-blocks. No key or focus change ever ticks the box.
  - Then: fix gaps. Do not change `approval.ts`. Covers R1.8, R1.10.
- [x] 14. [e2e] Toast reachable and dismissable by keyboard.
  - Test first: after an edit clears approval, the toast is announced (`role=status`), its `Dismiss` button is the next tab stop after the edited block, Enter dismisses it, focus stays where it was.
  - Then: add the Dismiss button if missing and keep focus unchanged. Covers R1.9.
- [x] 15. [css] No positive `tabindex`, no `order-*` on interactive elements.
  - Test first: `no-tab-order-hacks.test.ts` scans `apps/web` sources for `tabIndex={[1-9]` and `tabindex="[1-9]` and for `order-` classes on `a`, `button`, `input` elements; fails on a hit.
  - Then: remove any hit. Covers R1.2.
- [x] 16. [a11y] Axe on confirm form, calculation drawer open, Exorcise (draft and approved).
  - Test first: add `confirm-form`, `calc-drawer-open`, `exorcise-draft`, `exorcise-approved` to `a11y.spec.ts` at 1440 and 390.
  - Then: fix violations. Covers R2.1.

**Slice 2 boundary:** the flow inbox, upload or specimen, notice, confirm, drawer, Exorcise, approve, export passes by keyboard; axe covers six screens. No visual change except focus rings and the Dismiss button.

---

## Slice 3: Reduced motion, empty inbox, unsupported rate (tasks 17 to 24)

- [x] 17. [css] Reduced-motion CSS covers every animation and transition.
  - Test first: extend `reduced-motion.test.ts`: every `@keyframes` name used by an `animation:` in `globals.css` is neutralised in the media block; `.fog`, `.line`, `.calc-panel` and the tablet panel have no non-zero transition there; static box-shadow values equal `design/DESIGN.md` section 3; `confirm`, `unsupported` and `verified` have no shadow.
  - Then: add the missing rules (`.fog` transition, `scroll-behavior`, panel animation). Covers R3.1 to R3.3.
- [x] 18. [css] No JS animation outside the reduced-motion hook.
  - Test first: `no-js-animation.test.ts` scans `apps/web` for `requestAnimationFrame`, `.animate(` and `behavior: 'smooth'`; fails on a hit outside `useReducedMotion.ts`.
  - Then: add `useReducedMotion.ts`; fix any hit. Covers R3.6.
- [x] 19. [e2e] Reduced motion in the browser.
  - Test first: `reduced-motion.spec.ts` with `emulateMedia({ reducedMotion: 'reduce' })` on a haunted notice: `animationName` is `none` on glow and fog, box-shadow is set and non-`none` on `unverified` and `disagrees` lines and `none` on `confirm`, `unsupported`, `verified`; fog opacity equals the value from `fogOpacity`. Same page with `no-preference` shows `pulse-h`, `pulse-u`, `fog-drift`. Toggle on the same page follows without reload.
  - Then: fix any difference. Covers R3.1 to R3.3, R3.7.
- [x] 20. [component] Static export indicator and instant calming.
  - Test first: `ApprovalCard.test.tsx` renders `Exporting…` text with a static indicator class under `motion-reduce`, and `HauntedLine.test.tsx` shows a line that turns verified has no calming class when reduced motion is on.
  - Then: add `motion-reduce:` variants, remove the spin for reduced motion. Covers R3.4, R3.5.
- [x] 21. [component] Empty inbox shows no money figure and one primary pill.
  - Test first: `EmptyInbox.test.tsx`: headline, one supporting line, `Try a specimen` is the only ink pill, `Upload a notice` is secondary, no `$` in the header, specimen card is `aria-hidden` and `inert`.
  - Then: extract `EmptyInbox.tsx` from `app/page.tsx`; render the amount header only when a computed figure exists; switch the phone sticky bar to `Try a specimen` when empty. Covers R4.1 to R4.4.
- [x] 22. [e2e] [a11y] Empty inbox in the browser.
  - Test first: `empty-inbox.spec.ts` with an empty data dir: R4 assertions at 1440 and 390 (sticky bar on phone), keyboard reaches the pill first after the skip link, `inbox-empty` axe scan, and deleting the last notice returns to the empty state with no error.
  - Then: fix. Add `inbox-empty` to `a11y.spec.ts`. Covers R4.5, R4.6.
- [x] 23. [unit] Unsupported rate: state, notice caption and draft skipping.
  - Test first: `assess.test.ts` (or `notice-api.test.ts`) with a line whose rate text the engine rejects: state `unsupported`, `computed` null, `difference` null, stated kept, no flag; `draft-builder.test.ts`: the line is absent from claims and `skipped` lists it with a reason; the hash input does not contain `skipped`; `explain.test.ts`: the unsupported sentence has no digits. Add the synthetic SPECIMEN fixture and record which rate text yields `unsupported` in the task PR note.
  - Then: implement `skipped` in `draft-builder.ts`, the count caption source in `notice-view.ts`. Covers R5.1, R5.2, R5.5, R5.6, R5.10.
- [x] 24. [e2e] [a11y] Unsupported line in the UI and the drawer.
  - Test first: `unsupported-rate.spec.ts`: the row shows the verbatim rate text, stated figure with `stated` tag, `—` in the recomputed and difference cells, the sentence "Duty-engine cannot check this rate, so the figure is shown as printed on the notice." in the DOM, `⊘ Not checked`, no glow class, no `$0.00` anywhere on the row, the caption "1 line is not checked and counts as stated."; the drawer shows rate text, HTS edition, reason and the engine caption, and no `Match`/`Mismatch`; the Exorcise page says one line was left out. Add `notice-unsupported` to `a11y.spec.ts`.
  - Then: add `UnsupportedLine.tsx`, the drawer branch and the Exorcise note. Covers R5.2 to R5.11.

**Slice 3 boundary:** reduced motion proven in CSS, source and browser; empty inbox and unsupported-rate lines behave honestly. The provenance guard and `no-raw-money` test must still pass.

---

## Slice 4: Odd uploads, tablet panel, final sweep (tasks 25 to 32)

- [x] 25. [unit] PNG and JPEG header parser.
  - Test first: `image-info.test.ts` with byte arrays built in the test: PNG 100×4000, PNG 4000×100, JPEG with a SOF0 and with a SOF2 segment, JPEG with the SOF after an APP1 segment, truncated header returns `null`, a PDF returns `null`.
  - Then: `lib/image-info.ts` returns `{ width, height }` or `null`. No dependency. Covers R6.5, R6.8, R8.2.
- [x] 26. [unit] `checkUpload` and the message table.
  - Test first: `upload-check.test.ts`: empty file → 422 "That file is empty."; 10 MB + 1 → 413 with the oversize message; `.exe` bytes with a `.png` name → 415; HEIC `ftyp` → 415 with the HEIC hint; 12000×12000 PNG header → 422 `too_many_pixels`; tall (800×3000) and wide (3000×800) → ok; `format-bytes.test.ts` for `formatBytes` (1 decimal, MB and KB).
  - Then: `upload-check.ts`, `upload-messages.ts`, `format-bytes.ts`, `limits.ts`. Covers R6.1 to R6.5, R6.8.
- [x] 27. [route] Wire the checker into upload and inbound.
  - Test first: extend `notices-upload.test.ts` (each rejection above stores no file and logs nothing) and `inbound.test.ts` (invalid attachment skipped; 422 when none valid; tall image accepted).
  - Then: replace `checkFile` calls in `intake.ts` and the inbound route by `checkUpload`. Covers R6.10, R6.11.
- [ ] 28. [component] Dropzone pre-check and accessible error.
  - Test first: `Dropzone.test.tsx`: a `File` over the limit never calls `fetch` and shows the oversize message with size and limit; a server error body is shown in `role="alert"`; the input gets `aria-invalid` and `aria-describedby` while an error shows, cleared on the next attempt; focus is unchanged.
  - Then: update `Dropzone.tsx`. Covers R6.1, R6.2, R6.9.
- [ ] 29. [e2e] [a11y] Upload edge cases in the browser.
  - Test first: `upload-edge.spec.ts`: 11 MB file, `.exe`, a `.gif`, an empty file, a HEIC stub each show the exact message at 1440 and 390 and add no row; a tall PNG and a wide PNG are accepted and show a row with progress then a ready or plain-language failure with a retry button; add `upload-error` to `a11y.spec.ts`.
  - Then: fix. Covers R6.1 to R6.5, R6.7, R6.9.
- [ ] 30. [unit] Downscale a copy for the model, keep the original.
  - Test first: `prepare-for-model.test.ts` in `notice-extract`: an image with longest side over the limit is reduced with the aspect ratio kept (tall and wide cases), a copy within the limit is returned unchanged, the input bytes are not mutated, and `sniff` of the stored original is unchanged. Record the chosen resize approach (R6.6 / design) in the PR; use no new dependency.
  - Then: implement and call it in `extractNotice` before the model request. Covers R6.6.
- [ ] 31. [e2e] Tablet side panel as a drawer.
  - Test first: `tablet-panel.spec.ts` at 820×1180: choosing a line opens a modal dialog from the right (560px) with the explanation and the "Candidates, not a final classification" caption; focus is trapped; Esc and scrim click close it; focus returns to the line; no horizontal scroll; targets ≥ 44px. At 1024 the panel is sticky at 5/12; at 390 it is the full-screen view. With reduced motion the dialog appears without a slide. Add the 820 viewport to the `notice-view-line-selected` axe scan.
  - Then: add `SidePanelDrawer.tsx`, reuse `.calc-drawer` CSS, open it only in the 768 to 1023 range and react to resize. Covers R7.2 to R7.5.
- [ ] 32. [e2e] Final sweep and doc fixes.
  - Test first: run the full a11y matrix (all screens, 1440 and 390, plus tablet) and the keyboard and reduced-motion specs together; any unused waiver fails.
  - Then: fix leftovers; update `exorcism-flow/requirements.md` R9 with a pointer to this spec; correct any `design/DESIGN.md` ratio the contrast test found wrong; review screenshots against section 6 of the design. Covers R2, R8.1, R8.3.

**Slice 4 boundary:** uploads handle oversize, wrong type, empty, tall and wide images with clear messages; the tablet panel is a drawer; the whole matrix is green. This closes the spec.
