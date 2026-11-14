# Sources and licence

These are the documents `../fees.json` is copied from, saved as retrieved on 2026-11-14. Every value in `fees.json` has a `quotes` list, and `src/fee-table.test.ts` checks that each quote appears word for word in the saved copy named by `localCopy` and that each rate, minimum and maximum appears in a quote.

| File | Source URL | Document |
| --- | --- | --- |
| fy2025-user-fees-notice.html / .txt | https://www.govinfo.gov/content/pkg/FR-2024-07-22/html/2024-15990.htm; https://www.federalregister.gov/documents/2024/07/22/2024-15990/customs-user-fees-to-be-adjusted-for-inflation-in-fiscal-year-2025 | 89 FR 59126, FR Doc. 2024-15990, CBP Dec. 24-11 (FY2025 MPF limits) |
| fy2026-user-fees-notice.html / .txt | https://www.govinfo.gov/content/pkg/FR-2025-07-23/html/2025-13869.htm; https://www.federalregister.gov/documents/2025/07/23/2025-13869/customs-user-fees-to-be-adjusted-for-inflation-in-fiscal-year-2026-cbp-dec-25-10 | 90 FR 34665, FR Doc. 2025-13869, CBP Dec. 25-10 (FY2026 MPF limits) |
| fy2027-user-fees-notice.html / .txt | https://www.govinfo.gov/content/pkg/FR-2026-07-31/html/2026-15530.htm; https://www.federalregister.gov/d/2026-15530 | 91 FR 48398, FR Doc. 2026-15530, CBP Dec. 26-14 (FY2027 MPF limits) |
| 19cfr24-23.html | https://www.ecfr.gov/current/title-19/chapter-I/part-24/section-24.23 | 19 CFR 24.23, MPF ad valorem rate 0.3464 percent, eCFR up to date as of 11/12/2026 |
| 19cfr24-24.html | https://www.ecfr.gov/current/title-19/chapter-I/part-24/section-24.24 | 19 CFR 24.24, HMF 0.125 percent, eCFR up to date as of 11/12/2026 |
| cbp-user-fee-table.html | https://www.cbp.gov/trade/basic-import-export/user-fee-table | CBP user fee table, used as a cross-check only (FY2027 MPF row and HMF row agree with fees.json) |

The govinfo URL for the FY2027 notice is not written in the saved file; it follows the govinfo pattern for the publication date and document number shown in the file and was checked to serve the same notice on 2026-11-14.

## HMF date range

The saved 19 CFR 24.24 page is the version in force from its last amendment (2026-02-06). eCFR lists earlier versions of the section dated 2016-12-27, 2025-08-18 and 2026-01-02; paragraph (a) reads "0.125 percent (.00125)" in the versions in force on 2024-10-01, 2025-08-18 and 2026-01-02 (checked on ecfr.gov on 2026-11-14). The HMF entry therefore starts on 2024-10-01. Its end date, 2027-09-30, matches the end of the MPF table and is not a date from the regulation: check eCFR again before relying on it after 11/12/2026.

## Licence

All files in this directory are works of the United States government (Federal Register, eCFR and CBP) and are not subject to copyright in the United States (17 U.S.C. 105). The licence of this repository covers the code only and does not apply to these documents or to the values copied from them into `../fees.json`.

## Not legal advice

Fees change every fiscal year. Check the current CBP notice before relying on any figure here.
