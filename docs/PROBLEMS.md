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

### Windows laptops cannot add new nodes

- Status: Open
- Reported behavior: the button or gesture for adding a new node does not work on Windows laptops.
- Notes: needs reproduction details, including browser, input device, and whether the expected action is modifier-drag, a button, or another control.

### No LinkedIn sync

- Status: Open
- Reported gap: the product does not sync people or relationship data directly with LinkedIn.
- Notes: the app can now import `Connections.csv` from a LinkedIn data export zip, create LinkedIn-tagged people, create source notes, and connect imported people to the root person. Direct LinkedIn API sync is still not implemented and needs product and integration scoping, including auth, import direction, data fields, and API availability.

### Data storage depends only on Supabase

- Status: Open
- Reported concern: storing project data only in Supabase may be a weak product or architecture choice.
- Notes: needs an architecture decision covering portability, backup/export, vendor lock-in, offline access, and any second storage target.

### Icon sizes differ across browsers

- Status: Open
- Reported behavior: icon sizing is inconsistent between browsers.
- Notes: needs cross-browser reproduction and CSS normalization for icon dimensions, line height, and button layout.

### Landing page is missing

- Status: Open
- Reported gap: the project needs a landing page.
- Notes: needs product requirements for public messaging, target audience, routing, auth entry points, and how the landing page coexists with the board-first app.

### npm audit reports transitive vulnerabilities

- Status: Open
- Reported behavior: `npm audit --audit-level=high` fails with 7 reported vulnerabilities, including a high-severity `fast-uri` advisory and moderate advisories in transitive packages such as `brace-expansion`, `hono`, `ip-address`, `qs`, and `ws`.
- Notes: `npm audit fix` is suggested by npm, but the dependency tree update should be reviewed separately from feature work.

### Production graph renderer is undecided

- Status: Open
- Reported need: the app needs to support thousands of visible people while loading and interacting smoothly.
- Notes: the current visible screen is a 10,000-person Canvas 2D performance prototype with generated orbit data, zoom-based LOD, cached avatar sprites, root-to-person edges, and draggable nodes. Before rebuilding persisted product flows, decide whether the production graph layer should stay custom Canvas 2D or move to a WebGL graph renderer such as Sigma.js, with React reserved for app chrome.

## Resolved Problems

No resolved problems are currently documented here.
