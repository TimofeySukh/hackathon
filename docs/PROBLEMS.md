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
- Reported gap: the product does not sync people or relationship data with LinkedIn.
- Notes: the app now has a menu that explains how to request a LinkedIn data archive, but archive upload/import and real sync are not implemented. Needs product and integration scoping, including auth, import direction, data fields, and API availability.

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

## Resolved Problems

No resolved problems are currently documented here.
