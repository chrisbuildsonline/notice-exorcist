---
inclusion: always
---

# Product: Notice Exorcist

Kiroween 2026 entry, Frankenstein category (stitches together a local vision model, the USITC tariff schedule, CBP CROSS rulings, and a deterministic calculator).

## Audience
Small US importers and online sellers who receive a CBP Form 28 (Request for Information), CBP Form 29 (Notice of Action), or a courier duty invoice and can't tell whether the charges are right.

## Problem
Customs notices are full of jargon, and the duty figures on them are hard to check. Owners either overpay or miss a response deadline.

## What it does
1. Accepts an upload or forwarded scan of a notice.
2. Extracts fields and line items with a multimodal model.
3. Explains the jargon in plain English.
4. Finds candidate HTS codes (USITC Harmonized Tariff Schedule) and matching CBP CROSS rulings.
5. Recomputes every duty and fee with the deterministic duty engine.
6. Flags lines where the notice and the recomputation disagree.
7. Drafts a cited reply that the user edits and approves before PDF export.

## What it never does
- File, send, or submit anything to CBP or anyone else.
- Give legal advice. Every draft and result carries a "not legal advice" notice.
- Let the model compute, convert, or round a figure (see `no-model-math.md`).
- Export before explicit user approval (see `approval-gate.md`).
- Present a candidate HTS code as a final classification. Candidates are suggestions with citations.
