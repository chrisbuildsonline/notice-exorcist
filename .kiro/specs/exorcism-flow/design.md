# Design: exorcism-flow

## Layout
```
apps/web/
  app/
    page.tsx                       Inbox
    notices/[id]/page.tsx          Haunted notice view
    notices/[id]/exorcise/page.tsx Draft, approve, export
    api/inbound/route.ts           POST forwarded email
    api/notices/route.ts           POST upload
    api/notices/[id]/route.ts      GET notice with computed states
    api/drafts/[id]/route.ts       GET, PUT draft (PUT clears approval)
    api/drafts/[id]/approve/route.ts   POST { hash }
    api/drafts/[id]/export/route.ts    POST -> PDF or 403
  components/
    Figure.tsx  StatusPill.tsx  HauntedLine.tsx  Paper.tsx  Fog.tsx
    CalcDrawer.tsx  ApprovalCard.tsx  DraftEditor.tsx  CitationChip.tsx
    InboxRow.tsx  Dropzone.tsx  Toast.tsx
  lib/
    db.ts            SQLite (bun:sqlite) with FTS5 index for rulings
    hash.ts          canonicalDraft(), draftHash()
    approval.ts      recordApproval(), isApproved()
    states.ts        lineState(), fogOpacity(), noticeStatus()
    provenance-guard.ts   assertSourced(payload)
    draft-builder.ts      builds the draft from provenance records
    pdf.ts           renderPdf(draft, trail)
  styles/globals.css  tokens from design/DESIGN.md 2.4
e2e/                  Playwright specs
```

## Data
- `notices(id, kind, status, created_at, source, extracted_json)`
- `lines(id, notice_id, n, stated_json, computed_json, state)`
- `drafts(id, notice_id, body_json, hash, state, updated_at)`
- `approvals(draft_id, hash, approved_at)` with one row per draft.
- `inbox_tokens(token, user_id)`

## Key decisions
- **Hash.** `canonicalDraft` serializes `{ paragraphs: string[], figures: ProvRef[], citations: Citation[] }` as stable JSON (sorted keys, no whitespace), then sha256. The same function runs on client (display) and server (authority). The server never trusts a client hash.
- **Approval is a row, not a flag.** `isApproved(draft)` returns true only when an `approvals` row exists and its hash equals `draftHash(stored draft)`. Every draft `PUT` deletes the row in the same transaction as the update.
- **Export route.** Loads the stored draft, computes the hash, calls `isApproved`, returns 403 with `{ error: 'approval_required' }` otherwise. It never reads approval status from the request body.
- **Figure.** Typed so `prov` and `source` are required at compile time. At runtime a missing value renders `—` + `⊘ Unsourced`, and throws when `NODE_ENV !== 'production'`. A lint-style test greps `apps/web` for raw money formatting outside `Figure`.
- **Provenance guard.** `assertSourced` walks API payloads for money-shaped fields (`{ value, ... }` under keys ending in `Amount`, `Duty`, `Total`, `Fee`, `Difference`) and fails when `prov` is absent. Applied by a wrapper used by all notice and draft routes.
- **Explanation text check.** The model's explanation is scanned for number-like tokens. Each must equal a formatted figure from the line's provenance records, otherwise the sentence is dropped. The model gets figures as pre-formatted strings it may quote.
- **Draft building.** Structure and figures come from code. The model fills only connective phrasing in marked slots, for example `{{fig:line3.computed}}` stays a token. Output is validated with Zod and any slot with a digit not in a token is rejected.
- **States.** `lineState` is a pure function over the engine comparison and extraction confidence: `confirm` > `unsupported` > `disagrees` > `unverified` > `verified`. Order is tested.
- **Fog.** `fogOpacity` is a pure function matching the formula in `design/DESIGN.md`.
- **Inbound email.** Written for a Mailgun or Postmark style multipart webhook. The provider choice is deployment config. Auth is a shared secret header with timing-safe compare. No outbound mail code exists in the repo.
- **PDF.** Playwright Chromium `page.pdf` with `displayHeaderFooter` and a `footerTemplate` that prints the notice line, hash and page numbers on every page. Playwright is already a dev dependency for e2e. It becomes a runtime dependency for the web app; this is recorded in the PR because the stack lists a server-side renderer but no library.
- **Styling.** Tokens from `design/DESIGN.md` 2.4 live in `globals.css`. Components use token classes only. Glows use `--glow-haunt`, `--glow-unverified`, `--glow-calm`.
- **Reduced motion.** CSS `@media (prefers-reduced-motion: reduce)` with static glow values from `design/DESIGN.md` section 3.
- **Local mode.** Default extraction provider is Ollama. With `EXTRACT_MODE=fixture` the specimen flow runs with no services.

## Testing
- Vitest for pure logic and route handlers (hash, approval, states, fog, guard, inbound).
- Playwright for the flow, run against fixture mode, including the approval gate cases from `approval-gate.md`.
- Visual checklist from `design/DESIGN.md` section 6 reviewed on screenshots at 1280 and 390 px.
