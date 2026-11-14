---
inclusion: always
---

# Approval gate

Nothing is exported or sent until the user explicitly approves the exact content.

## Rules
- Drafts start as `draft`. Approval is an approval checkbox card labelled "I approve this exact draft". Ticking it is the explicit user action that moves the draft to `approved`. The box is unchecked by default.
- Approval is bound to the sha256 content hash of the draft. The card shows the hash, paragraph count and citation count of what is being approved.
- Any edit to the draft clears approval: the box is unticked, the state returns to `draft`, and the user sees a toast that stays until dismissed.
- UI: the export button is disabled until the box is ticked, and helper text says why.
- Server: the export endpoint independently recomputes the hash of the stored draft and checks it against the recorded approval. Without a valid approval for the current hash it returns 403. Never rely on the UI alone.
- No auto-approve, no default-true flags, no approval inferred from other actions (viewing, saving, exporting, navigating).
- The app never files with CBP or emails anyone. Export produces a PDF the user sends themselves.
- Exported PDFs carry the "not legal advice" notice on every page, the approved hash, and the citations for the draft.

## Tests
- Playwright: export is blocked before the box is ticked, allowed after, and blocked again after an edit.
- Server test: a direct request to the export endpoint without approval returns 403. A request with an approval for a stale hash also returns 403.
