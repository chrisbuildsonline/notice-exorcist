---
inclusion: fileMatch
fileMatchPattern: "apps/web/**"
---

# Design: the haunted document

Follow `design/DESIGN.md` for tokens (colors, spacing, type scale). Don't invent values outside it.

## Concept
The notice is a haunted document. Lines that are unverified or disagree with the recomputation glow. Verified lines go calm. The spookiness lives in the glow and the copy, not in clutter.

## Look
- Soft neutral canvas. White floating surfaces with a soft shadow and 16-20px radius.
- One near-black pill primary action per view.
- One accent color, used for the glow and key emphasis.
- Large titles and large numbers.
- Tinted status pills: verified (calm), disagrees (glow), unverified (glow, softer), draft, approved.

## Behavior
- Status is never conveyed by color alone. Pair every glow or tint with a label or icon.
- `prefers-reduced-motion: reduce` turns all animation off, including the glow pulse. Keep a static glow.
- Text and UI contrast meet WCAG AA (4.5:1 text, 3:1 large text and UI components). Check pill tints and glow on white.
- Keyboard focus is visible. Interactive targets are at least 44px.
- Every number shows its provenance label (stated or computed) per `no-model-math.md`.
