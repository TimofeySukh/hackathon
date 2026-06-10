# Problems

This document tracks known project problems that are not yet fully captured by code, tests, or Linear task status.

## Maintenance Rule

Before starting project work, check this file for relevant open problems.

When working on the project:

- add a new entry if you discover a new bug, risk, blocker, flaky behavior, unclear operational issue, or product problem that should remain visible after the current session
- update an existing entry if you learn more about it
- move or mark an entry as resolved when the problem is fixed or no longer applies
- keep entries factual, concise, and linked to code, docs, commits, Linear issues, or reproduction steps when available

## Open Problems

### No LinkedIn sync

- Status: Open
- Reported gap: the product does not sync people or relationship data directly with LinkedIn.
- Notes: the app can now import `Connections.csv` from a LinkedIn data export zip, create LinkedIn-tagged people, create source notes, and connect imported people to the root person. Direct LinkedIn API sync is still not implemented and needs product and integration scoping, including auth, import direction, data fields, and API availability.

### Data storage depends only on Supabase

- Status: Open
- Reported concern: storing project data only in Supabase may be a weak product or architecture choice.
- Notes: `docs/SECURITY.md` now records the target direction: signed-out local exploration, explicit cloud sync, export, deletion, minimized imported fields, and possible client-side encryption for sensitive note bodies. The app now has graph export, graph deletion, account-data deletion, minimized LinkedIn import, and reduced AI provider context. Broader storage architecture work is still open.

### Live Supabase security checks still need execution

- Status: Open
- Reported gap: local repository checks now include `supabase/tests/security_regression_checks.sql`, but Supabase CLI is not installed in this environment and live advisors/grants have not been executed here.
- Notes: run Supabase advisors against the live project, run the SQL security checks, and extend them with user A/user B mutation tests when a seeded auth-user harness is available.

### Icon sizes differ across browsers

- Status: Open
- Reported behavior: icon sizing is inconsistent between browsers.
- Notes: needs cross-browser reproduction and CSS normalization for icon dimensions, line height, and button layout.

### Landing page is missing

- Status: Open
- Reported gap: the project needs a landing page.
- Notes: needs product requirements for public messaging, target audience, routing, auth entry points, and how the landing page coexists with the board-first app.

### Large imported graphs are too slow

- Status: Open
- Reported behavior: 60-100 contacts load acceptably, but around 3000 contacts the board becomes extremely laggy.
- Notes: the product target should support at least 10000 imported contacts. A reproducible LinkedIn fixture can be generated with `npm run generate:linkedin-fixture -- --count 10000`; it writes `fixtures/linkedin/Connections-10000.csv` and `fixtures/linkedin/linkedin-connections-10000.zip`. The app now uses batched LinkedIn inserts, a canvas overview layer, viewport-capped interactive DOM nodes, capped SVG connections, and label LOD. This still needs live timing against a signed-in Supabase project with the 10000-contact ZIP before marking resolved.

## Resolved Problems

### Windows laptops cannot add new nodes

- Status: Resolved
- Reported behavior: the button or gesture for adding a new node does not work on Windows laptops.
- Resolution: replaced modifier-dependent node growth with double-click creation on the empty board and double-tap creation on touch devices, so node creation no longer depends on platform-specific modifier keys.

### npm audit reports transitive vulnerabilities

- Status: Resolved
- Reported behavior: `npm audit --audit-level=high` failed with 7 reported vulnerabilities, including a high-severity `fast-uri` advisory and moderate advisories in transitive packages such as `brace-expansion`, `hono`, `ip-address`, `qs`, and `ws`.
- Resolution: ran `npm audit fix`, updated transitive dependency versions in `package-lock.json`, and verified `npm audit --audit-level=high` reports 0 vulnerabilities.
