# Board search

## Purpose

Let the user jump straight to someone (or to a circle/"tag") on a large board instead
of panning and zooming to hunt for them. Type a name, pick a result, and the board
selects the node and flies the camera to it at a comfortable zoom.

## Behavior

- A magnifier pill sits in the top toolbar, immediately left of the settings gear.
  Collapsed it is an icon button; tapping it expands an inline text field and focuses it.
- Typing filters live: people match on name **and** role; circles match on name. People
  are listed first, then circles (labelled "Circle"); results are capped at 8.
- Pasting a LinkedIn profile URL (`linkedin.com/in/...` or `linkedin.com/pub/...`)
  shows an "Add LinkedIn profile" action at the top of results. Clicking it, or
  pressing Enter while it is first, imports the profile into the board.
- LinkedIn profile import normalizes the URL, tries to read public Open Graph metadata
  for name, headline/company, and avatar, then falls back to the URL slug when LinkedIn
  blocks metadata access from the browser.
- Picking a result (click or Enter on the first match) selects the node — opening the
  inspector — and animates the camera so the node sits slightly above screen centre
  (clear of the bottom inspector). Zoom is a fixed 1.5× for a person and fit-to-circle
  for a circle.
- Closing: the × clears the field; clicking outside, pressing Escape, or opening the
  settings panel closes search. Search and settings are mutually exclusive.
- Empty query shows nothing; a query with no matches shows "No matches".

## Design

Reuses the Material 3 chrome language (see [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md)).

- Surfaces / elevation used: `--md-surface-container` pill + dropdown at `--md-elev-2`.
- Components used: icon button, text field (borderless, inside the pill), menu/list of
  result rows, leading avatar chips.
- Color roles used: result icons use `secondary-container` (person) and
  `primary-container` (circle); text uses `on-surface` / `on-surface-variant`.
- Feature-specific layout/motion: collapsed→open is a width transition; the dropdown
  fades/slides in. On mobile the open field grows with `flex: 1` to fill the row left of
  the gear and the dropdown spans that width. The "sign in to save" banner is capped to
  `calc(100vw - 132px)` and hidden while search/settings is open, via `.is-search-open`
  / `.is-settings-open` on `.app-shell`.
- Known gaps vs. the Material 3 target: no keyboard arrow-key navigation through results
  yet (Enter picks the first match only); no result highlighting of the matched substring.

## Code

- Main file(s): [`../../src/App.tsx`](../../src/App.tsx),
  [`../../src/index.css`](../../src/index.css) (`.search-box`, `.search-results`).
- Key functions / components: `focusCameraOnWorld` (eased camera fly reusing
  `driveCamera`), `handleSelectSearchResult`, `handleImportLinkedInProfileFromSearch`,
  `closeSearch`, `SearchIcon`; the `searchResults` memo builds the matches and injects
  the LinkedIn import action when the query is a profile URL.
- Related state / hooks: `searchOpen`, `searchQuery`, `searchInputRef`,
  `searchPanelRef`, `focusAnimRef`; the shared outside-click effect handles dismissal.

## Open questions / TODO

- Arrow-key navigation + highlighting the matched substring in results.
- Possibly search note/connection text too, not just name/role.
