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

### Flutter release-mode stress FPS still needs device validation

- Status: Open
- Reported behavior: the Flutter circle graph prototype dropped to around 40 FPS on a small test set, around 10 FPS near 500 points while moving, and around 2 FPS above 1,000 points.
- Notes: `flutter_board/lib/main.dart` now paints real working people icons in a screen-space canvas layer with painter hit testing, paints dense stress icons in a screen-space `CustomPaint` overlay, culls dense layers to the viewport, stores stress coordinates in typed arrays, batches avatar rendering through a preprocessed sprite, renders real and synthetic stress edges as raw line segments with density-based level-of-detail sampling, removes person and synthetic stress edges from the transformed world `EdgePainter`, and updates FPS through a `ValueNotifier` instead of rebuilding the board. Validate the result in release/profile mode on the target device or browser because debug Flutter FPS can be misleading.

## Resolved Problems

### DOM/SVG icon stress ceiling was unknown

- Status: Resolved
- Reported need: the app needed evidence for how many icon nodes and graph edges the current DOM/SVG prototype could render smoothly.
- Resolution: a Chrome run on the current Mac showed roughly 4 FPS while panning at 1,000 synthetic DOM/SVG icons with 1,000 synthetic SVG edges, roughly 3 FPS at 2,500, and 1-3 FPS at 5,000-10,000. The visible prototype now keeps the product-like DOM/SVG circle UI but renders the dense synthetic icon and edge stress layer on Canvas 2D with cached sprites and viewport culling. A follow-up Chrome run showed 0 synthetic DOM nodes and roughly 116-120 FPS while panning at 1,000-10,000 synthetic canvas-backed icons with synthetic edges enabled.
