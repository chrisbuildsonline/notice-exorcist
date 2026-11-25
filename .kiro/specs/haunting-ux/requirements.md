# Requirements: haunting-ux

App: `apps/web`. Feature F15: make the haunting visible on the Inbox and the Notice view, and let it lift on the Exorcise screen. The visual source of truth is `design/DESIGN.md` section 3.1 "The haunting, made visible (F15)" and the haunt tokens in 2.1 and 2.4. Every value in this spec is quoted from there or named by a token; a value that is not in `design/DESIGN.md` is added there first, never invented in code (see R10). This spec extends `exorcism-flow` and refines R3 of `accessibility-edge-cases` (reduced motion) for the new effects. Rules from `approval-gate.md`, `no-model-math.md` and `product.md` apply in full. No requirement here relaxes the approval gate or the provenance rules, and no effect carries meaning on its own.

## Terms
- **Haunt layer**: the effects of `design/DESIGN.md` 3.1: page mist, first-load veil, document aura, haunted marks, the possessed line, the exorcism, the ghost glyph.
- **Page mist**: the fixed `<Haunt level>` layer, `data-testid=haunt-fog`, at `z-index:-1`.
- **Level**: a number from 0 to 1 passed to `<Haunt>`. It is never rendered as text. Opacity of the mist is `0.4 + 0.6 × level`. At level 0 the layer is not drawn.
- **Fog value**: the notice's fog opacity from `design/DESIGN.md` section 3 (`0.15 + 0.85 × (unverified + disagreeing) / total lines`), the same function that drives the fog over the paper.
- **Haunted notice**: a notice whose notice-level pill is `! Haunted · n` (at least one line disagrees). **Unverified notice**: pill `? Unverified`. **At peace**: pill `✓ At peace`.
- **Possessed line**: a line in state `disagrees`.
- **Resting state**: how an effect looks after its one-time entrance has finished, or from the first frame under reduced motion.
- **Screens**: Inbox empty, Inbox with notices, Notice view (with and without a haunted line, and at peace), Exorcise draft, Exorcise approved.
- **Viewport pair**: desktop 1440×900 and phone 390×844. Gutters in R1.5 need 1280px or wider, so they are checked at 1440 only.
- **Serious violation**: an axe-core result with impact `serious` or `critical`.

## Requirements

### R1. Page mist, with a level per screen
1. THE app SHALL provide one `<Haunt level>` component that renders the page mist as a fixed layer, `data-testid=haunt-fog`, `pointer-events: none`, `aria-hidden="true"`, at `z-index: -1`, behind every surface.
2. THE mist SHALL be made of two tiles of fractal-noise wisps (an inline SVG `feTurbulence`, stitched) in `mist-veil`, masked so they are densest at the bottom and thin at the top. Layer A SHALL drift sideways over 70s and layer B the other way over 90s.
3. THE mist opacity SHALL be `0.4 + 0.6 × level`.
4. THE level per screen SHALL be:
   - Notice view: the notice's fog value.
   - Inbox with notices: `inboxFog()`, which is `0.15 + 0.85 × (haunted notices + unverified notices) / notices`.
   - Empty Inbox: `0.6`, because its hero is the haunted specimen.
   - Inbox where every notice is at peace: `0`.
   - Exorcise while the reply is a draft: `0.6`. See R6 for approved.
5. WHEN the viewport is 1280px or wider, THE outer gutters SHALL take a `mist-shade` gradient, 9% of the width on each side. No text SHALL sit in those gutters.
6. WHEN the layer mounts, THE mist SHALL roll in once over 2.4s: from opacity 0, 6% lower and scaled 1.08, to its resting state.
7. WHEN the level is 0, THE layer SHALL NOT be in the DOM (not hidden by CSS only), so an at-peace notice and an at-peace Inbox show no mist.
8. WHEN the level changes while the page is open (a line becomes verified, a notice is added or removed), THE mist opacity SHALL follow it without remounting or replaying the roll-in.
9. THE mist SHALL be lighter than `canvas`: it SHALL NOT use the accent, a dark colour or a status hue.
10. THE level SHALL be computed from engine states and notice-level states only. It SHALL NOT come from model text.
11. THE confirm form, the calculation drawer and the upload error states SHALL use the level of the screen they sit on and SHALL NOT mount a second layer.

### R2. First-load veil
1. THE root layout SHALL render the veil, `data-testid=haunt-veil`: a full-screen `mist-veil` wash at `z-index: 40`, `pointer-events: none`, `aria-hidden="true"`.
2. WHEN a page is loaded in full (first visit or reload), THE veil SHALL lift and disperse once over 2.2s: opacity .92 to 0 and scale 1 to 1.12.
3. THE veil SHALL be hidden at rest.
4. WHEN the user navigates by client routing (Inbox to notice to Exorcise), THE veil SHALL NOT play again.
5. THE veil SHALL NOT block input, take focus, change the tab order, or delay the skip link or `RouteFocus`.
6. THE veil SHALL NOT be shown on a page that has no mist (it is a first-load effect of the root layout, not of the level). Its removal after the animation SHALL leave no element that can be hit by the pointer.

### R3. Document aura
1. THE paper SHALL carry `data-aura`. WHEN any line disagrees, THE value SHALL be `haunt`. OTHERWISE WHEN any line is unverified, it SHALL be `unverified`. OTHERWISE the attribute SHALL be absent.
2. FOR `haunt`, THE paper SHALL breathe between `0 0 0 1px rgba(232,89,12,.16), 0 0 64px 8px var(--aura-haunt)` and `0 0 0 1px rgba(232,89,12,.26), 0 0 88px 16px var(--aura-haunt)` over 2.4s.
3. FOR `unverified`, THE paper SHALL use the same shape in amber (`aura-unverified`) over 3.6s.
4. THE specimen card on the empty Inbox SHALL carry `data-aura="haunt"`, with the same effect.
5. THE aura SHALL be a shadow on the paper. It SHALL NOT sit under a pill or a chip, and SHALL NOT change the paper's `surface` fill.
6. THE aura SHALL be present only while the state holds: once all lines are calm, THE attribute SHALL go and the shadow with it.

### R4. Haunted pill and kind-icon glow
1. THE `! Haunted · n` pill SHALL glow with `0 0 0 1px rgba(232,89,12,.22), 0 0 14px var(--glow-haunt)` on the 2.4s pulse. Its word, icon and count SHALL be unchanged.
2. A haunted Inbox row's kind icon SHALL take `haunt-bg` as its fill and `haunt-fg` as its glyph colour, with the same glow and pulse.
3. THE `? Unverified`, `✓ At peace`, `◐ Confirm` and `⊘ Not checked` pills, and the kind icons of rows that are not haunted, SHALL NOT glow.
4. THE glow SHALL NOT change the pill's colours or contrast (R9).
5. THE meaning SHALL stay in the word. WHEN the glow is removed, THE pill SHALL still read as before.

### R5. The possessed line
1. **Flicker.** WHEN a possessed line first renders, ITS glow and tint SHALL flicker for 1.4s, once, staggered 80ms per line, then hand over to `pulse-h`. Lines that are not possessed SHALL NOT flicker.
2. **Afterimage.** THE stated figure of a possessed line SHALL carry a text-shadow of `ghost-haunt`, drifting over 3.2s between `3px -2px 6px var(--ghost-haunt), -2px 1px 0 rgba(20,22,28,.10)` and `-3px -3px 8px var(--ghost-haunt), 2px 2px 0 rgba(20,22,28,.10)`. THE glyphs themselves SHALL stay `ink`.
3. THE afterimage SHALL apply only to the stated figure on a disagreeing line. It SHALL NOT apply to the computed figure, the `stated` tag, or any other line.
4. **Ember wisp.** A possessed line SHALL emit a soft ember plume (`::after`, blurred radial `glow-haunt`, behind the row content) that rises 28px from the row's top edge and fades, every 5.6s.
5. **Materialize.** THE recomputed figure on a possessed line, and the Recomputed and Difference tiles of a notice that has a possessed line, SHALL appear out of the fog once: from opacity 0, `blur(6px)` and 4px low, over 700ms after 1.2s.
6. THE materialising figures SHALL be in the DOM, readable by assistive technology and findable by `getByText` from the first render. Only their look SHALL animate.
7. THE stated and computed figures SHALL stay side by side and the stated figure SHALL never be overwritten (`no-model-math.md`). The effects SHALL add no number, tag or text.
8. A line that is unverified, confirm, unsupported or verified SHALL show none of R5.1 to R5.5.
9. WHEN a possessed line becomes verified, THE flicker, afterimage, wisp and materialize SHALL stop and the calming sequence of `design/DESIGN.md` section 3 SHALL run unchanged.

### R6. The exorcism
1. WHILE the Exorcise reply is a draft, THE page mist SHALL sit at level 0.6 (R1.4).
2. WHEN the user ticks "I approve this exact draft" AND the server accepts the approval, THE mist layer SHALL take `data-exorcised` and lift 12% and fade to 0 over 1.2s.
3. AT the same moment, THE approval card SHALL send out a calm ring once: `0 0 0 2px var(--color-calm-edge)` expanding from the card, scale 1 to 1.6, opacity .7 to 0, over 900ms.
4. IF the server rejects the approval, THEN THE mist SHALL stay and no ring SHALL play. THE effect SHALL follow the server's answer, not the click.
5. WHEN the approval is cleared (the box is unticked, or an edit clears it), THE mist SHALL return to level 0.6 and `data-exorcised` SHALL go.
6. WHEN the Exorcise page loads with the draft already approved, THE layer SHALL start in the exorcised state (not drawn or at opacity 0) and NO ring SHALL play.
7. THE exorcism SHALL NOT change approval state, the hash, the export control or any server request. It SHALL follow the approval state; it SHALL NOT cause it (`approval-gate.md`).
8. THE ring SHALL be decorative: it SHALL NOT take focus, intercept pointer events or be announced.

### R7. Ghost glyph
1. THE ghost glyph in the logo and in the empty-state visual SHALL bob 2px over 6s.
2. THE ghost's eyes SHALL blink every 7s: scaled to .1 for 120ms.
3. THE glyph SHALL stay `aria-hidden` and line-art as in `design/DESIGN.md` section 4 (ink 1.5px stroke, no fill colour).
4. THE glyph SHALL NOT be the only carrier of the product name or of any state.

### R8. Reduced motion
1. WHEN `prefers-reduced-motion: reduce` is set, THE page SHALL run no CSS animation and no transition longer than 0ms from the haunt layer, and `document.getAnimations()` SHALL return an empty array on every screen in the Terms, including right after load and after the approval is ticked.
2. EVERY effect SHALL stay, still, at its resting state from the first frame. Nothing SHALL be removed except motion:
   - The veil SHALL be hidden and nothing SHALL manifest or materialise.
   - The mist SHALL be static at its resting opacity `0.4 + 0.6 × level`.
   - The aura SHALL be static at its first frame: `0 0 0 1px rgba(232,89,12,.16), 0 0 64px 8px var(--aura-haunt)` (amber for `unverified`).
   - The possessed figure SHALL keep a static afterimage `3px -2px 6px var(--ghost-haunt)`. The wisp SHALL be hidden.
   - The haunted pill and kind icon SHALL keep the static glow of R4.1.
   - The ghost glyph SHALL be still, eyes open.
3. THE exorcism SHALL be instant: the mist goes straight to 0 and no ring is drawn.
4. THE existing static line glows (unverified, disagrees) and the fog over the paper SHALL be unchanged from `accessibility-edge-cases` R3.
5. WHEN the setting changes while the page is open, THE page SHALL follow it without a reload. THE veil SHALL NOT replay on that change.
6. THE haunt layer SHALL use CSS only. No `requestAnimationFrame` loop and no Web Animations call SHALL be added (`no-js-animation.test.ts` stays green).

### R9. Contrast and accessibility are unchanged
1. THE haunt layer SHALL NOT lower the contrast of any text pair documented in `design/DESIGN.md` 2.1. `a11y-contrast.test.ts` SHALL keep passing unchanged.
2. A pure test SHALL composite `mist-veil` over `canvas` and assert that `ink`, `text-secondary` and `text-muted` on the result are at least 4.5:1, because the mist and the settled veil lie behind or beside text.
3. EVERY haunt element (mist, veil, ring, wisp, aura wrapper) SHALL be `aria-hidden` or an attribute or pseudo-element, SHALL NOT be focusable, and SHALL NOT appear in the accessibility tree.
4. THE tab order, focus ring, skip link and route focus SHALL be unchanged.
5. THE e2e axe scan (WCAG 2.0, 2.1 and 2.2 A and AA) SHALL pass with no serious violation on the screens in the Terms, at both viewports, with the haunt layer drawn and with reduced motion on.
6. THE first-load veil is a transient overlay: THE axe scans SHALL start after the veil has finished (R2.2), and a separate assertion SHALL check that the veil never takes pointer events or focus while it plays.
7. A status SHALL keep its word and icon. No status SHALL be conveyed by the haunt layer alone.

### R10. Values, provenance and no regressions
1. EVERY visual value of the haunt layer (colour, shadow, size, duration, easing, offset) SHALL come from `design/DESIGN.md` through a CSS custom property or a quoted literal. WHERE `design/DESIGN.md` does not give a value the implementation needs (see the design's "Gaps"), THE value SHALL be added to `design/DESIGN.md` first, then used.
2. THE haunt tokens (`mist-veil`, `mist-shade`, `aura-haunt`, `aura-unverified`, `ghost-haunt`) SHALL exist in `globals.css` with the values from 2.4, and `tokens.test.ts` SHALL assert them.
3. THE haunt layer SHALL NOT render any figure, count or text. The `no-raw-money` test and the provenance guard SHALL keep passing. The existing `Haunted · n` count is unchanged.
4. THE haunt layer SHALL NOT use the accent colour. Glows and mist SHALL use the status hues and the haunt tokens only.
5. THE haunt layer SHALL NOT use props: no bats, drips, cobwebs, black or orange page theme, or novelty font (`design/DESIGN.md` section 1).
6. THE approval gate SHALL be unchanged: no new request, no change to `approval.ts`, the hash, or the export endpoint.
7. A new dependency SHALL NOT be added. Mist, veil, aura and ring use CSS, an inline SVG and the existing Tailwind setup.
8. `bun run test`, `bun run typecheck` and `bun run e2e` SHALL pass. Existing assertions SHALL stay unchanged unless a requirement above changes them, and each such change SHALL be noted in the task.
9. THE README SHALL show the result with screenshots taken from the running app on the bundled specimens, and SHALL keep its in-sample caveat.
