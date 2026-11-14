---
inclusion: fileMatch
fileMatchPattern: "apps/web/**"
---

# Design: the haunted document

`design/DESIGN.md` is the source of truth for every visual value (tokens, glow, fog, components, screens). If this file and `design/DESIGN.md` disagree, `design/DESIGN.md` wins. If a value is not in `design/DESIGN.md`, add it there first. Do not invent one here or in code.

## Concept
The notice is a haunted document. Lines that are unverified or disagree with the recomputation glow. Verified lines go calm. The spookiness lives in the glow, the fog and the copy, not in clutter.

## Look
- Soft neutral canvas. White floating surfaces with a soft shadow and 16-20px radius.
- One near-black pill primary action per view.
- One accent (séance violet). It is for links, selection, focus ring, chart series and citation chips. It is never used for a glow, a status pill or a button fill.
- Glows use the status hues from `design/DESIGN.md` section 2.1:
  - `haunt` (disagrees): strong ember glow, 2.4s pulse.
  - `unverified`: soft amber glow, 3.6s pulse.
  - `calm` (verified/approved): a brief green glow during the calming transition only, then none.
  - `confirm` and `unsupported`: no glow. Confirm is a blue tint, unsupported is a dashed edge.
- Status hues appear only as pills, row tints, 3px edges, glows and status icons. Never on links, buttons, chart series or the focus ring.
- Large titles and large numbers.
- Status pills (see `design/DESIGN.md` section 4): Disagrees, Unverified, Verified, Confirm, Not checked, Draft, Approved.

## Behavior
- Status is never conveyed by color alone. Pair every glow or tint with a label and an icon.
- `prefers-reduced-motion: reduce` turns all animation off, including the glow pulse. Keep a static glow with the values in `design/DESIGN.md` section 3.
- Text and UI contrast meet WCAG AA (4.5:1 text, 3:1 large text and UI components). Check pill tints and glow on white.
- Keyboard focus is visible. Interactive targets are at least 44px.
- Every number shows its provenance label (`stated`, `computed` or `tariff`) per `no-model-math.md`.
- Spooky words (*haunted*, *at peace*, *exorcise*) appear only in page titles, notice-level pills and empty states. Line-level, calculation and legal text stays literal.
