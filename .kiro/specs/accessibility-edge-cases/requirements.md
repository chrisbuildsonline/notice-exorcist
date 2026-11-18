# Requirements: accessibility-edge-cases

App: `apps/web`. Visual values come from `design/DESIGN.md`. This spec hardens the flow built in `exorcism-flow` (it refines R9 there) and fixes two known layout issues. Rules from `approval-gate.md`, `no-model-math.md` and `product.md` apply in full. No requirement here relaxes the approval gate or the provenance rules.

## Terms
- **The flow**: Inbox, upload or specimen, notice view, confirm, calculation drawer, Exorcise, approve, export.
- **Screen**: Inbox (empty and with notices), notice view (with a line selected and without), confirm form, calculation drawer open, Exorcise (draft, approved), and the upload error states.
- **Viewport pair**: desktop 1440×900 and phone 390×844. Tablet 820×1180 is added where R7 says so.
- **Serious violation**: an axe-core result with impact `serious` or `critical`.
- **Unsupported rate**: a rate text the duty engine returns `status: "unsupported"` for (for example a compound or conditional rate it cannot parse), or a charge type with no fee table.

## Requirements

### R1. Keyboard-only path
1. THE whole flow SHALL be completable with the keyboard alone: Tab, Shift+Tab, Enter, Space, Esc and arrow keys where a widget role requires them. No step SHALL need a pointer.
2. THE tab order SHALL follow the visual and reading order on every screen. No positive `tabindex` SHALL be used.
3. EVERY interactive element SHALL show a visible focus ring: the 2px `accent` outline with 2px offset from `design/DESIGN.md` 2.4, with at least 3:1 contrast against its background.
4. THE app SHALL have no keyboard trap. The only focus trap is the open calculation drawer (a modal dialog), and Esc SHALL leave it and return focus to the trigger.
5. EVERY page SHALL begin with a skip link, `Skip to main content`, that is the first focusable element, is visible on focus, and moves focus to `<main id="main">`.
6. WHEN a route changes (Inbox to notice to Exorcise), THE app SHALL move focus to the new page `h1` so a screen reader announces the title.
7. THE Dropzone SHALL be operable by keyboard (focus the file input, Enter or Space opens the picker) and its focus ring SHALL be visible when the input has focus.
8. THE approval checkbox SHALL toggle with Space. WHILE it is unticked, THE `Export PDF` control SHALL stay focusable (`aria-disabled`, not `disabled`) so its helper text is reachable, and activating it SHALL do nothing.
9. WHEN the approval is cleared by an edit, THE persistent toast SHALL be announced (`role=status`), SHALL be reachable by keyboard and SHALL be dismissable with the keyboard, without moving focus out of the editor on its own.
10. THE keyboard path SHALL leave the approval gate unchanged: no key press, focus change or navigation SHALL approve a draft.

### R2. Automated accessibility check
1. THE e2e suite SHALL run axe-core (WCAG 2.0, 2.1 and 2.2 A and AA tags) on every screen in the Terms, at both 1440 and 390 px, and fail on any serious violation.
2. Moderate and minor violations SHALL be reported in the test output, not fail the run.
3. THE run SHALL NOT use a rule exclusion unless it is listed, with a reason, in `e2e/a11y-waivers.ts`. A waiver SHALL name the rule, the screen and the reason. An unused waiver SHALL fail the test.
4. A pure test SHALL compute the WCAG contrast ratio of every text and background pair listed in `design/DESIGN.md` 2.1 from the token values in `globals.css` and SHALL assert the documented ratio (to one decimal) and the AA minimum (4.5:1 text, 3:1 edges and focus ring).
5. THE contrast test SHALL also cover: `ink` on every status `-bg`, status `-fg` on its `-bg`, `text-muted` on `canvas`, white on `accent`, and the focus ring on `canvas` and on `surface`.
6. IF a documented ratio in `design/DESIGN.md` differs from the computed one, THEN THE test SHALL fail and the document, not the test, SHALL be corrected.
7. Icons and decorative glyphs SHALL be `aria-hidden`. Every status SHALL keep its word (colour is never the only signal).

### R3. Reduced motion
1. WHEN `prefers-reduced-motion: reduce` is set, THE app SHALL run no CSS animation and no transition longer than 0ms: fog drift, glow pulse, wake-up stagger, calming fade, toast slide, drawer and sheet slide, spinner rotation.
2. THE glow SHALL stay as a static `box-shadow` for `unverified` and `disagrees` lines, with the values from `design/DESIGN.md` section 3. `confirm`, `unsupported` and `verified` SHALL still not glow.
3. THE fog SHALL stay at its computed opacity with no drift and no opacity transition.
4. THE export spinner SHALL be replaced by a static indicator plus the text `Exporting…`.
5. A line that becomes verified SHALL go straight to its final state (calm pill, no glow).
6. THE app SHALL NOT use JavaScript animation (`requestAnimationFrame` loops, Web Animations) that bypasses the media query. IF any exists, THEN it SHALL read `matchMedia('(prefers-reduced-motion: reduce)')`.
7. WHEN the setting changes while the page is open, THE page SHALL follow it without a reload.

### R4. Empty inbox
1. WHEN no notices exist, THE Inbox SHALL show the empty state from `design/DESIGN.md` 5.1: headline "Exorcise your customs notice", one supporting line, the `Try a specimen` primary pill, the specimen card, then the dropzone and forward address.
2. THE empty state SHALL have exactly one primary pill. `Upload a notice` SHALL become secondary on the empty state, and the phone sticky bar SHALL show `Try a specimen`.
3. THE amount-at-stake header SHALL NOT show a figure when there are no notices. It SHALL show no `$` value, not `$0.00`, because nothing was computed (no provenance, no number).
4. THE specimen card's glowing lines SHALL be decorative: the card SHALL be `aria-hidden` or labelled as an example, and SHALL NOT be in the tab order.
5. WHEN the last notice is removed or the data dir is empty, THE page SHALL return to the empty state without an error.
6. THE empty state SHALL pass R1 and R2 at both viewports.

### R5. Unsupported compound rate
1. WHEN the engine returns `unsupported` for a line's rate text, THE line SHALL be in state `unsupported` (dashed edge, `⊘ Not checked`, no glow).
2. THE line SHALL show the stated duty exactly as printed, tagged `stated`. THE recomputed column SHALL show `—` (a dash), never a number, never `$0.00`.
3. THE line SHALL show this plain sentence next to the dash: "Duty-engine cannot check this rate, so the figure is shown as printed on the notice." The text SHALL be in the DOM, not in a tooltip only.
4. THE rate text SHALL be quoted verbatim in `Geist Mono`, for example `2.4¢/kg + 5%`, and SHALL NOT be reformatted or summarised by the model.
5. THE difference cell SHALL show `—`. No flag, no mismatch pill and no draft claim SHALL be produced for the line.
6. THE notice-level difference and totals SHALL treat the line as stated, as `explain.ts` already says, and the notice view SHALL say so once in a caption: "1 line is not checked and counts as stated."
7. THE side panel SHALL NOT suggest a computed figure. Candidate HTS codes may still be listed with the "Candidates, not a final classification" caption.
8. THE calculation drawer for the line SHALL show the rate text, the HTS edition, the reason (`unsupported rate text`) and the caption "Computed by duty-engine, not by the AI model." It SHALL NOT show a formula result, `Match` or `Mismatch`.
9. THE provenance guard SHALL pass for the line (the dash carries no money figure).
10. THE draft builder SHALL skip the line. Where it skips one or more lines, THE draft SHALL carry no claim about them and the Exorcise page SHALL say how many lines were skipped and why.
11. THE `unsupported` state SHALL be conveyed by word and icon, not by colour alone, and SHALL pass R2.

### R6. Odd uploads
1. THE size limit SHALL stay 10 MB (`MAX_BYTES`). A file over it SHALL be rejected by the server with 413 and by the client before sending when `file.size` is known to exceed it, with the message "That file is over 10 MB. Try a smaller photo, or a lower-resolution scan." No file SHALL be stored.
2. THE oversize message SHALL show the file's size and the limit. These are file-size facts, not duty figures, and are formatted by one helper (`formatBytes`) that is not used for money.
3. A wrong type (for example `.exe`, `.heic`, `.gif`, `.webp`, a renamed text file) SHALL be rejected with: "That file is not a PDF, PNG or JPEG." Type SHALL be decided by magic bytes, never the name or declared type. HEIC SHALL get the extra hint "On iPhone, choose Most Compatible in Camera settings, or share the photo as JPEG."
4. A zero-byte file SHALL be rejected with "That file is empty."
5. A tall image (aspect ratio height/width of 3 or more, such as a long receipt) and a wide image (width/height of 3 or more) SHALL be accepted when type and size are valid. The server SHALL NOT crop or distort the original.
6. WHEN an image's longest side exceeds the model input limit, THE extraction step SHALL downscale a copy for the model, preserve the aspect ratio and keep the original for "View original scan". The scaling SHALL NOT change the sniffed type of the stored file.
7. IF extraction still cannot read a tall or wide image, THEN THE row SHALL show the plain failure reason from `notice-view.ts` ("could not read" family) with a retry action, and no partial figures, as in `exorcism-flow` R2.4.
8. A decompression bomb guard SHALL reject an image whose decoded pixel count exceeds 100 megapixels with "That image is too large to read. Try a smaller photo."
9. Every upload error SHALL be shown in a `role="alert"` region beside the dropzone, SHALL name the problem and the next step, and SHALL be cleared on the next attempt. Focus SHALL stay on the Dropzone control.
10. THE same checks SHALL apply to `POST /api/inbound` attachments: an invalid attachment SHALL be skipped, and the endpoint SHALL return 422 when none is valid, as in `exorcism-flow` R3.4.
11. Notice contents, file names and error text SHALL NOT be logged.

### R7. Known layout issues
1. **Round-button focus ring.** WHEN a round (`rounded-full`) button or link has focus, THE focus ring SHALL follow the control's shape (a pill ring, or a circle for the 44×44 icon button), not a square. The ring SHALL not be clipped by a parent with `overflow` set. A test SHALL check the computed `border-radius` and the outline of every `rounded-full` focusable control.
2. **Tablet side panel.** AT widths 768 to 1023 px, THE notice view side panel SHALL open as a right drawer (560px, `overlay` shadow, 320ms slide, no slide under reduced motion) from the selected line, per `design/DESIGN.md` section 2.2 breakpoints, instead of stacking under the list.
3. THE tablet panel SHALL be a modal dialog with the same rules as the calculation drawer: focus trap, Esc, scrim click, focus return to the selected line.
4. AT 1024 px and up the panel SHALL stay sticky at 5/12. AT under 768 px the panel SHALL stay a full-screen line view.
5. Neither layout SHALL cause horizontal scroll, and every target SHALL be at least 44×44px.

### R8. No regressions
1. `bun run test`, `bun run typecheck` and `bun run e2e` SHALL pass. The existing `layout.spec.ts`, `drawer.spec.ts` and `approval.spec.ts` assertions SHALL stay unchanged unless a requirement above changes them, and each such change SHALL be noted in the task.
2. A new dependency SHALL be added only for the axe-core check (`@axe-core/playwright`, dev only). The reason: there is no reasonable alternative that applies the axe rule set inside Playwright pages. Everything else (contrast maths, file-size formatting, aspect checks) SHALL use the standard library or code already in the repo. Image dimensions SHALL be read by the existing image handling in `notice-extract` if it has any; otherwise by a small PNG/JPEG header parser in `lib/`, with a unit test.
3. Figures SHALL still render only through `Figure`. The `no-raw-money` test SHALL keep passing.
