# ZAIN LABS API (backend) – human-readable contract

Machine-readable contract: `api/openapi.json` (generated from the code, checked by tests). Interactive docs
while the API runs: http://localhost:8100/docs. Base URL in development: `http://localhost:8100`; the website
reaches it same-origin through `/api/*` (Next.js rewrite).

## Conventions
- JSON in and out, UTF-8. Request bodies **reject unknown fields** (422).
- Every error: `{"error": "<message for the user>", "code": "<machine code>", "fields": {"<field>": "<message>"}?}`.
  Codes: `validation_error` (422), `not_found` (404), `rate_limited` (429, `Retry-After` header),
  `unauthorized` (401), `admin_disabled` (503), `method_not_allowed` (405).
- POST endpoints are rate-limited per client IP (default 5 per 10 minutes, `ZL_RATE_LIMIT`). IPs are kept in
  memory only and never stored.

## Public endpoints
| Method & path | Purpose | Request | Response |
|---|---|---|---|
| `GET /api/health` | liveness | – | `{status:"ok", version, projects}` |
| `GET /api/content` | site copy, streams, projects | `If-None-Match` optional | 200 `ContentBundle` + `ETag`, or 304 |
| `GET /api/streams` | streams with counts | – | `[Stream & {projectCount}]` |
| `GET /api/projects?stream=software` | projects | `stream` optional (one of the 5 slugs; else 422) | `[Project]` |
| `GET /api/projects/{slug}` | one project | – | `Project` or 404 |
| `POST /api/contact` | lead from website/app | `{name, email, company?, stream, project?, message, consent:true, source:"web"|"app", website:""}` | 201 `{ok:true, id}` |
| `POST /api/newsletter` | double opt-in request | `{email, consent:true, source, website:""}` | 202 `{ok:true, status:"pending"}` (same answer for any address: no enumeration) |
| `GET /api/newsletter/confirm?token=` | link in the email | – | 303 → `{SITE_URL}/newsletter?status=confirmed|invalid` (links expire after 7 days) |
| `GET /api/newsletter/unsubscribe?token=` | link in every email | – | 303 → `…?status=unsubscribed|invalid` |

Field limits: name 1–120, email ≤ 200 (pattern `x@y.zz`), company ≤ 160, message 10–4000, project = existing slug.
`website` is a honeypot: when filled, the API answers success and stores nothing.

## Admin endpoints (`Authorization: Bearer <ZL_ADMIN_TOKEN>`; 503 when no token is configured)
| Method & path | Purpose |
|---|---|
| `GET /api/admin/leads?status=new&limit=100` | list leads (status: new, contacted, won, lost, spam) |
| `PATCH /api/admin/leads/{id}` | `{status?, note?}` |
| `DELETE /api/admin/leads/{id}` | erase (GDPR Art. 17) |
| `GET /api/admin/subscribers?status=confirmed` | list subscribers |
| `DELETE /api/admin/subscribers/{id}` | erase |
| `POST /api/admin/purge` | apply retention now (leads older than `ZL_RETENTION_DAYS`, unconfirmed > 7 days) |
| `GET /api/admin/audit?limit=200` | audit log |

Example: `curl -H "Authorization: Bearer $ZL_ADMIN_TOKEN" localhost:8100/api/admin/leads`

## Side effects of a new lead
Optional owner notification email (`ZL_OWNER_EMAIL`) and webhook POST (`ZL_LEAD_WEBHOOK_URL`, e.g. n8n/Slack/CRM).
Failures are logged and never lose the lead. Mail backend `outbox` (default) writes `.eml` files instead of sending.

## Changing the contract (backend agents only)
1. Change `api/src/zainlabs_api/schemas.py` / routes, add tests.
2. `zainlabs-api openapi > openapi.json` (tests fail if stale).
3. Update `content/src/api.ts` (client) and this file. Tests fail if the client calls a path missing from the contract.
4. Tell frontend agents in `HANDOFF.md`.
