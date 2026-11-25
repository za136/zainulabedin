# Assumptions register

| Assumption | How to test |
|---|---|
| DE base rate 1.27 % (since 01.07.2025) is still current | Check the Bundesbank base rate page; set `MAHN_BASE_RATE_DE` |
| AT base rate default 1.53 % | Verify against the OeNB published rate; set `MAHN_BASE_RATE_AT` |
| Interest starts 30 days after the due date (§ 286 Abs. 3 BGB) as a conservative default | Review with a tax advisor / lawyer; an earlier start is possible if the invoice states a fixed due date |
| Levels 7 / 21 / 35 days and a 10-day gap are acceptable for SMEs | Ask 3 bookkeepers; adjust env vars |
| Bank references usually contain the invoice number | Measure the match rate on a real camt.053 export |
| Odoo `account.move` / ERPNext `Sales Invoice` fields as used are stable across versions 16–18 / v15 | Run connectors against test instances |
| Approvers prefer editing drafts over writing letters | Pilot feedback: edit rate per draft |
