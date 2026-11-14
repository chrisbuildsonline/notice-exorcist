# Sources

The files in this directory are downloaded by `bun run data:fetch` from two US government sources. The search index in `.cache/` is built from them with `bun run data:build` and is not committed.

<!-- generated from manifest.json -->
- HTS edition: 2026 HTS Revision 23
- HTS retrieved: 2026-11-14 (10 chapter files)
- CROSS rulings retrieved: 2026-11-14 (108 rulings)
<!-- end generated -->

## USITC Harmonized Tariff Schedule (HTS)

- Publisher: United States International Trade Commission, https://hts.usitc.gov/
- Files: `hts/chNN.json`, one per chapter (39, 42, 61, 62, 63, 64, 71, 85, 94, 95)
- Request: `https://hts.usitc.gov/reststop/exportList?from=NN00&to=NN99&format=JSON&styles=false`
- Edition: `https://hts.usitc.gov/reststop/currentRelease`, read at fetch time
- Stored byte for byte as received.

## CBP Customs Rulings Online Search System (CROSS)

- Publisher: U.S. Customs and Border Protection, https://rulings.cbp.gov/
- Files: `rulings/<ruling number>.json`
- Request: `https://rulings.cbp.gov/api/ruling/<ruling number>`; the human-readable page is `https://rulings.cbp.gov/ruling/<ruling number>`
- The rulings are a fixed selection listed in `src/config.ts`, checked at fetch time to be classified under the listed heading. CROSS search needs a reCAPTCHA token, so the fetch script does not search.
- Each record is stored as received except the `url` field, a presigned download link that expires after 15 minutes. It is removed.

## Licence

Both sources are works of the United States government and are in the public domain in the United States (17 U.S.C. 105). The MIT licence of this repository covers the code only and does not apply to the data in this directory.

## Not legal advice

This is a snapshot. Rates, notes and rulings change, and rulings can be modified or revoked after the retrieval date. Check the current edition at https://hts.usitc.gov/ and the ruling status at https://rulings.cbp.gov/ before relying on any of it. Nothing here is legal advice or a binding classification.
