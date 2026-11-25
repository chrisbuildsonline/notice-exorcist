# Design: haunting-ux

Visual values are quoted from `design/DESIGN.md` 2.1, 2.2, 2.4 and 3.1. This file says where each effect lives in code and how it is tested. It adds no visual value.

## Layout
New and changed files only.
```
apps/web/
  app/
    layout.tsx                    renders <HauntVeil/> first-load veil; no mist (mist is per page)
    globals.css                   haunt tokens (2.4), haunt keyframes and classes, reduced-motion block
    page.tsx                      Inbox: <Haunt level={inboxLevel}/>; EmptyInbox passes 0.6
    notices/[id]/page.tsx         Notice view: <Haunt level={fogValue}/>
    notices/[id]/exorcise/page.tsx  Exorcise: DraftWorkspace owns <Haunt/>
    haunting.test.ts              (css) haunt tokens, keyframes, reduced-motion block
  components/
    Haunt.tsx                     <Haunt level exorcised?> page mist; <HauntVeil/> first-load veil
    HauntedLine.tsx               (changed) flicker, afterimage wrapper, wisp, materialize classes
    Paper.tsx                     (changed) data-aura from line states
    StatusPill.tsx                (changed) haunt glow on the Haunted notice pill
    InboxRow.tsx                  (changed) haunted kind icon
    GhostGlyph.tsx                (changed) bob and blink
    DraftWorkspace.tsx            (changed) level 0.6, data-exorcised from approval state
    ApprovalCard.tsx              (changed) calm ring on a server-accepted approval
  lib/
    inbox-fog.ts                  inboxFog(), beside fogOpacity's module if it lives elsewhere
    inbox-fog.test.ts
    aura.ts                       auraOf(lineStates): 'haunt' | 'unverified' | null
    aura.test.ts
e2e/
  haunting.spec.ts                first load, reduced motion, exorcism, axe
design/DESIGN.md                  only to close the Gaps below (task 1)
README.md                         screenshots (last slice)
```
`fogOpacity` already exists for the paper fog. `inboxFog` follows its style and sits next to it. Neither is a money figure, so plain number arithmetic is fine; the existing property-style tests use `toBeCloseTo`. A level is never drawn as text.

## Key decisions

### One layer, driven by data attributes
All effects are CSS. React sets a few attributes and the stylesheet does the rest, so reduced motion is one media block and `document.getAnimations()` is empty by construction.

| Hook | Set by | Used by |
|---|---|---|
| `data-testid=haunt-fog` | `Haunt` | e2e, mist layer |
| `style="--haunt-level: n"` | `Haunt` | mist opacity `calc(0.4 + 0.6 * var(--haunt-level))` |
| `data-exorcised` | `Haunt` from a prop | lift transition, R6 |
| `data-testid=haunt-veil` | `HauntVeil` | e2e, veil |
| `data-aura="haunt\|unverified"` | `Paper` via `auraOf` | aura shadow and keyframes |
| `data-possessed` on a span around the stated `Figure` | `HauntedLine` | afterimage on `[data-possessed] .num` |
| `data-state=disagrees` | existing | flicker, wisp, materialize via `.line[data-state=disagrees]` |
| `data-testid=haunt-ring` | `ApprovalCard` | calm ring element, e2e |

`--haunt-level` is a unitless custom property, not a figure. The test hooks are names, not visual values.

### `<Haunt level exorcised?>`
- Server component for the markup, no state. It returns `null` when `level <= 0` (R1.7), which is why an at-peace page has no mist node at all.
- Markup: a fixed `div` (`aria-hidden`, `pointer-events:none`, `z-index:-1`) with two child tiles. Each tile is a `div` whose background is an inline SVG data URI containing one `feTurbulence` with `stitchTiles="stitch"`, tinted with `mist-veil` and masked by a vertical gradient (dense at the bottom). Tile A runs `mist-drift` 70s, tile B the reverse at 90s.
- The `div` also draws the `mist-shade` gutter gradients at `min-width: 1280px`, 9% each side.
- Entrance: the layer's own animation `mist-manifest 2.4s ease-out both` goes from opacity 0, `translateY(6%)`, scale 1.08 to rest. "6% lower" is read as `translateY(6%)`. Level changes after mount only change `--haunt-level`, and opacity is transitioned on that property, so R1.8 needs no remount. React keeps the node because the page keeps the same `key`.
- `exorcised` toggles `data-exorcised`, and a CSS rule runs `exorcise 1.2s` (opacity to 0, lift 12%, read as `translateY(-12%)`) with `forwards`. Removing the attribute returns the layer to `--haunt-level`. On Exorcise the component is a client child of `DraftWorkspace` so it can follow the approval state; on Inbox and Notice view it stays a server component. One file exports both forms (`Haunt` and `HauntClient`), which share the CSS.
- At-peace Notice view and at-peace Inbox: `level` is 0 and nothing mounts. When a line becomes verified and the fog value drops to 0 while the page is open, the client wrapper on the Notice view unmounts the layer after the opacity transition. The wrapper exists only so the layer can follow live state; the first render is still server-rendered.

### Levels per screen
| Screen | Level | Source |
|---|---|---|
| Notice view | fog value of the notice | existing fog function on engine line states |
| Inbox with notices | `inboxFog(levels)` | notice-level pills |
| Inbox empty | 0.6 | constant in `EmptyInbox`, named `EMPTY_INBOX_LEVEL` |
| Inbox, all at peace | 0 | `inboxFog` |
| Exorcise, draft | 0.6 | constant `EXORCISE_DRAFT_LEVEL` |
| Exorcise, approved | 0 and `exorcised` | `DraftWorkspace` state |

`inboxFog(notices)` takes the notice-level state of each notice (`haunted`, `unverified`, `at-peace`, and any other state) and returns: `0.6` for an empty list, `0` when no notice is haunted or unverified, otherwise `0.15 + 0.85 × (haunted + unverified) / notices.length`. Other states (needs confirmation, unreadable, processing) count in the denominator only. This is an assumption: `design/DESIGN.md` names only haunted and unverified notices in the numerator. The docs say "0 when every notice is at peace"; a mix of at-peace and other states with no haunted or unverified notice therefore also gives 0, which keeps the rule that no haunt layer shows without a reason.

### First-load veil
`HauntVeil` is rendered in `layout.tsx`, before `{children}`. Because the root layout is not remounted by client navigation, the CSS animation runs once per full load without any JavaScript. Base style: `opacity: 0`. Animation: `veil-lift 2.2s var(--ease-out) both` from opacity .92 and scale 1 to opacity 0 and scale 1.12. After the animation the element is at opacity 0, `pointer-events:none`, `aria-hidden`. `visibility: hidden` is applied by a second keyframe step at 100% so the box is also out of hit-testing and paint. Under reduced motion the base style applies, so it is hidden from the first frame.

The veil sits in front of the content, unlike the mist. For 2.2s text under it is lighter. This is the one place the haunt layer can lower contrast, so R9.6 scopes the axe scans to after the veil and the test asserts the veil takes no pointer events and no focus. The skip link and keyboard focus work during the veil (the veil is not in the tab order).

### Document aura
`auraOf(states)` returns `'haunt'` when any state is `disagrees`, else `'unverified'` when any is `unverified`, else `null`. `Paper` sets `data-aura` and nothing else. CSS:
```css
.paper[data-aura=haunt]      { animation: aura-h 2.4s var(--ease-in-out) infinite alternate; }
.paper[data-aura=unverified] { animation: aura-u 3.6s var(--ease-in-out) infinite alternate; }
/* keyframes: from/to shadows exactly as in design/DESIGN.md 3.1 */
```
The specimen card on the empty Inbox is the real `Paper` with `data-aura="haunt"`, so no second implementation. The aura is a shadow on the paper, which sits on the `canvas` and under no pill, so R3.5 holds. The existing paper fog pseudo-element is unchanged.

### Haunted marks
- `StatusPill` gains a `glow` class for the notice-level haunt variant only (`variant="haunt"` and notice level). The class sets the shadow from 3.1 and `animation: pulse-pill 2.4s ... infinite alternate`. The end value of the pulse is a Gap.
- `InboxRow` swaps the kind icon circle from `surface-muted` to `haunt-bg` with `haunt-fg` glyph and the same glow class, only when the notice is haunted.
- No change to pill labels or counts.

### The possessed line
All four effects hang off `.line[data-state=disagrees]`, so the engine state is the only switch and R5.8 follows.
- **Flicker:** `animation: flicker 1.4s steps/ease once, pulse-h 2.4s ... infinite alternate`, with `animation-delay: calc(var(--i) * 80ms)` for the flicker and for the start of `pulse-h` as a second delay `calc(var(--i) * 80ms + 1.4s)`. `--i` is the line index among disagreeing lines, set inline by `HauntedLine`. The existing wake-up stagger is reused for the index.
- **Afterimage:** `HauntedLine` wraps the stated `Figure` in `<span data-possessed>`. CSS: `[data-possessed] .num { animation: afterimage 3.2s ... infinite alternate; color: inherit; }` with the two shadows from 3.1. The tag chip is outside `.num`, so it is not shadowed. `Figure` is not changed.
- **Wisp:** `::after` with a blurred `radial-gradient` of `glow-haunt`, `z-index` below the row content, `animation: wisp 5.6s infinite` rising 28px and fading. The row already uses `::before` for the 3px edge.
- **Materialize:** the recomputed figure span and the two tiles get `.materialize`: `animation: materialize 700ms var(--ease-out) 1.2s both` from opacity 0, `filter: blur(6px)`, `translateY(4px)`. `both` keeps the from-state during the delay. The tiles get the class only when the notice has a possessed line, so an at-peace notice's tiles never animate. Content stays in the DOM, so `getByText` and screen readers see it at once. During the 1.2s delay the figure is at opacity 0; that is the effect, and the tag chip stays visible.

### The exorcism
`DraftWorkspace` already holds the approval state returned by the approval request. It passes `exorcised={approved}` to `HauntClient`. `approved` flips only after the server's 200, which is R6.2 and R6.4: the effect follows the answer. `ApprovalCard` gets a `ring` flag that is set on the transition from not approved to approved after a server answer, never on first render, which covers R6.6. The ring is an absolutely positioned `span` (`data-testid=haunt-ring`, `aria-hidden`, `pointer-events:none`) with `animation: exorcise-ring 900ms var(--ease-out) forwards`, removed on `animationend`. The ring and the mist are not inputs to anything: no handler reads them, and `approval.ts`, the hash and the export route are not touched (R6.7, R10.6).

### Ghost glyph
`GhostGlyph` gets two groups: the body (`ghost-bob 6s ease-in-out infinite`, 2px) and the eyes (`ghost-blink 7s infinite`, scaleY .1 for 120ms, which is about 1.7% of the cycle, so the keyframes hold open until 98.3% and close and reopen inside it). `transform-box: fill-box; transform-origin: center` so the eyes scale in place.

### Reduced motion
One addition to the existing `@media (prefers-reduced-motion: reduce)` block, in `globals.css`, so the block stays the single place:
```css
@media (prefers-reduced-motion: reduce) {
  [data-testid=haunt-veil] { display: none; }
  [data-testid=haunt-fog], [data-testid=haunt-fog] * { animation: none !important; transition: none !important; }
  .paper[data-aura=haunt]      { box-shadow: 0 0 0 1px rgba(232,89,12,.16), 0 0 64px 8px var(--aura-haunt); }
  .paper[data-aura=unverified] { /* the same shape, amber, using --aura-unverified; alpha of the ring from the Gaps list */ }
  [data-possessed] .num { text-shadow: 3px -2px 6px var(--ghost-haunt); }
  .line[data-state=disagrees]::after { display: none; }
  .materialize { opacity: 1; filter: none; transform: none; }
  [data-testid=haunt-ring] { display: none; }
  /* pill and kind icon: the static shadow from 3.1 */
}
```
The block already sets `animation: none !important` and `transition-duration: 0ms !important` for `*`. The rules above set the resting values on top, so there is no flash of animation and `getAnimations()` is empty. The exorcism under reduced motion needs no extra rule: `data-exorcised` makes the layer `opacity: 0` with `transition: none`. The `ApprovalCard` ring is `display: none`, and the unmounted-at-0 rule R1.7 means a level of 0 draws nothing.

`useReducedMotion` is not needed: nothing in this feature uses JavaScript animation. The ring's `animationend` cleanup is a no-op when the ring is `display: none`; a `setTimeout` of 900ms removes it regardless, so the DOM does not keep a stale node.

### Contrast
`mist-veil` composited over `canvas` is a near-white that is lighter than `canvas`, so `ink`, `text-secondary` and `text-muted` only gain contrast on it. `haunting.test.ts` (or `a11y-contrast.test.ts` as a new case, without changing existing ones) composites the token over `canvas` with alpha blending and asserts ≥ 4.5:1 for the three text colours. The mist sits behind all surfaces (`z-index:-1`), so text on `surface` is unaffected. The glows (aura, wisp, pill, kind icon, afterimage) are shadows and never change a fill. The afterimage's glyph colour stays `ink`.

### Gaps in `design/DESIGN.md`
These values are needed by the implementation and are not in 3.1. Task 1 asks for them in `design/DESIGN.md` before any CSS uses them. None is invented in code.
1. `feTurbulence` parameters (baseFrequency, numOctaves, seed), the tile size, and the mask gradient stops for "densest at the bottom".
2. The end frame of the Haunted pill and kind icon pulse (3.1 gives one shadow).
3. The `flicker` keyframe stops (3.1 gives only 1.4s, staggered 80ms, once).
4. The `unverified` aura at rest in reduced motion (3.1 gives the haunt value; the amber ring alpha is not stated).
5. The wisp's gradient size and peak opacity.
6. The ghost glyph's geometry (which part bobs, where the eyes are).
7. Direction of "lifts 12%" (read as up) and "6% lower" (read as down); and whether `materialize`'s 1.2s delay adds the 80ms line stagger (read as no).
The readings in item 7 are used until `DESIGN.md` says otherwise.

## Testing
- Vitest (`[unit]`, `[css]`, `[component]`): `inboxFog`, `auraOf`, `haunting.test.ts` (tokens, keyframes, reduced-motion block, contrast of the mist over canvas), `Haunt.test.tsx`, `Paper.test.tsx`, `HauntedLine.test.tsx`, `StatusPill.test.tsx`, `InboxRow.test.tsx`, `GhostGlyph.test.tsx`, `DraftWorkspace.test.tsx`.
- Playwright (`e2e/haunting.spec.ts`, chromium, fixture mode): first load, reduced motion, the exorcism, axe. Uses the specimens: the Form 29 notice (disagreeing line), the courier invoice (wrong MPF) and a verified specimen state for at peace.
- Animations are checked through `document.getAnimations()` and computed styles, not by sleeping. The e2e waits for `veil-lift` to finish (`animation.finished`) before axe, and reads `getAnimations()` by `animationName` through `CSSAnimation`.
- README screenshots are produced by a script from the running app and checked by a test that the files named in the README exist.
