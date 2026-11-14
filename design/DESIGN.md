# Notice Exorcist: design system (F1)

The source of truth for every visual value in `apps/web`. If a value is not here, do not invent one; add it here first.

## 1. Principles

1. **A finance product that happens to be haunted.** It should read like current fintech or document-review work (refs 02, 04, 05). The haunting shows up in three places only: the **glow** on uncertain lines, the **fog** over a document that isn't verified yet, and the **copy** in headings and notice-level states.
2. **One thing first.** Every screen opens with a title, a status, or the one primary action. Nothing comes before them.
3. **Numbers are the heroes, and every number names its source.** Figures are large, tabular, and always tagged `stated`, `computed` or `tariff` (`no-model-math.md`). A number with no source is never drawn.
4. **Calm is the goal.** Verifying a line removes colour. A finished notice is mostly white and grey.
5. **Nothing leaves without approval.** The export control looks and is disabled until the user approves the exact text (`approval-gate.md`).

**Spooky budget. These are allowed:**
- glow, fog and the "calming" transition
- a small ghost glyph in the logo and the empty-state visual
- the words *haunted*, *at peace*, *exorcise* in page titles, notice-level pills and empty states

**Never:**
- black/orange page themes, bats, drips, cobwebs or decorative display fonts
- spooky words on line-level, calculation or legal text. Those stay literal ("Disagrees", "Mismatch", "Not legal advice").

**Conflicts with `.kiro/steering` (the hard rules win):**
- `design-spooky.md` says the accent is "used for the glow". Here the accent is only for links, selection, focus and charts. Glows use the **status** hues.
- `design-spooky.md` lists 5 pill states. This system has 7: it adds `needs-confirmation` and `unsupported`.
- `approval-gate.md` says approval is an "Approve button click". Here it is an **explicit approval checkbox-card** labelled "I approve this exact draft". It is unchecked by default and bound to the content hash. It counts as the explicit user action, and the gate's server rules still apply in full.

## 2. Tokens

### 2.1 Colour (contrast ratios are WCAG 2.x, computed)

| Token | Value | Use | Contrast |
|---|---|---|---|
| `canvas` | `#eef0f4` | page background, never a card | - |
| `surface` | `#ffffff` | floating cards, document paper, panels | - |
| `surface-muted` | `#f6f7f9` | wells inside a surface: formula block, table header, row hover | - |
| `line` | `#e6e8ee` | hairline dividers **inside** a surface only | - |
| `ink` | `#14161c` | primary text, primary pill fill | 17.9 on white |
| `ink-hover` | `#2a2d36` | primary pill hover | - |
| `text-secondary` | `#4a5060` | body copy, labels | 8.0 white / 7.1 canvas |
| `text-muted` | `#646a79` | captions, timestamps, meta | 5.4 white / 4.7 canvas |
| `disabled-bg` / `disabled-fg` | `#e6e8ee` / `#8a90a0` | disabled controls (exempt from AA; always paired with muted helper text) | - |
| **`accent`** | `#5b3df5` ("séance violet") | links, selection, focus ring, chart series, citation chips | 6.1 white / 5.4 canvas; white on accent 6.1 |
| `accent-700` | `#4527d6` | link hover / pressed | - |
| `accent-200` | `#cfc6ff` | second chart series, selected-row edge | - |
| `accent-50` | `#f1eeff` | selected-row fill, citation chip fill | - |

**Status hues.** These are not accents. Each has `-fg` (text/icon), `-bg` (pill/row tint), `-edge` (3px bar, ≥3:1 on white) and `-glow` (decorative shadow).

| Status | Meaning | fg | bg | edge | glow | fg on bg |
|---|---|---|---|---|---|---|
| `haunt` (disagrees) | notice ≠ recomputation | `#b4350a` | `#fff1ea` | `#e8590c` (3.6) | `rgba(232,89,12,.30)` | 5.5 |
| `unverified` | not yet checked against the engine/tariff | `#8a5300` | `#fff6e0` | `#b87d00` (3.5) | `rgba(245,179,0,.28)` | 5.9 |
| `calm` (verified/approved) | stated = computed | `#15693d` | `#e8f6ee` | `#2f9e5e` (3.4) | `rgba(47,158,94,.22)` | 6.0 |
| `confirm` (needs confirmation) | low-confidence read; user must confirm | `#1f5296` | `#e8f0fc` | `#3b7ddd` (4.1) | none | 6.8 |
| `unsupported` | fee type the engine can't check (e.g. AD/CVD) | `#4a5060` | `#eceef3` | `#8a90a0` dashed (3.2) | none | 7.0 |
| `draft` | reply not approved | `#4a5060` | `#eceef3` | - | none | 7.0 |

**How this fits "one accent".**
- Violet is the only colour that means "you can act on this or it is selected". Status hues appear **only** as pills, row tints, 3px edges, glows and status icons.
- A status hue is never on a link, a button, a chart series or the focus ring.
- Buttons are ink, white or ghost. Never green or orange (unlike ref 05's coloured CTAs).
- Status is never colour alone: every tint comes with a label and an icon (`!` haunt, `?` unverified, `✓` calm, `◐` confirm, `⊘` unsupported).

### 2.2 Radius, shadow, spacing, motion

- **Radius:** `xs 6` (inner chips) · `sm 10` (inputs, rows) · `md 14` (wells, dropzone) · `lg 18` (**all floating surfaces**) · `xl 24` (drawer, mobile sheet, app frame) · `pill 9999`.
- **Shadows** (cool ink, never pure black):
  - `float`: `0 1px 2px rgba(20,22,28,.04), 0 8px 24px -6px rgba(20,22,28,.08)`. Every card on the canvas.
  - `raised`: `0 2px 4px rgba(20,22,28,.05), 0 16px 40px -12px rgba(20,22,28,.14)`. Hover, sticky panel.
  - `overlay`: `0 24px 64px -16px rgba(20,22,28,.28)`. Drawer, sheet, toast, popover.
  - `pill`: `inset 0 1px 0 rgba(255,255,255,.10), 0 6px 16px -6px rgba(20,22,28,.45)`. Primary pill.
- **Spacing** (4px base): `1=4 2=8 3=12 4=16 5=20 6=24 8=32 10=40 12=48 16=64 20=80`.
  - Card padding: 24 desktop, 20 phone.
  - Between cards: 24 / 16.
  - **Between sections: 48 desktop, 32 phone.**
  - Page gutter: 32 / 16. Max content width: 1200.
- **Breakpoints:** phone `<768`, tablet `768–1023` (side panel becomes a drawer), desktop `≥1024`.
- **Motion:**
  - easings: `ease-out cubic-bezier(.2,.8,.2,1)`, `ease-in-out cubic-bezier(.65,0,.35,1)`
  - durations: `fast 120ms` (hover), `base 200ms` (state), `slow 320ms` (drawer/sheet), `calm 900ms`, `pulse-haunt 2.4s`, `pulse-unverified 3.6s`, `fog-drift 40s`

### 2.3 Type

- **Families** (Google Fonts via `next/font/google`): **Geist** for UI and numbers. **Geist Mono** for HTS codes, entry numbers, formulas, rate text and content hashes.
- **Fallbacks:** `ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif` and `ui-monospace, "SF Mono", Menlo, monospace`.
- **Money and figures:** always `font-variant-numeric: tabular-nums` (class `num`).
  - Money is always shown to 2 decimals with `$` and comma grouping.
  - Negatives use a true minus `−`.
  - Rate text is quoted verbatim from the tariff (e.g. `6.5%`, `Free`, `2.4¢/kg + 5%`) and never reformatted.

| Role | Desktop size/line, weight, tracking | Phone |
|---|---|---|
| `display` (amount at stake, hero) | 56/60, 600, -0.03em | 40/44 |
| `title` (page h1) | 32/38, 600, -0.02em | 28/34 |
| `heading` (card/section) | 20/28, 600, -0.01em | 18/26 |
| `number-lg` (figure tiles) | 36/40, 600, -0.02em, tnum | 32/36 |
| `number` (rows, panel) | 17/24, 600, tnum | 17/24 |
| `body` | 15/24, 400 (500 for emphasis) | **16/24** (avoids iOS zoom) |
| `caption` | 13/18, 500, `text-muted` | 13/18 |
| `label` (micro, ref 03) | 11/16, 600, +0.06em, uppercase, `text-muted` | same |
| `mono` | 13/20, Geist Mono 500, tnum | 14/20 |

### 2.4 Drop-in code

```css
/* app/globals.css: also valid as a Tailwind v4 @theme block */
:root {
  --color-canvas:#eef0f4; --color-surface:#fff; --color-surface-muted:#f6f7f9; --color-line:#e6e8ee;
  --color-ink:#14161c; --color-ink-hover:#2a2d36; --color-text-secondary:#4a5060; --color-text-muted:#646a79;
  --color-disabled-bg:#e6e8ee; --color-disabled-fg:#8a90a0;
  --color-accent:#5b3df5; --color-accent-700:#4527d6; --color-accent-200:#cfc6ff; --color-accent-50:#f1eeff;
  --color-haunt-fg:#b4350a; --color-haunt-bg:#fff1ea; --color-haunt-edge:#e8590c; --glow-haunt:rgba(232,89,12,.30);
  --color-unverified-fg:#8a5300; --color-unverified-bg:#fff6e0; --color-unverified-edge:#b87d00; --glow-unverified:rgba(245,179,0,.28);
  --color-calm-fg:#15693d; --color-calm-bg:#e8f6ee; --color-calm-edge:#2f9e5e; --glow-calm:rgba(47,158,94,.22);
  --color-confirm-fg:#1f5296; --color-confirm-bg:#e8f0fc; --color-confirm-edge:#3b7ddd;
  --color-unsupported-fg:#4a5060; --color-unsupported-bg:#eceef3; --color-unsupported-edge:#8a90a0;
  --radius-xs:6px; --radius-sm:10px; --radius-md:14px; --radius-lg:18px; --radius-xl:24px;
  --shadow-float:0 1px 2px rgba(20,22,28,.04),0 8px 24px -6px rgba(20,22,28,.08);
  --shadow-raised:0 2px 4px rgba(20,22,28,.05),0 16px 40px -12px rgba(20,22,28,.14);
  --shadow-overlay:0 24px 64px -16px rgba(20,22,28,.28);
  --shadow-pill:inset 0 1px 0 rgba(255,255,255,.10),0 6px 16px -6px rgba(20,22,28,.45);
  --ease-out:cubic-bezier(.2,.8,.2,1); --ease-in-out:cubic-bezier(.65,0,.35,1);
}
body { background:var(--color-canvas); color:var(--color-ink); font-family:var(--font-geist),ui-sans-serif,system-ui,sans-serif; }
.num { font-variant-numeric:tabular-nums; }
:focus-visible { outline:2px solid var(--color-accent); outline-offset:2px; border-radius:inherit; }
```

```ts
// tailwind.config.ts (v3). In v4 the CSS block above generates the same utilities.
const v = (n: string) => `var(--${n})`;
export default { theme: { extend: {
  colors: {
    canvas: v('color-canvas'), surface: { DEFAULT: v('color-surface'), muted: v('color-surface-muted') },
    line: v('color-line'), ink: { DEFAULT: v('color-ink'), hover: v('color-ink-hover') },
    'text-secondary': v('color-text-secondary'), 'text-muted': v('color-text-muted'),
    accent: { DEFAULT: v('color-accent'), 700: v('color-accent-700'), 200: v('color-accent-200'), 50: v('color-accent-50') },
    ...Object.fromEntries(['haunt','unverified','calm','confirm','unsupported'].map(s =>
      [s, { fg: v(`color-${s}-fg`), bg: v(`color-${s}-bg`), edge: v(`color-${s}-edge`) }])),
  },
  borderRadius: { xs:'6px', sm:'10px', md:'14px', lg:'18px', xl:'24px' },
  boxShadow: { float: v('shadow-float'), raised: v('shadow-raised'), overlay: v('shadow-overlay'), pill: v('shadow-pill') },
  fontFamily: { sans: ['var(--font-geist)','ui-sans-serif','system-ui'], mono: ['var(--font-geist-mono)','ui-monospace'] },
  fontSize: {
    display: ['56px', { lineHeight:'60px', letterSpacing:'-0.03em', fontWeight:'600' }],
    title:   ['32px', { lineHeight:'38px', letterSpacing:'-0.02em', fontWeight:'600' }],
    heading: ['20px', { lineHeight:'28px', letterSpacing:'-0.01em', fontWeight:'600' }],
    'number-lg': ['36px', { lineHeight:'40px', letterSpacing:'-0.02em', fontWeight:'600' }],
    number:  ['17px', { lineHeight:'24px', fontWeight:'600' }],
    body:    ['15px', { lineHeight:'24px' }], caption: ['13px', { lineHeight:'18px', fontWeight:'500' }],
    label:   ['11px', { lineHeight:'16px', letterSpacing:'0.06em', fontWeight:'600' }],
    mono:    ['13px', { lineHeight:'20px', fontWeight:'500' }],
  },
  transitionTimingFunction: { out: 'cubic-bezier(.2,.8,.2,1)', 'in-out': 'cubic-bezier(.65,0,.35,1)' },
}}};
```

## 3. The haunted document

The notice is drawn as **paper**: a `surface` card, radius `lg`, shadow `float`, inner padding 32. Each extracted line is a row (min-height 56, radius `sm`, padding 12/16). A line's state comes from engine data, never from the model.

```css
.line            { position:relative; transition:background-color 300ms var(--ease-out), box-shadow 400ms var(--ease-out); }
.line::before    { content:""; position:absolute; inset:8px auto 8px 0; width:3px; border-radius:3px; background:transparent; }
.line[data-state=unverified] { background:var(--color-unverified-bg); animation:pulse-u 3.6s var(--ease-in-out) infinite alternate; }
.line[data-state=unverified]::before { background:var(--color-unverified-edge); }
.line[data-state=disagrees]  { background:var(--color-haunt-bg); animation:pulse-h 2.4s var(--ease-in-out) infinite alternate; }
.line[data-state=disagrees]::before  { background:var(--color-haunt-edge); }
@keyframes pulse-u { from { box-shadow:0 0 0 1px rgba(184,125,0,.18), 0 0 8px 0 var(--glow-unverified); }
                     to   { box-shadow:0 0 0 1px rgba(184,125,0,.30), 0 0 18px 2px var(--glow-unverified); } }
@keyframes pulse-h { from { box-shadow:0 0 0 1px rgba(232,89,12,.30), 0 0 12px 1px var(--glow-haunt); }
                     to   { box-shadow:0 0 0 2px rgba(232,89,12,.45), 0 0 28px 6px var(--glow-haunt); } }
```

- **Unverified** is soft and slow: an amber tint, a thin halo and a 3.6s breath, with a `? Unverified` pill.
- **Disagrees** is stronger and faster: an ember tint, a 2px ring, a wider halo and a 2.4s breath, with a `! Disagrees` pill. The stated and computed figures are shown side by side on the row. The mismatch is never overwritten.
- **Needs confirmation:** blue tint, `◐ Confirm` pill, **no glow**. It is a question, not a ghost.
- **Unsupported:** dashed `unsupported-edge` bar, `⊘ Not checked` pill, no glow.
- **Wake-up:** on first render, glows start staggered 80ms per line, once.
- **Fog:** a pseudo-element over the paper.
  - Style: `radial-gradient(70% 50% at 20% 0%, rgba(138,144,160,.16), transparent 70%), radial-gradient(60% 40% at 90% 100%, rgba(138,144,160,.12), transparent 70%)`
  - It drifts 3% on `background-position` over 40s.
  - `opacity = 0.15 + 0.85 × (unverified + disagreeing) / total lines`, transitioned over 900ms.
  - It is neutral grey (never accent) and sits **behind** row text (`z-index` below rows), so it never lowers text contrast.
  - When all lines are calm, the fog is gone and the title pill reads `✓ At peace`.
- **Calming** (a line becomes verified):
  - 0ms: the pulse stops and the glow eases to `0 0 0 4px var(--glow-calm)` over 400ms. The tint crossfades to `calm-bg` over 300ms and the pill crossfades to `✓ Verified` over 200ms.
  - 1200ms: the tint and glow fade to transparent over 900ms. Only the small Verified pill remains.
- **Reduced motion** (`@media (prefers-reduced-motion: reduce)`):
  - All animations are `none` and transitions are 0ms.
  - The glow stays **static**: unverified is `0 0 0 1px` edge plus `0 0 12px var(--glow-unverified)`; disagrees is `0 0 0 2px` edge plus `0 0 20px var(--glow-haunt)`.
  - Fog is static at its computed opacity. Calming is instant, straight to the final state.
  - Drawers and sheets appear without sliding.
- **AA:** every tinted row keeps `ink` text (≥15:1 on any status bg). Pill fg on bg is ≥5.5:1. Edges are ≥3:1 on white. Glows are decorative and never carry meaning alone.

## 4. Components

- **Primary pill**
  - `bg-ink text-white rounded-full shadow-pill`, height 52 (desktop) / 56 (phone), padding-x 24, `body` 500, optional 18px leading icon.
  - Hover `ink-hover` with translateY(-1px) over 120ms. Pressed: scale .98.
  - **Max one per screen**, top-right of the page header (desktop) or a sticky thumb bar (phone).
  - Disabled: `disabled-bg/fg`, no shadow, `aria-disabled` plus helper text explaining why.
- **Secondary / ghost**
  - Secondary: white, radius pill, height 44, shadow `float`, `text-secondary` (ref 02's "Send Money").
  - Ghost: no fill, `text-secondary`, `surface-muted` on hover.
  - Text links are `accent` with underline on hover.
  - Min target 44×44 everywhere.
- **Status pill:** height 24, px 10, `rounded-full`, `label`-sized text but sentence case at 12/16 600, 12px icon plus a word, status bg/fg, no border.
  - Line level: Disagrees, Unverified, Verified, Confirm, Not checked.
  - Notice level: `! Haunted · 2`, `? Unverified`, `✓ At peace`.
  - Draft level: Draft, `✓ Approved`.
- **Inbox list row**
  - Layout: 40px kind icon in a `surface-muted` circle; title `body` 500 (e.g. "CBP Form 29 · Notice of Action"); a short line in `caption`; right-aligned `<Figure>` amount at stake; status pill; time in `caption`.
  - Height 72. Rows are separated by `line` hairlines inside **one** surface, never separate bordered boxes. Hover: `surface-muted`, radius `sm`.
- **`<Figure value prov size>`**
  - `prov` is required: `stated | computed | tariff`, plus `source`. The number is drawn in `.num`.
  - The provenance tag is a tiny chip right after the number: 11/16 600 lowercase word (`stated` / `computed` / `tariff`), `surface-muted` bg, `text-secondary`.
  - Tapping the tag opens a popover with the source: notice page and box, engine formula id, or HTS edition/revision.
  - **Unsourced:** if `prov` is missing, the value is **not rendered**. It shows `—` plus a `⊘ Unsourced` pill in unsupported style. In dev/test it throws so the test fails.
- **Side panel** (Notice view, desktop): a `surface` card, radius `lg`, `raised`, sticky at top 24, width 5/12, scrolls internally. Sections are separated by 32 space, not borders.
- **Drawer:** from the right, 560px, radius `xl` on the left corners, `overlay`, scrim `rgba(20,22,28,.24)`. Slides 320ms `ease-out`. Esc and scrim click close it, focus is trapped, and focus returns to the trigger. On phone it is a bottom sheet with radius `xl` on top, max 92vh, and a drag handle (36×4, `line`).
- **Draft block** (Exorcise)
  - A paragraph on the paper surface. Hover/focus shows a `surface-muted` fill and an edit caret.
  - Contenteditable is plain text only.
  - Citation chips `[1]` are 20px high, `accent-50` bg, `accent` text, and link to the sources list (HTS line, CROSS ruling number, notice box).
  - A figure inside the prose must be a `<Figure>` token, not typed text.
- **Approval card**
  - A full-width checkbox-card: 24px box, radius `xs`, `ink` check. Label "I approve this exact draft". Sub-line in mono: `sha256 9f3c…a1 · 3 paragraphs · 4 citations`.
  - Unchecked by default. Checking it records approval for the current hash.
  - Below it: `Export PDF` primary pill, disabled until approved, with helper text "Approve the draft to export".
  - Any edit unchecks the box, flips the pill back to `Draft`, and shows a toast.
- **Empty state:** centred within the list surface. A 96px line-art ghost-in-document glyph (ink 1.5px stroke, no fill colour), a `heading`, one `body` line, and one action.
- **Upload dropzone**
  - `surface-muted`, radius `md`, 1.5px dashed `#c9cdd6`, min-height 160. Icon plus "Drop a PDF or photo" plus `caption` "or browse".
  - Drag-over: `accent-50` fill and a solid `accent` border.
  - Below it: the forward address in mono, e.g. `notices+abc@in.noticeexorcist.app`, with a Copy ghost button.
- **Toast:** bottom-centre (phone: above the thumb bar). `ink` bg, white text, radius `md`, `overlay`, max 420px. Slides up 12px and fades in over 200ms. Auto-dismiss after 5s, except errors and "approval cleared", which stay until dismissed. `role=status`.

## 5. Screens

### 5.1 Inbox (first screen)

```
 ◐ Notice Exorcist                                                  (avatar)   ← 64px bar on canvas, no fill
 Inbox                                                       ( ⇪ Upload a notice )   ← title + the one pill
 $1,284.60 computed                                                                  ← display, <Figure>
 at stake across 2 haunted notices · 1 at peace                                      ← caption
┌──────────────────────────────────────────────────────────┐ ┌──────────────────────────┐
│ Notices                                       All ▾      │ │ Add a notice             │
│ (◫) CBP Form 29 · Notice of Action    $852.25 computed   │ │ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│     Rate advance on 2 lines · Entry …4501  [!Haunted·2] 2h│ │   Drop a PDF or photo    │
│ ──────────────────────────────────────────────────────── │ │ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
│ (✉) DHL duty invoice                  $432.35 computed   │ │ Or forward the email to  │
│     Duty and brokerage, 4 lines      [?Unverified]   1d  │ │ notices+abc@in…  [Copy]  │
│ ──────────────────────────────────────────────────────── │ │                          │
│ (◫) CBP Form 28 · Request for information        —      │ │ No notice yet?           │
│     Asks for mug material and invoice  [✓At peace]   5d  │ │ Try a specimen →         │
└──────────────────────────────────────────────────────────┘ └──────────────────────────┘
   8 cols, one surface                                            4 cols
```

- **Empty state** (this is also the marketing hero, since there is no separate landing page):
  - One headline: "Exorcise your customs notice".
  - One supporting line: "Forward or upload a CBP Form 28, 29 or courier duty invoice. We check every figure and draft a cited reply you approve."
  - One action: the **Try a specimen** primary pill.
  - One strong visual: a live specimen notice card tilted at 2° with two glowing lines (the real component).
  - The dropzone and forward address sit below, as secondary.
- **Phone:** title, display number and caption first. Rows are full-width inside one surface: icon, title, short line plus time; the amount and pill stack on the right. The sticky bottom pill is `Upload a notice`. The "Add a notice" card moves below the list.

### 5.2 Notice view

```
 ← Inbox
 CBP Form 29 · Notice of Action   [! Haunted · 2]                ( Exorcise this notice )
 Entry 123-4567890-1 · received 12 Nov · respond by 10 Dec            (mono / caption)
┌ NOTICE SAYS ────────────┬ RECOMPUTED ─────────────┬ DIFFERENCE ────────────┐  one surface,
│ $4,812.40 stated        │ $3,960.15 computed      │ $852.25 computed       │  label + number-lg
└─────────────────────────┴─────────────────────────┴────────────────────────┘
┌ paper (7 cols) ░fog░ ───────────────────────┐ ┌ Line 3  [! Disagrees] (5 cols, sticky) ┐
│ 1 Ceramic mugs, 240 pcs   $1,204.00 [✓]     │ │ What this means                        │
│ 2 Steel trivets  ▒amber glow▒ [? Unverified]│ │ "CBP moved this line to a 6.5% code.   │
│ 3 Mug lids  ▓ember glow▓ $612.00→$64.80 [!] │ │  At 6.5% the duty is far lower…"       │
│ 4 MPF                     $31.67  [✓]       │ │ Notice $612.00 stated · Ours $64.80 c. │
│ 5 AD/CVD deposit  ┆ [⊘ Not checked]         │ │ See the math →          (accent link)  │
│                                             │ │ CANDIDATE HTS CODES                    │
│                     View original scan ↗    │ │ 6912.00.48  Free  · tariff  [cite]     │
└─────────────────────────────────────────────┘ │ 3924.10.40  3.4%  · tariff  [cite]     │
                                                │ CROSS RULINGS                          │
                                                │ N312345 · 2020 · "ceramic lids…" ↗    │
                                                └────────────────────────────────────────┘
```

- The selected line gets an `accent-200` 2px outline (selection = accent).
- HTS codes carry the caption "Candidates, not a final classification".
- **Phone:** one job per screen.
  1. Title, status pill and the three summary figures as a vertical stack.
  2. The haunted line list (full width, glows intact).
  3. Tap a line to open a full-screen line view (back arrow, explanation, figures, HTS, rulings). "See the math" opens a bottom sheet.
  - The sticky thumb pill is `Exorcise this notice`.

### 5.3 Calculation drawer

```
                                         ┌──────────────────────────────── ✕ ┐
                                         │ How line 3 was computed            │
                                         │ [! Mismatch]                       │
                                         │ ┌ surface-muted, mono ───────────┐ │
                                         │ │ duty = entered value × rate     │ │
                                         │ │      = $996.92 stated × 6.5%    │ │
                                         │ │      = $64.80 computed          │ │
                                         │ │ rounding: half-up to cents, once│ │
                                         │ └─────────────────────────────────┘ │
                                         │ RATE TEXT  "6.5%"  HTS 6912.00.48  │
                                         │ Source: USITC HTS 2026 Basic Ed. ↗ │
                                         │ NOTICE SAYS        RECOMPUTED       │
                                         │ $612.00 stated     $64.80 computed  │
                                         │ Difference $547.20 computed         │
                                         │ caption: Computed by duty-engine,   │
                                         │ not by the AI model.                │
                                         └────────────────────────────────────┘
```

- `Match` uses the calm pill and `Mismatch` the haunt pill. This is a reading surface, so it has **no** primary pill.
- On phone it is the same content in a bottom sheet.

### 5.4 Exorcise (draft, approve, export)

```
 Exorcise the notice   [Draft]                                     (Export PDF ⃠ disabled)
 Reply to CBP Form 29 · Entry 123-4567890-1
┌ paper (8 cols) ─────────────────────────────────────┐ ┌ Approve (4 cols, sticky) ────┐
│ Dear Officer …                                       │ │ You are approving            │
│ ┊ At the 6.5% rate for 6912.00.48 [1], duty on     │ │ sha256 9f3c…a1 · 4 citations │
│ ┊ line 3 is $64.80 computed, not $612.00 [2] …      │ │ ┌──────────────────────────┐ │
│ ┊ (hover = editable block)                          │ │ │ ☐ I approve this exact   │ │
│ SOURCES  [1] HTS 2026 6912.00.48 ↗ [2] N312345 ↗    │ │ │   draft                  │ │
│ Not legal advice. Draft only, never filed.          │ │ └──────────────────────────┘ │
└──────────────────────────────────────────────────────┘ │ Approve the draft to export  │
                                                         └──────────────────────────────┘
```

- The single primary pill (`Export PDF`) sits in the header. It is disabled until approved.
- After approval: the pill becomes `✓ Approved` and the export pill is enabled.
- **Phone:** the draft blocks are full width. The sticky bottom stack holds the checkbox row (56px) above the `Export PDF` pill (56px), both in thumb reach.

### 5.5 PDF export (print)

- **Page:** Letter by default, A4 as an option, 0.75in margins.
- **Type:** Geist 10.5/15, headings 14 and 18, Geist Mono 9.5 for codes and formulas, tabular numbers.
- **Colour:** black and greys only, with no glows or tints. Status appears as words in brackets (`[Mismatch]`).

```
┌──────────────────────────────────────────────┐
│ Response to CBP Form 29 · Entry 123-4567890-1│  18pt
│ Prepared by <importer> · 14 Nov 2026         │
│ ──────────────────────────────────────────── │
│ <approved draft text with [1] footnotes>     │
│ ──────────────────────────────────────────── │
│ Calculation trail                            │  table: line · formula · inputs (source)
│ 3  value × rate  $996.92(stated) × 6.5%      │  · rate text + HTS edition · notice vs
│    (tariff, HTS 2026 Basic) = $64.80 [Mism.] │  recomputed · rounding rule
│ Sources  [1] … [2] CROSS N312345 …           │
│ ──────────────────────────────────────────── │
│ Not legal advice. Draft only, never filed by │  footer on EVERY page + page x/y
│ Notice Exorcist. Approved hash 9f3c…a1       │  + approval hash
└──────────────────────────────────────────────┘
```

## 6. Not done if…

Use this checklist against screenshots.

**Canvas and surfaces**
- [ ] The page background is not `#eef0f4`.
- [ ] A white card sits on a white page, or cards are drawn with borders instead of shadow `float`.
- [ ] A surface radius is outside 16–20px.

**Actions and colour**
- [ ] A screen has more than one near-black pill. A primary action is green, orange or violet.
- [ ] The violet accent appears on a glow, a status pill or a button fill.
- [ ] A status hue appears on a link or a chart series.

**Layout and hierarchy**
- [ ] The first thing on a screen is not a title, a status or the one primary action.
- [ ] Sections are under 48px apart on desktop (32px on phone).
- [ ] A list row has no kind/title, short line or time, or reads as equal-weight text.

**Status**
- [ ] Any status is shown by colour alone, with no word or icon.

**Figures**
- [ ] Any figure lacks a `stated` / `computed` / `tariff` tag.
- [ ] A figure without provenance renders a number.
- [ ] Money is not tabular, or does not show 2 decimals.

**Haunted document**
- [ ] Disagreeing and unverified lines look the same.
- [ ] A verified line still glows.
- [ ] The fog covers text contrast.
- [ ] With reduced motion on, anything pulses or slides, or the glow disappears instead of going static.

**Approval and export**
- [ ] `Export PDF` is clickable before approval, or after an edit to an approved draft.
- [ ] The PDF lacks the "Not legal advice. Draft only, never filed" footer on every page, the calculation trail, or citations.

**Phone**
- [ ] The phone layout is a shrunk desktop table.
- [ ] The primary action is not in the bottom thumb zone.
- [ ] Body text is under 16px, or a target is under 44px.

**Overall look**
- [ ] It looks like Bootstrap or a default admin kit: grey header bars, bordered form boxes, a blue default button.
- [ ] There are Halloween props: bats, drips, a black/orange theme, or a novelty font.

---

**Refs that influenced each choice** (no shot is copied):
- 02 Sujon: canvas plus floating white cards, near-black pill with white secondaries, big title plus muted subtitle, display-size balance.
- 01 Shakuro: number above muted caption, soft 16–18px cards.
- 03 Conceptzilla: uppercase micro labels over figures, hairlines inside one surface.
- 04 Lexora: dark top-right primary, title plus meta-line rows, small tinted "Ready" pills, a plain-sentence "needs a decision" callout (→ confirm/unverified).
- 05 Aurélien: document left with checks right, icon plus bold title plus 2-line muted explanation, blue pending / amber fail tints.
- 06 Inspakt: centred paper plus info panel, soft "Draft" chip.
- 07 Solara: editor beside a live printable preview (→ Exorcise and PDF).
- 08 NexaPay: violet single accent, large stat tiles, compact status pills.
