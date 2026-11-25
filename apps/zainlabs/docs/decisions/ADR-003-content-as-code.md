# ADR-003: Content as typed code, exported to JSON for the backend

- Status: accepted · 2026-11-25

## Decision
Streams, projects and site copy live in `content/src/*.ts` (typed, reviewed in git, zero cost, no CMS).
The website imports them at build time (static pages); `npm run export` writes `content/content.json`, which
the backend serves (`/api/content`) to the app and other clients. `npm run check` fails if the export is stale.

## Consequences
+ One source of truth; agents edit one file to add a project.
− Content changes need a commit and redeploy. A headless CMS can replace this later behind the same API.
