# Tasks: haunting-ux

Run `bun run test` and `bun run typecheck` after each task. Run `bun run e2e` for tasks tagged `[e2e]` or `[a11y]`. Each task names the test that covers it.

Test tags: `[unit]` Vitest on pure logic · `[component]` Vitest and Testing Library · `[css]` Vitest reading CSS or sources · `[e2e]` Playwright · `[a11y]` Playwright with axe-core · `[manual]` done by hand, no test.

Tasks 1 to 14 describe work that was built. Tasks 15 to 20 are open follow-ups for what was not built.

---

## Built work (tasks 1 to 14)

- [x] 1. [css] Haunt tokens in `globals.css`.
  - Test: `apps/web/app/tokens.test.ts` asserts `--mist-veil`, `--mist-shade`, `--aura-haunt`, `--aura-unverified` and `--ghost-haunt` against the DESIGN.md drop-in. `--noise-a`, `--noise-b` (feTurbulence data URIs used as masks) and `@property --veil-clear` sit beside them. Covers R10.2.
- [x] 2. [unit] `inboxFog` in `lib/states.ts`.
  - Test: `apps/web/lib/states.test.ts`. Empty list is `0.6`, no haunted or unverified notice is `0`, otherwise `0.15 + 0.85 × (haunted + unverified) / kinds.length`. Covers R1.4.
- [x] 3. [component] `Haunt` and `HauntVeil` in `components/Haunt.tsx`.
  - `Haunt({ level, exorcised })` renders `data-testid=haunt-fog` with `--haunt` and `data-exorcised`, and `null` at level 0. `HauntVeil` renders `data-testid=haunt-veil`. The CSS adds `.haunt`, `.haunt-mist`, `.haunt-mist-b`, `.haunt-veil`, `mist-manifest`, `mist-drift-a`, `mist-drift-b` and `veil-lift` (1.6s ease-out, no hold).
  - Test: `e2e/haunting.spec.ts` (first load at 1440 and 390; an at-peace Form 28 notice has no haunt layer). Covers R1.1 to R1.3, R1.5 to R1.7, R2.
- [x] 4. [e2e] Mount the veil and the mist per screen.
  - `app/layout.tsx` renders `HauntVeil` after the page, `app/page.tsx` renders `Haunt` at `inboxFog()`, and `app/notices/[id]/page.tsx` renders `Haunt` at `assessment.fog`.
  - Test: `e2e/haunting.spec.ts` (first load at 1440 and 390; the Inbox reads haunted; a fast click reads the figures within 0.5s with the veil under 0.4 opacity) and `apps/web/components/SkipLink.test.tsx` (veil after the page). Covers R1.4, R2.1 to R2.6.
- [x] 5. [e2e] Document aura on `Paper` and `SpecimenCard`.
  - `auraOf` in `lib/states.ts`. `Paper` sets `.paper` and `data-aura`, the Notice view passes `auraOf(lines)`, `SpecimenCard` sets `data-aura`. CSS: `aura-h`, `aura-u`.
  - Test: `e2e/haunting.spec.ts` (first load) and `apps/web/app/reduced-motion.test.ts` (static aura). Covers R3.
- [x] 6. [component] Possessed line in `HauntedLine`.
  - `span.possessed` on the stated figure, `span.materialize` on the computed one, animation-delay pairs for flicker and pulse, `.glow-haunt::after` wisp, `afterimage`, `haunt-flicker`. The Recomputed and Difference tiles are wrapped in `.materialize`. `materialize` is 360ms after 120ms.
  - Test: `apps/web/components/HauntedLine.test.tsx` (possessed and materialize only on `disagrees`) and `e2e/reduced-motion.spec.ts` (flicker then pulse names). Covers R5.
- [x] 7. [e2e] Haunted pill and kind icon.
  - `pill-haunted` on the notice-level haunted pill in `StatusPill`, `kind-haunted` on the `InboxRow` kind icon.
  - Test: `e2e/haunting.spec.ts` (the Inbox reads haunted). Covers R4.
- [x] 8. [e2e] Ghost glyph bob and blink.
  - `g.ghost-body` and `g.ghost-eyes` in `GhostGlyph`, with `ghost-bob` and `ghost-blink`.
  - Test: `e2e/haunting.spec.ts` (first load at 1440 and 390) and `apps/web/app/reduced-motion.test.ts` (figures at rest). Covers R7.
- [x] 9. [e2e] The exorcism in `DraftWorkspace` and `ApprovalCard`.
  - `DraftWorkspace` renders `Haunt` at level `0.6` with `exorcised={approved}` and counts accepted approvals. `ApprovalCheck` renders `span.exorcise-ring` (`data-testid=exorcise-ring`) once per accepted approval. `approval.ts`, the hash and the export route are untouched.
  - Test: `e2e/haunting.spec.ts` (approving lifts the fog with the calm ring; unticking brings it back). Covers R6.1 to R6.3, R6.5, R6.7, R6.8.
- [x] 10. [css] Reduced motion keeps the haunt layer, still.
  - Additions to the `prefers-reduced-motion` block in `globals.css`: static aura, static afterimage, veil and wisp hidden, mist and figures at rest, no ring.
  - Test: `apps/web/app/reduced-motion.test.ts` (describe 'the haunt layer (DESIGN.md 3.1) stays, still'). Covers R8.1, R8.2, R8.4.
- [x] 11. [e2e] Reduced motion at runtime.
  - Test: `e2e/haunting.spec.ts` (reduced motion: `getAnimations` empty and every effect static; reduced-motion exorcism is instant with no ring). Covers R8.1 to R8.3.
- [x] 12. [a11y] Axe with the haunt layer drawn.
  - `e2e/a11y.ts` waits for running animations before axe. `e2e/a11y.spec.ts` is unchanged.
  - Test: `e2e/a11y.spec.ts` on `inbox-empty`, `inbox-list`, `notice-view`, `calc-drawer-open`, `exorcise-draft` and `exorcise-approved` at 1440 and 390. Covers R9.3, R9.5, R9.6.
- [x] 13. [e2e] Overflow helpers for clipped elements.
  - Overflow helpers in `e2e/helpers.ts`. `e2e/inbox.spec.ts` and `e2e/notice-view.spec.ts` skip elements clipped by an in-viewport overflow-hidden ancestor.
  - Test: `e2e/inbox.spec.ts` and `e2e/notice-view.spec.ts`. Covers R10.8.
- [x] 14. [manual] README Screenshots section.
  - `docs/screenshots/inbox.png`, `notice.png`, `drawer.png`, `exorcise.png` at 1440 and `inbox-390.png`, `notice-390.png`, taken by hand from the running app on the bundled specimens. The in-sample caveat stays.
  - Test: none. There is no screenshot script and no `readme-screenshots` test. Covers R10.9.

**Built boundary:** Inbox, empty Inbox, Notice view and Exorcise show the haunting. Reduced motion keeps every effect still. Axe is clean on the six screens. The approval gate is unchanged. The builder ticks a task only when its named test passes.

---

## Open follow-ups (tasks 15 to 20): not built

- [ ] 15. [unit] `auraOf` unit test.
  - Test first: add cases to `apps/web/lib/states.test.ts`: any `disagrees` gives `haunt`; no disagreeing and any `unverified` gives `unverified`; only verified, confirm, unsupported or no lines gives `null`. Covers R3.1, R3.6.
- [ ] 16. [component] Component tests for the haunt hooks.
  - Test first, one file each: `Haunt.test.tsx` (level 0 renders nothing; `--haunt`, `data-exorcised`, `aria-hidden`, no text), `Paper.test.tsx` (`data-aura` follows `auraOf`), `StatusPill.test.tsx` (`pill-haunted` only on the notice-level haunted pill), `InboxRow.test.tsx` (`kind-haunted` only on a haunted row), `GhostGlyph.test.tsx` (`aria-hidden`, body and eyes groups), `DraftWorkspace.test.tsx` (level `0.6`, `exorcised` only after an accepted approval, no ring on a page loaded approved). Covers R1.1, R1.7, R3.1, R4, R6.4 to R6.6, R7.3.
- [ ] 17. [e2e] Stubbed 403 exorcism test.
  - Test first: in `e2e/haunting.spec.ts`, stub the approval route to return 403 and assert the mist stays, `data-exorcised` is absent and no `exorcise-ring` is drawn. Covers R6.4.
- [ ] 18. [unit] Mist contrast test.
  - Test first: composite `--mist-veil` over `canvas` with alpha blending and assert at least 4.5:1 for `ink`, `text-secondary` and `text-muted`. Add it as a new case in `a11y-contrast.test.ts` without changing the existing ones (the spec's former `haunting.test.ts` is not created). Covers R9.2.
- [ ] 19. [manual] Screenshot script and README check.
  - Add a script that starts the built app in fixture mode and writes the six README images, and a test (`test/readme-screenshots.test.ts`) that every image the README references exists and is a PNG. Covers R10.9.
- [ ] 20. [manual] Decide on a night mode.
  - Not built on purpose: `design/DESIGN.md` rules out dark and black/orange themes. Open only if DESIGN.md adds a night palette first; otherwise close this task as won't do.
