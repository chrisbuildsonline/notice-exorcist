# Design: haunting-ux

Visual values are quoted from `design/DESIGN.md` 2.1, 2.2, 2.4 and 3.1, which stays the source of truth. This file says where each effect lives in the code that was built and how it is tested. It adds no visual value.

## Layout
New and changed files only.
```
apps/web/
  app/
    layout.tsx                    renders <HauntVeil/> after the page ({children})
    globals.css                   haunt tokens, keyframes, classes, additions to the reduced-motion block
    page.tsx                      Inbox: <Haunt level={inboxFog(kinds)}/>
    notices/[id]/page.tsx         Notice view: <Haunt level={assessment.fog}/>, <Paper aura={auraOf(lines)}/>,
                                  Recomputed and Difference tiles wrapped in .materialize
    reduced-motion.test.ts        (changed) describe 'the haunt layer (DESIGN.md 3.1) stays, still'
    tokens.test.ts                (changed) the new tokens, through the DESIGN.md drop-in
  components/
    Haunt.tsx                     exports Haunt({ level, exorcised }) and HauntVeil
    HauntedLine.tsx               (changed) .possessed on the stated figure, .materialize on the computed one
    HauntedLine.test.tsx          (changed) possessed and materialize only on a disagreeing line
    Paper.tsx                     (changed) .paper class and data-aura
    SpecimenCard                  (changed) data-aura
    StatusPill.tsx                (changed) pill-haunted on the notice-level haunted pill
    InboxRow.tsx                  (changed) kind-haunted on the kind icon
    GhostGlyph.tsx                (changed) g.ghost-body and g.ghost-eyes
    DraftWorkspace.tsx            (changed) <Haunt level={0.6} exorcised={approved}/>, counts accepted approvals
    ApprovalCard.tsx              (changed) ApprovalCheck renders span.exorcise-ring
    SkipLink.test.tsx             (changed) the veil comes after the page
  lib/
    states.ts                     (changed) adds inboxFog(kinds) and auraOf(states)
    states.test.ts                (changed) inboxFog
e2e/
  haunting.spec.ts                first load, reduced motion, exorcism
  reduced-motion.spec.ts          (changed) flicker then pulse names
  a11y.spec.ts                    unchanged; axe on six screens at 1440 and 390
  a11y.ts                         (changed) waits for running animations before axe
  helpers.ts                      (changed) overflow helpers
  inbox.spec.ts, notice-view.spec.ts  (changed) skip elements clipped by an in-viewport overflow-hidden ancestor
README.md                         Screenshots section
docs/screenshots/                 inbox.png notice.png drawer.png exorcise.png (1440), inbox-390.png notice-390.png
```
`inboxFog` and `auraOf` sit in `lib/states.ts` beside `fogOpacity`. Neither is a money figure, so plain number arithmetic is fine. A level is never drawn as text. There is no `HauntClient`, `lib/inbox-fog.ts` or `lib/aura.ts`.

## Key decisions

### One layer, driven by classes and data attributes
All effects are CSS. React sets a few classes and attributes and the stylesheet does the rest, so reduced motion is one media block and `document.getAnimations()` is empty by construction. No JavaScript animation is used.

| Hook | Set by | Used by |
|---|---|---|
| `data-testid=haunt-fog`, `.haunt` | `Haunt` | e2e, the mist layer |
| `style="--haunt: n"` | `Haunt` | mist opacity `0.4 + 0.6 × --haunt` |
| `data-exorcised` | `Haunt` from its `exorcised` prop | the lift |
| `data-testid=haunt-veil`, `.haunt-veil` | `HauntVeil` | e2e, the veil |
| `.paper[data-aura="haunt"\|"unverified"]` | `Paper`, `SpecimenCard` | aura shadow and keyframes |
| `.possessed` on a span around the stated figure | `HauntedLine` | afterimage on `.possessed .num` |
| `.materialize` on a span around the computed figure and on the two tiles | `HauntedLine`, Notice view | materialize |
| `.glow-haunt::after` | existing glow class | ember wisp |
| `.pill-haunted` | `StatusPill`, notice-level haunted pill | pill glow |
| `.kind-haunted` | `InboxRow` | kind icon fill and glow |
| `.exorcise-ring`, `data-testid=exorcise-ring` | `ApprovalCheck` | calm ring |
| `.ghost-body`, `.ghost-eyes` | `GhostGlyph` | bob and blink |

The level is a unitless custom property, not a figure. The test hooks are names, not visual values.

### Tokens and keyframes in `globals.css`
- Tokens: `--mist-veil`, `--mist-shade`, `--aura-haunt`, `--aura-unverified`, `--ghost-haunt`, with the 2.4 values (`tokens.test.ts` reads them through the DESIGN.md drop-in).
- `--noise-a` and `--noise-b` are inline SVG data URIs, each one `feTurbulence` (fractal noise, `stitchTiles="stitch"`) with a colour matrix. They are used as CSS masks, so the wisps take the `--mist-veil` colour.
- `@property --veil-clear` (a percentage) is animated by `veil-lift` so the veil's mask clears as it fades.
- Keyframes: `haunt-flicker`, `afterimage`, `wisp`, `materialize`, `aura-h`, `aura-u`, `pill-h`, `ghost-bob`, `ghost-blink`, `mist-manifest`, `mist-drift-a`, `mist-drift-b`, `exorcise-ring`, `veil-lift`. Their durations follow 3.1 except the three timings listed under "Timings" below.

### `Haunt({ level, exorcised })` and `HauntVeil`
- `Haunt` is a server component with no state. It returns `null` when `level <= 0`, so an at-peace page has no mist node at all (R1.7).
- Markup: a fixed `div.haunt` (`aria-hidden`, `data-testid=haunt-fog`, `--haunt` set to `min(1, level)`, `data-exorcised` when the prop is true) with two children, `.haunt-mist` and `.haunt-mist.haunt-mist-b`. The tiles use `--noise-a` and `--noise-b` as masks and drift with `mist-drift-a` and `mist-drift-b` (opposite directions). The `mist-shade` gutters are drawn by the same layer at 1280px and wider. The layer enters with `mist-manifest`.
- Opacity is `0.4 + 0.6 × --haunt`. A level that changes while the page is open only changes the property.
- `HauntVeil` is a `div.haunt-veil` (`aria-hidden`, `data-testid=haunt-veil`) with no content. `layout.tsx` renders it after `{children}`. The root layout is not remounted by client routing, so the CSS animation runs once per full load without JavaScript.
- There is no client wrapper. The mist follows live state only where its host does. On Exorcise that host is `DraftWorkspace`, which is already a client component.

### Levels per screen
| Screen | Level | Source |
|---|---|---|
| Notice view | fog value of the notice | `assessment.fog` |
| Inbox with notices | `inboxFog(kinds)` | notice-level kinds |
| Inbox empty | 0.6 | `inboxFog([])` |
| Inbox, none haunted or unverified | 0 | `inboxFog` |
| Exorcise, draft | 0.6 | `DraftWorkspace` |
| Exorcise, approved | `exorcised` set | `DraftWorkspace`, `approved` |

`inboxFog(kinds)` takes the notice-level kinds (the `NoticeStatus` kinds plus `reading` and `failed`). It returns `0.6` for an empty list, `0` when no notice is `haunted` or `unverified`, otherwise `0.15 + 0.85 × (haunted + unverified) / kinds.length`. Every other kind counts in the denominator only.

### First-load veil
The veil sits in front of the content, unlike the mist. `veil-lift` runs 1.6s with `ease-out` and no hold, and the element is hidden at rest. It takes no pointer events and no focus, and it is not in the tab order. Because it comes after the page in the DOM, the skip link stays the first tab stop (`SkipLink.test.tsx`). Under reduced motion it is hidden from the first frame. A fast click works while it plays: the figures are readable within 0.5s and the veil is below 0.4 opacity by then (`haunting.spec.ts`).

### Document aura
`auraOf(states)` returns `'haunt'` when any state is `disagrees`, else `'unverified'` when any is `unverified`, else `null`. `Paper` sets the `.paper` class and `data-aura`. The Notice view passes `auraOf(lines)`. `SpecimenCard` sets `data-aura` directly, so the empty-Inbox card uses the same CSS. `.paper[data-aura=haunt]` uses `aura-h` and `.paper[data-aura=unverified]` uses `aura-u`, with the shadows from 3.1. The aura is a shadow on the paper and never changes its fill.

### Haunted marks
- `StatusPill` adds `pill-haunted` to the notice-level haunted pill only. Its word, icon and count are unchanged.
- `InboxRow` adds `kind-haunted` to the kind icon of a haunted notice.

### The possessed line
The engine state is the only switch.
- **Flicker:** `.glow-haunt` runs `haunt-flicker 1.4s` once, then `pulse-h`. `HauntedLine` sets the animation-delay pair per line (flicker delay, and the same delay plus the flicker length for `pulse-h`), so lines stagger.
- **Afterimage:** `HauntedLine` wraps the stated figure of a disagreeing line in `span.possessed`. `.possessed .num` runs `afterimage` with the two shadows from 3.1. The glyph colour stays `ink`.
- **Wisp:** `.glow-haunt::after` is a blurred radial gradient of `--glow-haunt` that rises and fades with `wisp`.
- **Materialize:** `HauntedLine` wraps the computed figure of a disagreeing line in `span.materialize`. The Notice view wraps the Recomputed and Difference tiles in `.materialize`. `materialize` runs 360ms after a 120ms delay, so the figures are readable by 480ms. The content is in the DOM from the first render. Only the look animates.

### The exorcism
`DraftWorkspace` renders `<Haunt level={0.6} exorcised={approved}/>`. `approved` flips only after the server accepts the approval, so the effect follows the answer, not the click. `DraftWorkspace` counts accepted approvals and passes the count down, and `ApprovalCheck` in `ApprovalCard.tsx` renders `span.exorcise-ring` (`data-testid=exorcise-ring`, `aria-hidden`) once per accepted approval, never on first render. A page loaded already approved draws no ring. Unticking or an edit clears the approval, which removes `data-exorcised` and brings the mist back. The ring and the mist are not inputs to anything. `approval.ts`, the hash and the export route are untouched.

### Ghost glyph
`GhostGlyph` has `g.ghost-body` (bobs with `ghost-bob`) and `g.ghost-eyes` (blinks with `ghost-blink`). The glyph stays `aria-hidden` line art.

### Timings
Three timings differ from the first draft of this spec and from 3.1 as first read. They are the built values.
- `materialize`: 360ms after a 120ms delay (figures readable by 480ms).
- `veil-lift`: 1.6s, `ease-out`, no hold.
- Flicker: 1.4s, then `pulse-h`.

### Reduced motion
The additions sit in the existing `@media (prefers-reduced-motion: reduce)` block in `globals.css`, so it stays the single place. Under it: the aura is static, the afterimage is static, the veil and the wisp are hidden, the mist and the materializing figures are at rest, and the ring is not drawn. `document.getAnimations()` is empty. The exorcism is instant: the mist goes straight to its exorcised state with no ring.

### Contrast and accessibility
The mist sits behind all surfaces and is lighter than `canvas`. The glows are shadows and never change a fill. Every haunt element is `aria-hidden`, an attribute or a pseudo-element. Axe runs on `inbox-empty`, `inbox-list`, `notice-view`, `calc-drawer-open`, `exorcise-draft` and `exorcise-approved` at 1440 and 390 in the unchanged `e2e/a11y.spec.ts`. `e2e/a11y.ts` waits for running animations to finish before axe, so the veil and the entrances do not affect the scan.

### Not built
- No night or dark mode. `design/DESIGN.md` rules out dark and black/orange themes.
- No separate `auraOf` unit test.
- No component tests for `Haunt`, `Paper`, `StatusPill`, `InboxRow`, `GhostGlyph` or `DraftWorkspace`.
- No stubbed-403 exorcism test.
- No `haunting.test.ts`: tokens are covered by `tokens.test.ts` and reduced motion by `reduced-motion.test.ts`. The contrast of the mist over `canvas` has no test of its own.

## Testing
- Vitest: `apps/web/lib/states.test.ts` (`inboxFog`), `apps/web/app/reduced-motion.test.ts` (the haunt layer stays, still), `apps/web/app/tokens.test.ts` (the new tokens), `apps/web/components/HauntedLine.test.tsx` (possessed and materialize only on `disagrees`), `apps/web/components/SkipLink.test.tsx` (veil after the page).
- Playwright (chromium, fixture mode): `e2e/haunting.spec.ts`, `e2e/reduced-motion.spec.ts`, `e2e/a11y.spec.ts`, plus `e2e/inbox.spec.ts` and `e2e/notice-view.spec.ts` with the overflow helpers from `e2e/helpers.ts`.
- Animations are checked through `document.getAnimations()` and computed styles, not by sleeping.
- README screenshots in `docs/screenshots/` were taken by hand. There is no screenshot script and no test that checks the files.
