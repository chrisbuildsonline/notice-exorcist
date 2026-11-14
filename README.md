# Notice Exorcist

Scan the customs notice that haunts your small import business; every duty figure is recomputed by code, never guessed by the model, and every reply is a cited draft you approve.

Built for [Kiroween 2026](https://kiroween.devpost.com/). Submissions close 2026-12-04.

## What it does

A user uploads a scan or photo of a customs notice. Notice Exorcist extracts every field and line item, rewrites the jargon in plain English, and maps each described product to candidate tariff codes using the official tariff schedule and a searchable archive of past published customs rulings. A deterministic calculator then recomputes the duty and fees line by line, shows the formula for each, and flags where the notice and the recomputation disagree. For each flagged line, it drafts a cited response or protest letter that the user must review and approve before anything is exported as a PDF. Nothing is ever filed automatically. Measured accuracy: [fill in measured result].

## Stack

TypeScript monorepo (pnpm). Next.js and Tailwind front end; a pure packages/duty-engine library using decimal.js with fast-check property tests and Vitest; a notice-extraction service calling a multimodal model (Claude via Amazon Bedrock) that returns schema-validated JSON (Zod); SQLite with FTS5 for the local rulings index; a custom MCP server (tariff-mcp) built on the MCP TypeScript SDK; PDF export with a server-side renderer. Deployed as one Docker Compose file or a single hosted app, with an optional local-only mode. OSI-licensed (MIT) public repository.

## License

MIT, see LICENSE.
