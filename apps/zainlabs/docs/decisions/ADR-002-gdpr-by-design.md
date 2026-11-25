# ADR-002: GDPR by design for leads and newsletter (DACH)

- Status: accepted · 2026-11-25

## Decision
- Data minimisation: no IP addresses, user agents or tracking IDs stored; rate limiting keeps IPs in memory only.
- Explicit consent (unticked checkbox) for contact and newsletter; consent time stored.
- Newsletter uses **double opt-in** (standard in Germany): confirmation link valid 7 days, unconfirmed
  entries purged; unsubscribe link in every email; identical response for every address (no enumeration).
  Tokens stored only as SHA-256 hashes.
- Retention: leads deleted after `ZL_RETENTION_DAYS` (default 365) by `zainlabs-api purge` / admin endpoint.
- Erasure endpoints for leads and subscribers (Art. 17); audit log of all changes.
- Website: no cookies, no third-party requests (fonts, CDNs, analytics), enforced by e2e tests.

## Consequences
The privacy notice (`web/app/datenschutz`) describes exactly this. Any new data field needs an update of
the notice and of this ADR. Not legal advice: have the notice reviewed before launch.
