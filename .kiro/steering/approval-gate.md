---
inclusion: always
---

# Approval gate

Nothing is exported or sent until the user explicitly approves the exact content.

## Rules
- Drafts start as `draft`. Only an explicit user action (an "Approve" button click) moves one to `approved`.
- Approval is bound to a content hash. Any edit after approval clears it.
- UI: the export button is disabled until approval, and shows what is being approved.
- Server: the export endpoint independently checks for a valid approval on the current content hash and returns 403 otherwise. Never rely on the UI alone.
- No auto-approve, no default-true flags, no approval inferred from other actions.
- The app never files with CBP or emails anyone. Export produces a PDF the user sends themselves.
- Exported PDFs carry the "not legal advice" notice and the citations for the draft.

## Tests
- Playwright: export is blocked before approval, allowed after, blocked again after an edit.
- Server test: a direct request to the export endpoint without approval is rejected.
