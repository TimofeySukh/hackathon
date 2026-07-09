# Board search

## Purpose

Let the user jump straight to someone (or to a circle/"tag") on a large board instead
of panning and zooming to hunt for them. Type a name, pick a result, and the board
selects the node and flies the camera to it at a comfortable zoom.

## Behavior

- A magnifier pill sits in the top toolbar, immediately left of the settings gear.
  Collapsed it is an icon button; tapping it expands an inline text field and focuses it.
- The first time a user opens search, a small hint explains that a LinkedIn profile URL can
  be pasted there to add that person to the board. The hint is tracked locally and only
  appears once per browser.
- Typing filters live with deterministic hybrid ranking. People and circles are indexed
  in memory for the query, then separate exact-name, name-token, role/headline, notes,
  circle-path, link, and coverage arms are fused with an RRF-style score. People are
  listed first unless the query asks for circles/tags; results are capped at 8. Subtitles
  show `Circle › … · role` when available.
- Signed-in users can type natural-language queries, including multi-word and scoped
  queries. After a short pause the app calls `POST /v1/search/smart` and replaces results
  with AI-ranked matches. See [`smart-search.md`](smart-search.md).
- Pasting a LinkedIn profile URL (`linkedin.com/in/...` or `linkedin.com/pub/...`)
  shows an "Add LinkedIn profile" action at the top of results. Clicking it, or
  pressing Enter while it is first, imports the profile into the board.
- LinkedIn profile import normalizes the URL, tries to read public Open Graph metadata
  for name, headline/company, and avatar only when server-side enrichment misses core
  fields, then falls back to the URL slug when no backend enrichment is available.
- New company circles created by manual LinkedIn profile import use the same stable
  deterministic tone assignment as ZIP imports. Legacy default-blue LinkedIn companies
  without a custom color are corrected on update, while the built-in SocialDataNode
  onboarding company remains blue.
- Signed-in users get server-side LinkedIn profile enrichment for manual one-profile
  imports only. The result provides name, current company, headline, avatar, and profile
  description when those fields are available. The headline and description are saved as
  regular person notes titled "Headline" and "Profile".
- Manual LinkedIn enrichment checks the existing graph first and then a local per-URL
  cache before calling the server, so repeated imports of the same profile avoid another
  provider request. LinkedIn ZIP import does not use server-side profile enrichment.
- Local development can opt into an unauthenticated enrichment test path with a matching
  local Vite secret and Edge Function test secret. Production must not set that test flag.
- If server-side enrichment explicitly fails, the import shows an error and does not
  create a fallback person with `Unknown Company`.
- The result list is keyboard navigable. `ArrowDown` / `ArrowUp` move the active
  option, `Home` / `End` jump to the first or last option, and `Enter` picks the active
  option. Moving the pointer over a row also updates the active option.
- Picking a result (click or Enter on the active match) selects the node — opening the
  inspector — and animates the camera so the node sits slightly above screen centre
  (clear of the bottom inspector). Zoom is a fixed 1.5× for a person and fit-to-circle
  for a circle.
- Closing: the × clears the field; clicking outside, pressing Escape, or opening the
  settings panel closes search. Search and settings are mutually exclusive.
- Empty query usually shows nothing, except for the one-time LinkedIn URL hint. A query
  with no matches shows "No matches".

## Design

Reuses the Material 3 chrome language (see [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md)).

- Surfaces / elevation used: `--md-surface-container` pill + dropdown at `--md-elev-2`.
- Components used: icon button, text field (borderless, inside the pill), menu/list of
  result rows, leading avatar chips/initials for people, and leading tonal icons for
  circles/import actions.
- Color roles used: result icons use `secondary-container` (person) and
  `primary-container` (circle); text uses `on-surface` / `on-surface-variant`.
- Feature-specific layout/motion: collapsed→open is a spring width transition; the
  dropdown fades/slides/scales in, and result rows stagger in by index. Active rows use
  a Material state layer instead of a hard selected outline. On mobile the open field
  grows with `flex: 1` to fill the row left of the gear and the dropdown spans that
  width. The first-run LinkedIn URL hint uses `primary-container` and the same dropdown
  elevation/motion as search results.
- Known gaps vs. the Material 3 target: no result highlighting of the matched substring.

## Code

- Main file(s): [`../../src/App.tsx`](../../src/App.tsx),
  [`../../src/index.css`](../../src/index.css) (`.search-box`, `.search-results`).
- Key functions / components: `focusCameraOnWorld` (eased camera fly reusing
  `driveCamera`), `handleSelectSearchResult`, `handleImportLinkedInProfileFromSearch`,
  `closeSearch`, `SearchIcon`; the `searchResults` memo builds the matches and injects
  the LinkedIn import action when the query is a profile URL.
- Backend: `supabase/functions/enrich-linkedin-profile/index.ts` calls the server-side
  LinkedIn profile provider with `LINKEDIN_ENRICHMENT_API_KEY` after validating the
  user's Supabase session.
- Related state / hooks: `searchOpen`, `searchQuery`, `showSearchLinkedInHint`,
  `activeSearchIndex`, `searchInputRef`, `searchPanelRef`, `focusAnimRef`; the shared
  outside-click effect handles dismissal.

## Open questions / TODO

- Highlighting the matched substring in results.
- Move signed-in search from per-request JSONB scans to persisted projection tables once
  the fast search plan lands.
