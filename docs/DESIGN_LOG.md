# Design Log

An append-only log of durable design decisions worth remembering: chosen directions,
deliberate deviations, rejected options, and "we tried X, it didn't work" notes. This is
the project's design memory — when something comes up that future work should not have to
rediscover, write it here.

## Maintenance Rule

- Add an entry whenever you make a design decision that outlives the current change: a
  new pattern, a deviation from [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md), a rejected
  alternative, or a constraint discovered in practice.
- Keep entries short and factual. Newest at the top.
- Use the format: date, title, decision, and (when useful) why and what was rejected.
- If a decision changes the global design language, also update
  [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) so the spec stays the single source of truth.

## Entries

### 2026-06-30 — Keep auth callbacks on the board route while sessions restore

- Decision: login flows now include a `sdn_auth_return=board` callback URL parameter and
  mirror that return marker in `localStorage` and `sessionStorage`. Supabase callback
  parameters are also treated as a board return on the first render, and the client
  consumes the marker once authenticated.
- Why: a slow Supabase session restore could otherwise show the landing page first, and
  provider or allowlist handling can drop custom query parameters before the frontend
  sees them.

### 2026-06-30 — Keep landing reachable after sign-in

- Decision: authenticated users are no longer redirected from the landing page to
  `#board`. Landing, docs, contact, and privacy remain reachable after sign-in; the board
  opens only from an explicit board CTA, a direct `#board` URL, or an auth callback return
  marker from a login flow.
- Why: signing in should not make the marketing and public information pages inaccessible
  or create surprising navigation.

### 2026-06-30 — Keep Supabase auth callbacks off the hash router

- Decision: Google OAuth, email confirmation, and password recovery callbacks now return
  to the clean app origin/path without `#board`; auth callback flows use a stored return
  marker to open the board only after Supabase has restored the session.
- Why: Supabase Auth uses callback URL parameters/fragments to exchange or detect the
  session. Mixing those callback values with the app's hash router can leave production
  users back on the landing page as anonymous after sign-in.

### 2026-06-29 — LinkedIn Company Imports Use Stable Mixed Tones

- Decision: new LinkedIn company circles get a deterministic tone from the circle palette
  based on their company id instead of always using blue. Existing company circles keep
  their saved tone during re-imports, except legacy default-blue LinkedIn companies
  without custom colors are corrected to the deterministic tone.
- Decision: the built-in `SocialDataNode` onboarding/import company remains blue.
- Why: one onboarding/profile special case should not make large LinkedIn ZIP imports
  visually collapse into a single-color board.

### 2026-06-29 — Graph Persistence Sanitizes JSONB Text

- Decision: browser and `graph-api` board writes sanitize text before storing the graph
  in `user_graphs.graph`, removing NUL characters and replacing invalid lone UTF-16
  surrogate code units.
- Why: LinkedIn exports and other imported data can contain malformed text that is valid
  enough to sit in browser state but reaches Supabase/PostgREST as `PGRST102` "Empty or
  invalid json" when the whole board graph is written as one JSONB blob.

### 2026-06-29 — Pull-based production promotion

- Decision: Production deploys through a manual GitHub workflow that promotes a reviewed
  branch, tag, or commit SHA to the `production` branch. The home server polls
  `production` from cron and deploys changed commits from inside the network.
- Why: The production server can sit behind a home NAT without public inbound SSH, while
  releases are still explicit and no longer happen automatically on every `main` push.

### 2026-06-29 — Import Persistence Recovers From Graph API Failures

- Decision: browser graph saves still use `graph-api` first, but fall back to direct
  Supabase RLS writes when the function returns a non-conflict failure. The direct
  fallback uses explicit PostgREST `fetch` calls with pre-serialized JSON instead of
  `supabase.from().update({ graph })`.
- Decision: graph API replacement conflicts include the latest `revision` in `409`
  responses, and the browser can recover via `/graph/meta` or direct revision reads when
  an older function omits it.
- Why: imports previously depended on a single Edge Function save path. A stale or failing
  deployed function could return a generic "Unexpected graph API error" and block a ZIP
  import even though the authenticated browser session still had permission to save its
  own `user_graphs` row. Large graph blobs also previously reached PostgREST as invalid
  JSON through client-library serialization, so fallback writes keep serialization
  explicit and testable.

### 2026-06-28 — Local Import Persistence E2E

- Decision: add `npm run test:ui-import:persistence`, a Playwright test that runs the app
  with dev-only fake auth and a localhost mock Supabase graph API.
- Why: import persistence bugs must be reproducible locally. The test covers LinkedIn ZIP
  import, graph JSON import, signed-in graph replacement writes, and reload persistence
  without touching production Supabase. It also covers replacing the saved graph after an
  initial graph load failure, matching the failure mode where a large or bad saved graph
  blocks imports by leaving the browser without a loaded revision.
- Decision: graph API catch-all errors now format structured error objects instead of
  returning a generic "Unexpected graph API error."

### 2026-06-29 — Realtime Ignores the Current Tab's In-Flight Save

- Decision: signed-in board persistence tracks the graph currently being saved and treats
  the matching Supabase Realtime `UPDATE` as an acknowledgement of that local save.
- Decision: while a save is in flight, the debounced autosave waits for the next known
  revision before writing newer local edits.
- Why: Realtime can deliver the database update before the original `saveGraph()` promise
  resolves. The web app was sometimes classifying its own save as an external change,
  pausing autosave, and making later local edits look like a remote conflict.

### 2026-06-28 — Imported Graphs Flush Immediately

- Decision: LinkedIn ZIP imports and graph JSON imports now write the resulting graph to
  the active storage backend immediately after replacing React state, instead of relying
  only on the debounced autosave effect.
- Decision: signed-in graph persistence now writes through the existing `graph-api`
  Edge Function replacement route instead of hitting the `user_graphs` PostgREST table
  endpoint directly from the browser.
- Decision: the debounced signed-in autosave skips writes when the current graph matches
  the last saved snapshot, so an immediate import flush is not followed by a duplicate
  revision bump.
- Why: manual edits were persisted reliably, but bulk/import paths could be lost after a
  reload if the page closed before the debounce completed, if import code mutated the
  current graph before React observed a distinct state change, or if browser-to-PostgREST
  write serialization reached the table endpoint as invalid JSON.

### 2026-06-27 — Public Privacy Policy Page at `#privacy`

- Decision: ship a dedicated Privacy Policy screen at `#privacy` (`PrivacyPage.tsx`) instead
  of burying legal text in the landing footer. Link it from footers and the auth dialog.
- Why: OAuth and compliance forms require a stable public URL that matches actual data
  handling (Supabase auth/graph storage, browser localStorage for anonymous users, Bright
  Data LinkedIn enrichment, hashed agent tokens).
- Rejected: a generic template that claims analytics, sharing, or features the product does
  not implement.

### 2026-06-25 — Agent Best Practices and MCP Contract Hardening

- Decision: added `docs/AGENT_BEST_PRACTICES.md` as the project-local summary of the
  local `agents-best-practices` rules for MCP tools, permissions, structured results,
  and API/CLI/MCP parity.
- Decision: the MCP server now exposes strict schemas, risk metadata, MCP annotations,
  compact `list_capabilities` discovery, and structured JSON result envelopes with
  `status`, `summary`, `data`, and `next_valid_actions`.
- Decision: API `/operations` parity is extended to the shared API client, CLI
  `operations:run`, and MCP `batch_operations`.
- Why: agent-facing tools need narrow contracts, legible results, and synchronized public
  documentation so remote agents can safely inspect and edit the user-owned graph.

### 2026-06-24 — Real-time Synchronization via Supabase Realtime

- Decision: enable Supabase Realtime Database Changes on the `user_graphs` table, allowing the frontend to subscribe to the row modifications matching the logged-in user's ID.
- Decision: when a remote change is received, the frontend checks if the user has unsaved modifications. If not, the UI is updated automatically. If yes, a conflict warning banner is displayed and autosaving is paused to protect user data from overwriting.
- Why: allows multi-tab and multi-device/CLI/agent edits to sync automatically without requiring page reloads or polling the database, while maintaining strict optimistic concurrency control.

### 2026-06-24 — Universal MCP and CLI Execution and Height Stability

- Decision: the agent settings dialog `.agent-settings-dialog` is given a stable height of `height: min(680px, calc(100vh - 64px))` on desktop and `height: min(680px, calc(100vh - 24px))` on mobile.
- Decision: the package name is renamed to `datanode-mcp` and two `bin` executables are exposed in `package.json` (`datanode-mcp` and `datanode-cli`), allowing both the MCP server and CLI tool to be run/installed universally via `npx` or `npm install -g` anywhere.
- Decision: keeping the public web developer documentation (`src/DocsPage.tsx`) synchronized with any API, CLI, or MCP modifications is added as an explicit rule in `AGENTS.md`.
- Why: switching tabs in settings was causing vertical dialog height shifts depending on the tab's content. Universal `npx` execution allows any remote AI agent or user to install and launch the MCP server/CLI without requiring a local clone. Keeping public docs synchronized ensures that remote agents or external builders can always read accurate API schemas on the live site.

### 2026-06-24 — API Writes Are Revision-Checked

- Decision: signed-in autosave, CLI, and MCP/API writes use `user_graphs.revision` as an
  optimistic concurrency guard. Stale writers are rejected with a conflict and must reload
  before saving again.
- Why: multiple browser tabs or remote agents can otherwise overwrite a newer graph blob
  with older local state.

### 2026-06-24 — Agent Access Uses Revocable Scoped Tokens

- Decision: remote agent access goes through the `graph-api` Edge Function and hashed
  `agent_tokens`, not direct Supabase credentials. Tokens resolve to one owner user and
  carry explicit scopes.
- Why: MCP/CLI clients need copy-paste setup, revocation, and user isolation without
  exposing service-role keys or accepting caller-provided user ids.

### 2026-06-24 — Person Data Has No Hidden Role Field

- Decision: `PersonNode.role` was removed from the app model. People expose name,
  owning circle, notes, connections, avatar, favorite state, and visual placement/style.
  LinkedIn headlines and ZIP import positions are stored as notes instead of a hidden
  subtitle field.
- Why: the product UI no longer has a role/title field, and keeping an invisible field
  made API planning and search behavior confusing.

### 2026-06-24 — Remove Pre-User Legacy Data Paths

- Decision: the app now uses only the `user_graphs` blob for signed-in board persistence
  and `localStorage` for signed-out editing. The old normalized-table frontend layer,
  AI note/search Edge Functions, local MCP server, demo seed scripts, and legacy graph
  fallback were removed.
- Why: there are no existing production users to migrate, so keeping unused storage paths
  and service-role tooling adds security and maintenance risk without product value.

### 2026-06-23 — Protect Graph Persistence During Backend Migrations

- Decision: signed-in graph loading now records whether data came from the current
  `user_graphs` blob, the legacy normalized tables, or a truly empty account. A truly
  empty fresh graph is not immediately autosaved back to Supabase until the user changes
  it, and missing `user_graphs` data falls back to legacy `boards` / `people` / `notes`
  when those tables exist.
- Why: a backend/project/schema mismatch can otherwise make a real user's board appear as
  a single fresh `You` circle and then persist that empty graph via debounced autosave.
  Empty-load states must be treated as suspicious during migrations, not as data to write
  immediately.

### 2026-06-23 — Local-only LinkedIn enrichment test bypass

- Decision: local Vite can send `x-linkedin-enrichment-test-secret` for manual
  LinkedIn profile import testing when `VITE_LINKEDIN_ENRICHMENT_TEST_SECRET` is set.
- Decision: the Edge Function accepts that bypass only when
  `LINKEDIN_ENRICHMENT_ALLOW_TEST_AUTH=true`, the matching test secret is configured,
  and the request origin/referrer is localhost.
- Why: local UI tests need to exercise the full import path without depending on a
  personal browser login, while production must keep unauthenticated enrichment blocked.

### 2026-06-23 — LinkedIn profile enrichment stays provider-neutral in product surfaces

- Decision: manual LinkedIn profile import UI, docs, and generated person notes describe
  the flow as server-side profile enrichment without naming the underlying provider.
- Decision: imported remote avatar URLs draw person initials while loading or after
  image failure, then repaint to the photo if it successfully loads.
- Data mapping: the enrichment function accepts more provider field variants for current
  company, avatar URL, headline, and About/profile description so profile notes are
  created when the upstream payload includes that data.
- Why: the provider is infrastructure, while users need stable profile data and readable
  board nodes even when a remote photo URL is blocked or expired.

### 2026-06-21 — Keep password recovery success visible

- Decision: password recovery now has a final `Password updated` dialog state after
  `supabase.auth.updateUser({ password })` succeeds, instead of immediately hiding the
  auth dialog as soon as the recovery session becomes a normal authenticated session.
- Why: e2e testing through Mailtrap confirmed the recovery link, `PUT /auth/v1/user`, and
  new-password sign-in all work, but the previous UI jumped straight back to the board and
  hid the success notice.
- Test setup: local Mailtrap Sandbox credentials live in ignored `.env.auth-test.local` so
  future sessions can rerun auth email e2e without recreating the inbox credentials.

### 2026-06-20 — Make email auth a recovery-capable Material 3 dialog

- Decision: email/password auth stays minimal: registration asks only for email and
  password, keeps confirmation, and adds resend confirmation plus password reset/recovery.
- Decision: password reset request copy is generic so the dialog does not reveal whether an
  email address is registered; recovery links open the app directly into a new-password
  state via Supabase's `PASSWORD_RECOVERY` event.
- Decision: the auth surface is now a Material 3 dialog on desktop and a compact bottom
  sheet on mobile, using rounded tonal input shells, tonal notices, and password-manager
  friendly autocomplete attributes.
- Decision: bottom-rule text fields are not an app pattern. Auth inputs use the same
  rounded family as search and existing composers.
- Follow-up: Supabase confirmation and recovery email templates still need Dashboard
  customization for a fully branded email experience.

### 2026-06-20 — Replace Social Datanode brand mark

- Decision: replaced the legacy purple lightning favicon and CSS-generated landing marks
  with the provided SDN concentric-node SVG.
- Scope: the shared SVG now lives in [`src/assets/sdn-logo.svg`](../src/assets/sdn-logo.svg),
  the browser favicon uses the same artwork via [`public/sdn-favicon.svg`](../public/sdn-favicon.svg)
  so production browsers request a new icon path instead of reusing stale `/favicon.svg`
  tab-icon caches, and the landing header/footer plus auth loading mark render it as an image.
- Follow-up: added PNG/ICO/apple-touch/manifest favicon variants and no-cache nginx handling
  for icon files because browsers may ignore SVG favicons or keep favicon resources in a
  separate long-lived cache.
- Why: the product should show a single brand mark across the browser chrome and in-app
  surfaces instead of mixing the old lightning, generated gradient blocks, and text-only
  placeholders.

### 2026-06-17 — Grow imported company circles by final member count

- Decision: LinkedIn ZIP re-imports and single-profile enrichment now grow existing
  company circles to the `packedCircleRadius` required by their final member count. New
  profile imports use the same sunflower slots as ZIP imports instead of a fixed 35px
  ring.
- Decision: `packedCircleRadius` includes `IMPORT_CIRCLE_RADIUS_PADDING` so imported
  company circles have visual breathing room when large boards skip global layout cleanup.
- Decision: saved graphs are normalized on load with the same packed-radius rule for
  LinkedIn company circles, so older undersized boards recover after reload. Loading does
  not repack positions, because changing saved circle coordinates on every load reads as a
  board teleport.
- Decision: top-level LinkedIn company circles are repacked after ZIP imports/re-imports,
  with contained people translated by the same delta as their company circle.
- Why: after removing global O(n²) cleanup from interactions, undersized existing company
  circles no longer got expanded or moved apart as a side effect, so contacts could
  visually spill beyond their circle or grown circles could cover neighboring companies.

### 2026-06-17 — Stop global layout during live board interactions

- Decision: drag and resize pointer-move frames no longer call the global
  `ensureContainment` collision relaxer. They update only the actively moved/resized
  nodes. On pointer-up and related single interactions, the global relaxer runs only while
  the board is at or below `BOARD_INTERACTION_LAYOUT_LIMIT`.
- Decision: person membership edges render only for people in the viewport, avoiding a
  full fan-out over every offscreen member of a visible company circle.
- Why: on dense LinkedIn imports, any direct manipulation could trigger repeated O(n²)
  collision passes, causing severe lag and sometimes visually bunching circles and people
  after the interaction.
- Tradeoff: large boards favor responsiveness and preserving the packed import geometry
  over automatic full-board collision cleanup after every gesture.

### 2026-06-17 — Hide automatic links from `You` to circles

- Decision: the canvas no longer renders automatic circle links whose source is the
  central `You` circle. New LinkedIn company circles are also created without
  `connectedTo: 'you'`.
- Why: large imports produced a dense starburst from the board center to every company
  circle. Those lines are generated placement scaffolding, not meaningful authored
  relationships, and they make the board unreadable.
- Kept: explicit user-created connections and non-center circle links still render.

### 2026-06-15 — Circles load transparent and clean by default

- Decision: fresh graph circles, newly created circles, imported LinkedIn company
  circles, and synthetic load-test circles now start as transparent clean circles
  (`shapeType: 'circle'`, `sides: 25`, `amplitude: 0`).
- Decision: removed persisted circle creation style defaults. Editing fill, Wavyness, or
  Edges changes only the selected circle; it no longer makes future circles inherit that
  shape/fill. Per-circle shape edits now record `shapeCustom`; on load, unmarked legacy
  circle styles are normalized back to clean transparent circles so old saved defaults do
  not reappear as flowers.
- Why: the board should open as a quiet circle map. Figure shapes are a deliberate
  per-circle styling choice, not the default visual language.

### 2026-06-15 — Bulk import lays out non-overlapping up front (no collision-storm freeze)

- Problem: importing a large LinkedIn ZIP dropped every company onto one 680px ring
  and every person onto a fixed 35px ring around the company centre. Hundreds of
  circles and people landed on top of each other, so the O(n²) collision relaxer
  (`resolveCollisions` in `src/lib/board/layout.ts`) had to untangle the whole
  pile-up — which froze the tab on import and left the board at ~1 FPS afterwards.
- Decision: build a deterministic, **non-overlapping** layout at import time instead
  of relying on the relaxer:
  - **People** are placed inside their company with a sunflower / phyllotaxis packing
    (`personPackOffset`). The golden-angle spiral's minimum nearest-neighbour distance
    is ~1.657× the spacing constant, so `PERSON_PACK_SPACING = 28` keeps everyone ≥46px
    apart (`2*PERSON_COLLISION_RADIUS + PERSON_COLLISION_GAP`). The inner offset puts the
    first point at 56px so it clears the centre handle.
  - **Company radius** is sized to its member count up front (`packedCircleRadius`) so
    people fit without forcing the circle to grow.
  - **Company circles** are packed into compact concentric rings around `you`
    (`packCirclesInRings`), provably non-overlapping for variable radii, starting beyond
    any existing top-level circle so a re-import never lands on existing content.
  - The global `ensureContainment` (O(n²)) is **skipped above `IMPORT_LAYOUT_LIMIT`
    (1500 nodes)** — the packed layout is already clean, so the relaxer would only
    re-freeze the tab. Below the limit it still runs to tidy edge cases. This mirrors
    the existing `MERGE_LAYOUT_LIMIT` pattern.
- Verified: a geometry check on 32,665 people / 600 companies (skewed sizes, biggest
  1,901) found zero circle overlaps, zero person overlaps, everyone inside their circle
  and clear of the centre. `test:ui-import` at 8,000 people / 500 companies and 8,000 /
  1 imports in ~0.4s with ≤26ms event-loop lag (was a multi-second freeze).
- Out of scope (still O(n²), separate follow-up): the steady-state render overdraw of
  membership edges (the "fan" from hub circles) and dragging a node on a huge graph,
  which still calls `ensureContainment`. The shared collision core would need a spatial
  grid to fix those.

### 2026-06-15 — Circle-style popover anchors above the palette icon; shape controls moved in

- Decision: the "Customize circle" popover (`.circle-style-popover`) was `position: fixed`
  with hardcoded `right: 24px; bottom: 124px` — it floated at the bottom of the viewport,
  detached from the palette icon that opens it. Now it's `position: absolute` anchored to
  `.inspector-visual-row` (made `position: relative`), opening **above** the icon
  (`bottom: calc(100% + 12px); right: 0`), `transform-origin: bottom right` so it scales up
  from the icon. The inspector has no `overflow` clip, so absolute positioning isn't clipped.
  Mobile (`max-width: 720px`) keeps the fixed-bottom sheet.
- Decision: moved the Wavyness (wave `M3Slider`) and Edges (`M3Slider`) controls out of the
  always-visible inspector body row (`.circle-quick-sliders`) and **into the popover**, after
  the color presets, so all circle customization (fill mode, color, shape) lives in one
  surface. No duplication — there's a single set of sliders now, inside the popover.

- Decision: hover feedback "breathes" toward the user via a small spring scale instead of
  a vertical `translateY` lift, which read as boring/un-M3. Cards/CTA buttons grow slightly
  on hover (`scale(1.01`–`1.03)`) with `--md-ease-spring`, squash on press (`scale(0.96`–
  `0.985)`), so the arc is rest → hover-grow → press-squash → spring-back. Applied to
  `.feature-card`, `.m3-btn`, `.m3-primary-button`, `.primary-action`,
  `.onboarding-coach__primary`, `.trello-card`, `.connection-item__main`. **No `translateY`
  on hover anywhere** (verified there are zero hover rules with translateY).
- Why: vertical lift is the most generic hover trope and isn't an M3 hover pattern (M3 hover
  is a state layer; M3 Expressive adds spring physics). Springy scale keeps the state layer
  and reads as alive without the jump. Rejected: pure state-layer only (too subdued for the
  user); shape-morph on hover (already rejected for chrome buttons — see the 2026-06-15
  "Keep Chrome Button Hover Pill-Shaped" entry).
- Motion tokens audited against the M3 spec (m3.material.io/styles/motion/easing-and-duration):
  `--md-ease-standard` (`0.2,0,0,1`), `--md-ease-decelerate` (`0.05,0.7,0.1,1` = emphasized
  decelerate), `--md-ease-accelerate` (`0.3,0,0.8,0.15` = emphasized accelerate) are all
  spec-correct. **`--md-ease-emphasized` was a fake** (it held standard); M3 "Emphasized"
  (in-out) is a two-segment spring path that cannot be one cubic-bezier, so it's now an
  explicit alias of standard with a note: in-place→standard, enter→decelerate, exit→accelerate.
  `--md-ease-spring` (`0.34,1.45,0.5,1`) overshoots past 1, so it is documented as
  transform/geometry-only — putting it on opacity/color makes the value overshoot its range
  and flash (this bit us before). Durations (`120/220/320ms`) are deliberately ~30% faster
  than the M3 duration tokens (snappy UI) — kept as-is.
- M3 cleanup in the same pass: removed all `text-transform: uppercase` eyebrows (6 spots)
  in favor of M3 sentence case; bumped those 11px labels to 12px (label-medium, on-scale);
  `font-weight: 800` → 500 on the LinkedIn search icon; replaced hardcoded
  `rgba(28,37,40,*)` grays with `--md-on-surface-variant` / a tonal divider.
- Text fields: the connection composer (`.connection-composer input`) and the generic
  inspector text field (`.inspector-field input[type="text"]`) were *outlined* (1px border
  that became a full blue ring on focus, on a pill) — ugly. **Final recipe: filled
  rounded-rectangle.** Tonal `--md-surface-container-highest` fill, **no border, no underline,
  no focus ring**, `--md-r-sm` (8px — reads as a rectangle, not a pill, not the asymmetric
  rounded-top/flat-bottom), 14px text; focus is a subtle fill deepen only. Iteration history
  (all rejected): (1) original outlined pill; (2) M3 filled-with-bottom-underline (rounded
  top + flat bottom + 2px line — "square bottom + a line for no reason"); (3) full filled
  pill `--md-r-full` (like the search box — clean but the user wanted a rectangle shape).
- Note editor (`.trello-list__composer-card`): dropped the `:focus-within` bottom underline
  (`inset 0 -2px primary`) — same "полоса" problem. Then dropped the focus fill-deepen too —
  it darkened the card toward the list container and made it blend in. **The note card keeps
  its resting light `--md-surface-container-low` at all times**; focus is shown only by the
  caret. Note text bumped to on-scale 14px (body-medium); the card stays `--md-r-md`.
- **Local rule — notes/connections menu uses rectangular buttons, not pills.** Within the
  inspector notes + connections composer, the action buttons (`.trello-list__composer-add-btn`
  "Save note", `.trello-list__composer-cancel-btn` discard, `.trello-list__add-btn` new note,
  and `.connection-composer button` Save) are `--md-r-sm` (8px) to match the rounded-rectangle
  fields in the same dense panel. This is a deliberate deviation from the global "buttons are
  pills" rule, scoped to this menu only, for shape consistency with the fields next to them.
- Audit pass: fixed the color-select dropdown (`.custom-select-dropdown`) from hardcoded
  `#fff` + Atlassian `rgba(9,30,66,*)` shadow + `14px` radius → `--md-surface-container` /
  `--md-elev-2` / `--md-r-md`, no border. Aligned stray off-scale sizes (12.5/11.5→12,
  stress dd 15→14, search input 15→16, inspector name 21→22). **Remaining off-scale (not
  yet changed, lower priority):** ~20 `13px` uses (mostly landing + LinkedIn-guide), and the
  onboarding/landing display sizes (17/18/44/48/56px).

### 2026-06-15 — Persist Circle Shape and Fill Defaults

- Decision: the compact circle quick card keeps Wavyness and Edges directly visible next
  to the fast color/fill/avatar controls. Fill, Wavyness, and Edges also persist to
  `localStorage` as defaults for newly created circles. Color is intentionally excluded
  from the defaults so new circles keep the automatic tone assignment.
- Why: a user who likes a particular circle shape should not have to repeat it for every
  new circle, while keeping color automatic prevents new circles from all blending into
  the same category.

### 2026-06-15 — Search and Person Inspector M3 Interaction Pass

- Decision: search results now behave like an M3 suggestion menu: animated surface
  entrance, staggered row entrance, active-row state layer, leading person avatars or
  initials, and keyboard navigation with ArrowUp/ArrowDown/Home/End/Enter.
- Decision: person notes moved away from Trello-specific white cards, raw hex colors,
  and instant hover changes. Notes now use filled Material 3 cards on tonal surfaces,
  plus hover/focus lift, press feedback, animated editor/composer entry, and M3 role
  colors for actions.
- Decision: connected swatch/preset press feedback is quieter: press scales down and
  neighbors only shift a small amount. The previous elastic wobble was expressive but
  too visually loud for repeated color/style work.

### 2026-06-15 — Motion physics spring return & theme tabs restoration

- Decision: restored the `Solid / Transparent` segmented theme tabs to the original sliding pill capsule container utilizing the `SelectionIndicator` component (pill variant). Unselected tabs now have a hover overlay (`background: color-mix(...)`) to indicate interactivity.
- Decision: implemented bouncy, asymmetric spring-back keyframe animations (`@keyframes swatchSpringBack`, `@keyframes swatchNeighborLeftSpringBack`, and `@keyframes swatchNeighborRightSpringBack`) with decaying wobbles over a 350ms duration when `.is-returning` is active. This replaces the linear return transitions, introducing organic motion physics to the color swatches and preset buttons.
- Decision: added transitions on `left`/`top` properties to the color picker thumb and brightness slider thumb (`var(--md-dur-medium)` + `var(--md-ease-spring)`), enabling them to glide and overshoot slightly when landing on new coordinates from preset selects. Drag responsiveness is kept instant (zero latency) by overriding transitions to `none` during active pointer interaction (`:active`).
- Decision: wired the transparency toggle button (`.circle-fill-toggle`) into the same pointer-down/pointer-up hooks and `.is-pressing` / `.is-returning` CSS classes as the color swatches. The button now squashes horizontally on press down and plays a spring-back wobbly keyframe animation on release, matching the tactile physical behavior of neighboring swatch buttons.

### 2026-06-15 — Fixed shape morphing animation & incorrect corners at waviness 0

- Decision: fixed the board animation loop (`tickBoardAnims` in `src/App.tsx`) where animation parameters (like `morph`) were dropped during the first-frame anchoring phase. Fixing this allows the shape morph animation to execute fully rather than snapping instantly.
- Decision: enabled smooth transition of both amplitude and sides/corners during morphing by retaining from/to shape types and sample configurations in `CircleMorph`.
- Decision: corrected polygon/corner rendering at waviness 0 (`amplitude === 0`). The canvas engine's sampling function (`circleRadiusAtAngle` in `src/lib/board/geometry.ts`) now accepts the node's `shapeType` parameter. It renders a clean circle when `shapeType` is `'circle'` (or `'wavy'` with 0 amplitude), preventing corners from appearing on circles and newly created avatar nodes that happen to have discrete `sides < 25`.

### 2026-06-15 — Re-enabled circle shape controls + amplitude shape-morph

- Decision: re-enabled per-circle shape editing. `getCircleRenderPath` (`src/lib/board/render.ts`) used to force a clean circle in the default `circles` mode (a guard from the old demo-seed era, now obsolete since boards start blank). It now honours a circle's authored shape whenever it's *customised* (`amplitude > 0 || sides < 25`), while untouched circles still render as clean circles. So the Wavyness/Corners sliders actually change the shape again.
- Shape morph: changing **amplitude** animates smoothly via the board anim loop (`morph:<id>` BoardAnim with `{from,to}`, eased in `readAnimFrame`, applied through `AnimFrame.amplitudes` → `getCircleRenderPath` override). Only triggered on jumps (`|Δ| > 3`, e.g. tapping the track) — fine drag is already live. **Sides do not morph** (vertex/lobe count is discrete; fractional `sides` breaks the wavy seam and polygon vertices), so Corners snaps.
- Picker presets: reduced to 8 and re-curated so they're distinct from the five quick-swatch tones (teal/cyan/deep-purple/magenta/brown/slate/lime/coral) — the presets now add reach instead of repeating colors already one tap away. Popover section spacing unified to 12px.

### 2026-06-15 — M3 sliders (incl. wavy slider) + corrected connected-group press

- Decision: added a reusable `M3Slider` (`src/components/M3Slider.tsx`) — the canonical slider for the app (thick track, vertical pill handle, gap each side). Its `variant="wave"` draws the active track as a sine wave whose amplitude grows with the value (M3 Expressive wavy slider). Used it in the circle picker: replaced the two bottom rows of color presets (24 presets → top row of 8 kept) with two sliders — **Wavyness** (wave variant → circle amplitude) and **Edges** (plain → sides). The Wavyness slider's wave mirrors exactly what it controls. Removed the old hidden native `input[type=range]` shape controls.
- Corrected the connected-group press (from the earlier same-day entry): it is **not** "pressed grows, all others shrink". Per M3, only the **immediate neighbours** react and each recoils *away* from the pressed item. Implemented with adjacency combinators: `.item:has(+ .item:active)` (left neighbour → `translateX(-5px)`), `.item:active + .item` (right neighbour → `translateX(5px)`), pressed `scale(1.12)`, all on `--md-ease-spring`. Round items translate away; rectangular group buttons should instead `scaleX` anchored on their far side (far edge + height fixed, near edge pushes away). Adjacency only works in a single row — which is why presets were reduced to one row.
- Why: the user pointed out the real Google behaviour (neighbours deform, asymmetrically, not the whole group) and asked to surface circle-shape controls as proper Material sliders, with the wave amount integrated into the slider itself.

### 2026-06-15 — Selection motion: shape-morph for swatches, sliding pill for segments

- Decision: replaced per-item `.is-selected { outline }` "blinks" with motion that expresses *continuity* (the core of M3 motion — elements persist and change, they don't spawn/vanish). Two patterns, each matched to its control:
  - **Shape morph** for color swatches and presets: the selected item morphs from a circle to a rounded square (`border-radius: 50% → 8–9px`, animated with `--md-ease-spring`). Reads instantly even between similar colors, needs no extra chrome, and packs tightly.
  - **Sliding pill** (`SelectionIndicator`, `variant="pill"`) for the Transparent/Solid segmented tabs: one persistent pill that translates and resizes under the active segment.
- Added the `--md-ease-spring` token (`cubic-bezier(0.34,1.45,0.5,1)` — fast move with a slight overshoot).
- Also: merged the palette / "more colors" button into the swatch row as a same-size (30px) member (was a larger, separate 40px button that didn't read as part of the colors); it shows the custom color and morphs to a rounded square when custom is the active selection. Fixed swatch flex-shrink (`flex: 0 0 auto`) — they were shrinking to ~24.8px in the `flex:1` row, which also caused the indicator to drift.
- Why we dropped the sliding *ring* for swatches (tried first, removed): a 2px ring with a hole around a circle looked bad mid-slide, and on the already-selected item it only read as "slightly bigger" — ambiguous. Shape morph is unambiguous and is itself a headline M3 Expressive feature.
- Implementation note for `SelectionIndicator`: it finds its container via its own `parentElement` — a child's `useLayoutEffect` runs *before* the parent's `ref` is attached, so passing a `containerRef` prop resolves to null. Siblings carry `data-ind-key`; first placement on mount is instant (`no-anim`), only later moves animate; the transition lives in CSS so `prefers-reduced-motion` collapses it. The `ring` variant still exists in the component for reuse but is currently unused.
- Rejected: per-item outlines (blink, no continuity); animating the node itself on selection (a node *bounce* was tried and removed earlier — selection feedback belongs to the inspector/indicator).

### 2026-06-14 — Landing Page with Animated Orbits and Hash-based Routing

- Decision: Introduced a Google Material 3-style landing page with gently rotating SVG orbits for social nodes and ambient color-mix gradient blobs. Implemented a simple, hash-based view router (`#board` / `?app=true`) coupled with `localStorage` persistence to manage transition between the landing page and the interactive workspace.
- Why: First-time users need a clear, professional visual hook that explains the product's value proposition and features. Using slowly rotating orbits simulates a dynamic network graph that matches the visual language. Hash-based routing prevents screen flashing on refresh and allows returning to the landing page via settings without introducing a heavy router library.

### 2026-06-14 — Circle resize hover state and contact-based element movement

- Decision: when hovering over a circle's edge (resize handle area), render a subtle highlighted stroke even if the circle is selected. When resizing a circle, child elements (sub-circles or people) only move inward if they are touching the boundary being shrunk, rather than scaling uniformly.
- Why: uniform scaling on shrink made internal elements jump inward too quickly and look disconnected from the edge. Restricting movement to contact/collision pushing makes the resize operation feel more physical and intuitive. The edge highlight provides clear affordance that the circle can be dragged to resize.

### 2026-06-14 — Real brand logos for connections and Google sign-in

- Decision: connection chips in the person inspector and the "Continue with Google" button
  use official full-color brand logos instead of monochrome letter/abbreviation glyphs.
  Logos are stored as SVG assets in [`src/assets/brands/`](../src/assets/brands/) and
  imported as URLs (Vite inlines small ones as data URIs), rendered via `<img>` —
  `ConnectionServiceIcon` and `GoogleIcon` in `src/App.tsx`.
- Source: [gilbarbara/logos](https://github.com/gilbarbara/logos) (CC0) for LinkedIn,
  Telegram, Facebook, WhatsApp, X, and the Google "G"; Instagram's gradient badge comes
  from [SuperTinyIcons](https://github.com/edent/SuperTinyIcons) (MIT) because gilbarbara
  only ships a monochrome Instagram glyph. `website.svg` is a hand-made neutral globe
  (no brand exists for "Custom" links).
- Why: the abbreviation chips ("in", "tg", "ig", …) and hand-rolled monochrome SVG paths
  read as placeholder text and looked muddy at 24px. Pre-made, full-color vector logos are
  instantly recognizable and stay crisp at any size.
- Rejected: `simple-icons` (npm) — single-color glyphs only, so no gradient/multi-color
  badges; the package was added then removed. Also rejected hand-authoring brand paths,
  which produced thick, off-color results.

### 2026-06-14 — Manual LinkedIn enrichment runs behind Supabase

- Decision: single-profile LinkedIn imports from board search call a Supabase Edge
  Function that validates the user's session and then calls the configured profile
  provider. ZIP import remains local CSV processing and never uses server-side
  profile enrichment.
- Quota control: the frontend first checks whether the normalized LinkedIn URL already
  exists in the graph, then checks a local 30-day per-URL enrichment cache. The provider
  is only called for uncached manual one-profile imports.
- Data mapping: provider fields normalize into person name, current company circle,
  headline/role, avatar image, and a "Profile" note containing the profile description.
- Why: the provider API key must stay server-side, and the request budget
  should only be spent on explicit manual enrichments.

### 2026-06-14 — Isolated load tests for large imports

- Decision: large import testing now has two automated checks: a dry-run-first database
  payload test for the `user_graphs.graph` blob and a Playwright browser responsiveness
  test that imports a generated LinkedIn ZIP through the real UI.
- Why: testing a 3,000-contact import through a real production account would pollute
  user data and make cleanup risky. The database test writes only after explicit staging
  opt-in, refuses the `.env.production` Supabase URL, creates an isolated auth user, and
  can delete that user after verification.
- Browser behavior: LinkedIn ZIP import now yields to the event loop while grouping and
  creating imported entities, and the import button shows an `Importing...` disabled state
  while work is running. The responsiveness test fails if event-loop lag exceeds the
  configured threshold.
- Rejected: adding hidden dev-only import controls to production UI. The test uses the
  existing settings-panel file input; database writes are isolated in scripts and staging
  credentials instead.

### 2026-06-14 — LinkedIn profile URLs import from board search

- Decision: board search now treats a pasted LinkedIn profile URL as an import action,
  not just a text query. The action creates or reuses a LinkedIn company circle, adds one
  person with the normalized LinkedIn connection link, selects that person, and flies the
  camera to the new node.
- Metadata: the browser makes a best-effort Open Graph read for profile name, headline,
  company, and avatar. LinkedIn commonly blocks cross-origin reads or logged-out profile
  HTML, so the durable fallback is URL-slug-derived name plus `Unknown Company`.
- Why: this keeps the single-profile path structurally aligned with the existing LinkedIn
  ZIP import while avoiding a backend dependency for the prototype.

### 2026-06-14 — Board search: find a person or circle, fly the camera to it

- Decision: a search pill sits in the top toolbar immediately left of the settings
  gear. Collapsed it is a magnifier icon button (same 48px pill as the other chrome);
  tapping it expands an inline input with a live results dropdown. Matching people
  (name + role) come first, then circles — circles are the app's "tags". Picking a
  result selects the node (opening the inspector) and animates the camera so the node
  lands a touch above screen centre at a comfortable zoom: a fixed 1.5× for a person,
  fit-to-circle for a circle. The fly reuses the existing `driveCamera` settle path
  (an eased per-frame `requestAnimationFrame` tween, then commit to React state).
- Mobile: the expanded field grows with `flex: 1` to fill the row left of the gear,
  and the dropdown spans that width. The persistent "sign in to save" banner was the
  collision risk — it is capped to `calc(100vw - 132px)` so it never reaches the
  toolbar buttons, and is hidden entirely (`.is-search-open` / `.is-settings-open` on
  `.app-shell`) while either chrome panel is open. Opening search and opening settings
  are mutually exclusive so their dropdowns can't stack.
- Why: with two top-right buttons plus a wide banner, the old fixed 320px banner
  overlapped the gear on a 375px screen; constraining the banner and giving search/
  settings the row when active keeps the top bar legible on phones.

### 2026-06-14 — Motion: interaction feedback for chrome and canvas

- Decision: every interaction now gives motion feedback instead of an instant state flip.
  Two layers, two mechanisms:
  - **Chrome (DOM/CSS):** the inspector, create menu (with staggered items), custom-select
    dropdown, and merge prompt all animate in with a fade + small translate/scale using the
    new motion tokens. Buttons (filled primary, toolbar icon, menu items) get a `:active`
    press-scale. The inspector re-plays its entrance on each new selection via a React
    `key` on the `<aside>`.
  - **Canvas (transient rAF loop):** the board normally repaints only on state change. A
    small animation registry (`boardAnimsRef`) + a self-pruning `requestAnimationFrame` loop
    (`tickBoardAnims`) drives extra repaints while an effect is in flight, handing each draw
    an `AnimFrame` of per-node scale multipliers. Used for the **grow-in pop** of newly
    created people (`pop:<id>`, easeOutBack from 0).
- Rejected (selection feedback on canvas): both tried and removed.
  - An expanding "pulse ring" overlay — read as an extra decorative element.
  - A **press bounce** of the selected node (scale up then settle) — looked bad in practice.
  Conclusion: a click on a node currently relies on the inspector entrance + the existing
  selection emphasis (thicker stroke / handles) for feedback; no extra canvas motion on
  selection. The rAF infrastructure stays, used only for the creation pop-in.
- Motion tokens live on `.app-shell` (`--md-ease-*`, `--md-dur-*`). All animations collapse
  to an instant final frame under `prefers-reduced-motion: reduce` (CSS guard + a
  `prefersReducedMotion()` check that short-circuits `startBoardAnim`).
- Why: the board looked good at rest but gave no feedback on click. Motion makes interaction
  legible without changing layout or information.

### 2026-06-13 — Circle Picker Affordances and Favorite Treatment

- Decision: new circles always spawn as clean circles (`sides: 25`, `amplitude: 0`) even
  though the hidden shape controls can still revive polygon and flower variants later.
- Decision: the circle quick menu keeps five fast presets, adds a compact fill-mode toggle,
  and opens the full custom picker from the palette button. The custom picker wheel allows
  its thumb to extend past the wheel edge instead of clipping it.
- Decision: favorite people no longer change their primary avatar outline. Favorite state
  is shown as a separate dotted ring around the person, using that person's circle color.
- Why: the quick menu should stay dense and direct, while advanced color work lives in the
  larger picker. Favorite styling should read as an added mark, not as a replacement for
  selection, hover, or circle-color ownership.

### 2026-06-13 — Arc-Like Circle Color Picker

- Decision: Replaced the native color input in the circle style popover with an in-app wheel picker plus brightness slider. The circle inspector keeps five quick color buttons directly visible and shows the palette button as the custom color when one is active.
- Shape rule: Superseded on 2026-06-15 by the compact quick-card sliders. `Amplitude = 0` still renders a smooth polygon, or a true circle at 25 corners. `Amplitude > 0` still renders the same corner count as a flower/wavy shape.
- Rendering: People inside a custom-colored circle and connector handles now use the circle's resolved custom color, not just its legacy tone.

### 2026-06-13 — Compact Inspector, Person Connections, and Circle Style Popover

- Decision: Tightened the person/circle inspector spacing and added a dedicated Person Connections block for imported LinkedIn profile URLs, custom URLs, handles, and phone-app links. Handles such as `@name` now ask for the target social service before saving when ambiguous.
- Circle design: Replaced the fully color-filled circle membership dropdown with neutral rows and a left color dot. Circle customization moved behind a palette button that exposes color presets, a custom color input, transparent/solid fill, shape mode, amplitude, and corner count controls.
- Rendering: Circle color, fill mode, shape type, sides, and amplitude are now per-circle JSON fields so hidden global settings are no longer required for wavy/polygon customization.

### 2026-06-13 — Simplified Notes Composer & Yellow Cards

- Decision: Simplified the Trello-style notes list header (removed the count badge) and composer (removed the "Tip" button). Updated the note cards to use a soft yellow sticky note color (`#fff9c4`) with a matching editor container to visually distinguish notes from other input elements. Improved composer keyboard and click handling so that saving/adding a note immediately saves, clears the input, and programmatically refocuses the textarea so users can quickly write multiple notes in a row without manual click refocusing.

### 2026-06-13 — Trello-Style Notes List and Composer

- Decision: Redesigned the notes list and adding experience in the inspector to look and feel like Trello cards. Notes are grouped in a light gray column with a count badge. Creating cards uses an inline textarea composer with quick keys: Enter to submit/add and keep focus, Shift+Enter for newline, and Escape/✕ to cancel. Editing a note inline converts it directly into a card text box footprints.

### 2026-06-13 — Default Person Shapes & Settings Pruning

- Decision: Newly created person nodes default to perfect circles (`shapeType: 'circle'`, `amplitude: 0`) rather than wavy shapes. The settings panel has been simplified to show only the LinkedIn Data Import and Account controls, while retaining other toggle settings in the codebase for potential future reuse.

### 2026-06-12 — Geographic Icons in Demo Circles

- Decision: Default region and country circles now use emoji flags or geographic symbols
  in their center handles. Company circles can continue using short text initials.
- Rendering: Canvas circle centers detect non-ASCII icons and use a larger emoji-capable
  font so flags read as icons instead of tiny text.

### 2026-06-12 — Tighter Demo Graph Spacing

- Decision: Demo data no longer ships with ad hoc person-to-person/custom links; only
  membership lines and circle hierarchy links are visible by default. Region clusters are
  positioned farther apart, while small nested circles use smaller radii.
- Design controls: Settings now has global segmented controls for `Circle shape`
  (simple circles vs stored figure shapes) and `Circle fill` (translucent/dashed vs solid).
  Demo mode only controls chrome visibility; it no longer owns the visual style.
- Layout: reduced the people collision and containment radii so a two-person circle grows
  only slightly beyond the avatar diameter instead of expanding from a large fixed buffer.
- Demo editing: demo mode keeps chrome hidden but allows canvas selection, Backspace/Delete
  deletion, visible connector handles, link creation, and drag-to-empty create menus for
  people, subset circles, and external connected circles. Settings also exposes separate
  circle-label and person-name toggles.

### 2026-06-12 — Demo Mode and Readable Canvas Links

- Decision: Added a settings-driven demo mode for the board. It hides the toolbar brand,
  zoom/reset controls, stress controls, help panel, create menu, inspector, connector
  handles, and connection selection while leaving the canvas plus the settings button.
- Why: demos need a presentation-clean view focused on moving/resizing circles and moving
  people, without chrome appearing when a node is selected.
- Rendering: circle fills now draw before relationship links, and circle details draw
  after links. Demo mode renders circle regions as translucent simple circles with a
  persistent dashed outline so links remain readable through large region areas.
- Data: the default demo seed now uses region circles (EU, Denmark, Russia, Other), nested
  country/company circles, and people arranged similarly to the current product demo map.

### 2026-06-12 — Chrome Migration to Material 3

- Decision: Migrated all surrounding chrome surfaces (toolbar, settings panel, stress panel, help panel, create menu, inspector, note cards, buttons, and inputs) to match the Material 3 design spec.
- Key Actions:
  - Added Design Tokens: Configured the full Material 3 token set (`--md-*` color roles, `--md-r-*` shape radius, and `--md-elev-*` shadows) on the `.app-shell` selector.
  - Global Typographic Cleanup: Mapped all font weights strictly to 400 (regular) and 500 (medium).
  - Floating and Context Surfaces: Removed hard borders and mapped backgrounds and elevations (`--md-surface-container` / `--md-elev-2` for floating panels, `--md-surface-container-low` / `--md-elev-1` for side sheets).
  - Component Upgrades: Restructured the Settings panel control into an M3 Segmented Button, converted checkboxes to M3 Switches, styled range inputs, and updated action buttons to M3 Filled shape/pill styles.
  - Hex Cleanup: Removed all remaining raw hex values (e.g., `#c4c7c8` borders and Tailwind grays) from the chrome styling, replacing them with semantic tokens.

### 2026-06-12 — Board visuals move to a Canvas 2D renderer

- Decision: the board's hot visual path is now Canvas 2D-first. Circles, people,
  labels, edges, selected handles, hover states, and the draft connector draw on one
  canvas; React keeps only chrome, panels, context menus, inspector UI, and state.
- Why: the previous hybrid renderer had accumulated DOM/SVG render passes plus a
  canvas people layer. That kept pan acceptable, but zoom still paid for mixed DOM,
  SVG, canvas redraw, and synthetic-link scans. The new renderer makes board frame
  cost primarily viewport-driven through a lightweight spatial grid and removes the
  interactive DOM person overlay.
- LOD rule: people keep the same silhouette and outline model at every zoom. The
  renderer may hide tiny labels or choose a cached sprite resolution, but it does not
  turn people into points or swap their shape identity at zoom-out.

### 2026-06-12 — Board collision layout

- Decision: board layout now runs a lightweight collision pass as part of
  `ensureContainment`. Same-level circles repel each other as whole subtrees, people repel
  other people in the same owning circle, and nested subset circles repel parent-level
  people so visual membership matches `circleId`. Each circle center also has a small
  collision radius, so people cannot stack on top of the center handle.
- Drag behavior: while dragging a person or circle, the dragged item is treated as active
  and the object it hits receives the main push. This keeps the pointer target feeling
  attached to the hand while still preventing overlap.
- Resize behavior: shrinking a circle scales the positions of contained people and
  descendant circles toward the resized circle center before containment re-fits. Descendant
  circle `radius` and `minRadius` shrink with the parent down to the global minimum, so a
  subset can compress when moving it inward is not enough.

### 2026-06-12 — Hover-to-DOM, coalesced drags, multi-res sprites

- Hover promotion: when people are canvas-only (dense circle / zoomed out), the person
  under the cursor is hit-tested and promoted to a real DOM node (`hoveredPersonId`), so it
  can be clicked/dragged even when the whole circle is on the canvas. Skipped when everyone
  is already DOM. The canvas exclude-set is deliberately hover-independent (a hovered person
  just double-draws under its opaque DOM node) so sweeping the cursor doesn't repaint the
  canvas.
- Drag cost: dragging a circle/person/resize used to `setGraph` on every pointer move (a
  full re-render each, plus layout work). Now move events are coalesced to one commit per
  animation frame (`scheduleDrag`, mirroring the pan/zoom gesture), so collision and
  containment layout can run during drag without reacting to every raw pointer event.
  Connector drags are coalesced the same way.
- Sprite resolution: canvas avatar sprites are cached at multiple resolution tiers
  (`SPRITE_TIERS` 64/128/256) and the draw picks the tier matching the on-screen device-pixel
  size, so zoomed-in canvas avatars are crisp instead of an upscaled 64px blur. Cost is a bit
  more sprite-cache memory (still tiny: tones × initials × tiers).

### 2026-06-11 — People render on a Canvas 2D layer; DOM only for interaction

- Decision: all people are painted on a single Canvas 2D layer with cached avatar
  sprites and viewport culling, so they stay visible at every zoom (no LOD hiding).
  A real interactive DOM person node is overlaid only for people in view at working
  zoom (`scale >= PEOPLE_INTERACT_SCALE`), plus the selected person; those are excluded
  from the canvas draw to avoid double-painting. Person→circle edges and synthetic
  cross-links also move to the canvas (DOM people keep an SVG edge behind their avatar).
- Why: this supersedes the earlier "drop people when zoomed out" LOD — the user wants
  every person always visible. The canvas sprite path (the one that genuinely held up at
  10k nodes earlier) is now applied to the *real* people, so the bulk is cheap while the
  small interactive overlay keeps drag/select/notes working. DOM person count stays near
  zero when zoomed out and bounded to one viewport when zoomed in.
- Mechanics: the canvas is a screen-space sibling of the world layer, repainted
  imperatively each gesture frame (live culling fills in people revealed mid-pan) and via
  an effect on settle. Sprites are keyed by `${tone}|${avatar}` and cached forever.
  Layering: circle fills < canvas (people + edges) < interactive DOM overlay.
- Rejected: cheaper DOM-only people (still O(n) reconciliation/paint) and hiding people on
  zoom-out (the user explicitly wants them always shown).
- Follow-up: promoting people to DOM by zoom *scale* alone still died when a dense circle
  put 1,000+ people on screen at once (each DOM person is ~100× a canvas sprite). Capped
  the interactive overlay at `PEOPLE_DOM_CAP` (120) — above that everyone stays on the
  canvas until you zoom in enough to thin them out. Also stopped culling circles (they're
  few and cheap): circle culling made circles pop in late during a long pan because the DOM
  layer only re-culls on settle while the people canvas repaints live every frame.

### 2026-06-23 — Reset Inspector Drafts on Selection Change

- Decision: transient inspector state is scoped to the current selection key and resets
  whenever the user selects a different person, circle, connection, or empty canvas.
- Why: note composers, inline note editors, connection input, and service pickers are
  drafts for the visible inspector only. Keeping them globally caused unsaved note/link
  state to appear on another person after closing the menu or selecting a different node.

### 2026-06-21 — Render Dense Clean Circles with Native Canvas Arcs

- Decision: clean board circles use a native Canvas `Path2D.arc` fast path, while wavy,
  polygon, and morphing circles keep the sampled-outline path. The circle path cache now
  holds enough entries for dense visible boards instead of clearing around 2,000 paths.
- Why: dense boards with thousands of empty circles were still slow because each clean
  circle was drawn as a 120+ segment sampled polyline, and the path cache could thrash
  during a single repaint when the visible circle count exceeded its old limit.

### 2026-06-15 — Keep Chrome Button Hover Pill-Shaped

- Decision: ordinary chrome buttons keep their Material 3 pill/circle shape on hover.
  Hover is expressed with an 8% state layer or tonal overlay; press feedback scales the
  control down with the M3 spring token. Shape morph remains reserved for selected
  swatches/presets and persistent selection indicators.
- Why: changing filled/text/icon buttons from pills to 8px rectangles on hover made the
  corners appear to change after the animation settled, and it did not match the button
  recipe in `DESIGN_SYSTEM.md`.

### 2026-06-11 — Compact Shape Type Selection and Stacked Overlay Fixes

- Decision: Replaced the bulky, native dropdown select elements for Shape Type selections (for both Circles and People) with a custom-styled Material 3 Segmented Button component (`.m3-segmented-button`). Shifted the Settings panel styling out of inline styles, defining it as `.settings-panel` in `src/index.css` with a high `z-index: 100` stacking order.
- Why: Dropdowns felt cheap and added vertical noise. Segmented buttons are compact, fit exactly 3 options horizontally, and provide a premium tactile feel using Material 3 secondary container tokens. The Settings panel previously rendered behind the inspector panel due to conflicting stacking context layers. Specifying a dedicated `z-index: 100` class ensures overlay panels draw on top of content panels.
- Polygon rounding: Refactored the `getNodePath` drawing code for regular polygons so that setting `amplitude: 0` (or `Rounding: 0` on the Circle slider) correctly renders a sharp, clean regular polygon instead of falling back to a circle.

### 2026-06-11 — Scale the board with viewport culling + LOD, not by rendering everything

- Decision: the board only renders nodes inside the visible world rectangle (padded by
  `CULL_OVERSCAN`), and drops individual people below `PEOPLE_LOD_SCALE` (zoomed-out
  survey view). The total node count no longer bounds frame cost — the screen area does.
- Why: the real-entity stress harness exposed that ~700 people / 45 circles dropped the
  prototype to ~2 FPS. The DOM/SVG approach can't reconcile or rasterize that many nodes
  per frame, and the gesture-time GPU layer doesn't help because rasterizing a huge layer
  is itself expensive. Culling keeps the live DOM set to roughly one viewport (measured
  ~120–150 nodes deep inside a dense field, vs 700+ total); LOD prevents the zoomed-out
  cliff where every node is "visible" at once.
- Mechanics: culling keys off the *settled* `camera` state, so during a pan/zoom gesture
  the visible set is frozen and the GPU-composited world layer just translates/scales it;
  the overscan margin covers small pans, and the set refreshes on settle. The FPS meter
  was also extracted into its own `FpsMeter` component so its 2 Hz tick stops re-rendering
  the whole board tree.
- Rejected: rendering all nodes and relying only on the GPU gesture layer (the prior
  model) — fine at a handful of nodes, falls over at hundreds.

### 2026-06-11 — Stress test uses real entities, not synthetic canvas sprites

- Decision: the performance stress harness generates real board entities (circles,
  people inside them, cross-circle connections) that flow through the production DOM/SVG
  render path, instead of drawing synthetic icons on a separate Canvas 2D layer.
- Why: canvas sprites measured the cost of cached bitmaps, not the cost of the real
  `person-icon-only` / `section.circle` / SVG-edge nodes users actually get. Good FPS on
  sprites was being mistaken for good product performance. The new harness spawns the
  same node types the product will, so FPS is honest.
- Rejected: the previous Canvas 2D sprite + viewport-culling layer (removed). It was kept
  for a while as a way to render dense loads smoothly, but for *measuring* the real
  prototype it was misleading.
- Isolation: the whole harness lives in [`src/lib/stressTest.ts`](../src/lib/stressTest.ts)
  behind `STRESS_TEST_ENABLED`; flip the flag to disable, or delete the file plus the
  `STRESS TEST`-marked blocks in `src/App.tsx` to remove it entirely.

### 2026-06-10 — Adopt Material 3 as the target design language

- Decision: the app targets Google's Material 3 (Material You). The full spec lives in
  [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md).
- Context: the board canvas already used a Material 3 tonal palette (`MATERIAL_TONES` in
  `src/App.tsx`), but the surrounding chrome (toolbar, panels, menus, inspector, forms)
  used a different, generic style — heavy font weights (760–900), hard `1.5px #c4c7c8`
  borders, mixed ad-hoc and Tailwind grays, and deep shadows — so the two halves did not
  read as one system.
- Direction: chrome migrates to Material 3 panel by panel; all new UI ships Material 3
  from the start. The chrome primary reuses the canvas blue tone (`#00629D`) so the whole
  screen is one palette.
- Why: visual coherence with the already-Material canvas, and a single token system new
  features can build on instead of re-deriving styles each time.

### 2026-06-24 — Onboarding Step Reordering and Context-Aware Mobile Layout

- Decision: Rearranged the onboarding flow step order so that adding a person/circle (`'create'`) is Step 2 (right after panned/zoomed canvas gestures in Step 1). Moving (`'move'`) and resizing (`'resize'`) steps are shifted to Steps 3 and 4, respectively.
- Why: Users shouldn't be asked to move or resize elements before having created any. Putting the creation step first ensures they have elements on the canvas to interact with.
- Decision: Implemented context-aware positioning for the onboarding coach card on mobile. The card dynamically floats at the top if the inspector (notes) is open (`selectedItem !== null`) to avoid overlapping notes, and at the bottom if the search panel is open (preventing overlap with search) or by default.
- Decision: Repositioned the anonymous sign-in banner (`.local-save-hint`) from top-left to bottom-left on desktop, and bottom-stretch on mobile. It is hidden completely on mobile when search, settings, or the inspector panel are open.
- Why: Having the banner at the top-left caused it to overlap the brand logo/settings buttons. Positioning it at the bottom keeps it clean, and hiding it when panels are open avoids any screen clutter on small devices.

### 2026-06-24 — Remove Sign-in Popup, Add Settings Alert Badge, and Dynamic Onboarding Offset

- Decision: Removed the floating anonymous sign-in banner (`.local-save-hint`) completely. Instead, added an alert exclamation badge (`!`) on the Settings gear button for anonymous users, which prompts them to open settings where the account sign-in block is located.
- Why: The popup banner was intrusive, cluttered mobile viewports, and clashed/overlapped with logo and onboarding controls. The badge is much quieter, spec-compliant, and cleanly guides users to their settings.
- Decision: Replaced fixed top/bottom classes for the mobile onboarding coach with a dynamic JS offset measurement. A MutationObserver and window listeners monitor the height of the bottom inspector and the circle style popover, setting an inline `bottom` offset so the coach card dynamically glides up and down, floating exactly 12px above whichever bottom sheet is active.
- Why: Pushing the onboarding coach to the top of the screen on mobile avoided the bottom notes but ended up covering the search dropdown and other top-level elements. Pushing it up just enough to float above bottom sheets keeps the top area completely clear.

### 2026-06-25 — Enhanced Grid Ripple Visibility & Settings Toggle Switch

- Decision: Optimised background grid dot ripple rendering by separating the base grid drawing path (fast batched path) from the interactive overlay pass. Lit dots now grow dynamically in radius (up to 4x their base size) and increase their opacity (up to 0.9/0.95 of a vibrant primary blue tone) as a wave crest passes.
- Why: Faint ripples were previously invisible to the human eye due to low opacities and lack of size scaling, especially at different zoom levels. Dynamic sizing and higher opacity make ripples look like clear, fluid water droplets/pulses.
- Decision: Converted pointer-move and drag distance calculations to screen-space coordinates by multiplying world-space distances by the camera scale. Added a sub-pixel jitter filter (`distScreen > 2` pixels) to only spawn ripples on actual pointer move.
- Why: Using raw world distance meant that ripple trails were dense at far zoom-out levels but extremely sparse/hard to trigger at close zoom-in levels. Screen-space distance keeps gesture ripple trails size-invariant across all camera scale factors.
- Decision: Replaced the standard checkbox toggle for ripples in the settings panel with the Material 3 Switch (`.m3-switch` class).
- Why: The native checkbox looked cheap and cluttered the display panel. The M3 Switch is cleaner, fits the design system tokens, and matches other custom inputs.

### 2026-06-25 — Round Grid Dots, Dense Grid Spacing, Perimeter Waves & Style Change Ripples

- Decision: Changed grid dots rendering shape from squares (`ctx.rect`) to circles (`ctx.arc`). Reduced base minor dot opacity to 0.04 (from 0.09) and major dot opacity to 0.09 (from 0.18), and decreased peak lit dot opacity to 0.7/0.75 and radius growth to 2.0x/1.8x.
- Why: Circular dots look much softer and blend better with the round aesthetic. Reducing the opacities and growth sizes makes the waves subtle and elegant rather than distracting.
- Decision: Decreased the default grid spacing from 32 to 20 world units.
- Why: This creates a denser, more natural-looking backdrop grid. With LOD, screen-space spacing is kept between 10px and 20px.
- Decision: Removed the `isMajor` skip filter from the minor dots drawing loop. Minor dots are now drawn at every coordinate, and major dots are drawn on top.
- Why: Previously, when the camera zoomed out, major dots faded out but the corresponding minor dots were skipped, leaving empty "holes" in the grid every 5 dots, which made the grid look crooked (uneven/irregular). Keeping the minor dots grid complete solves the alignment issue.
- Decision: Extended the grid ripples math to support `sourceRadius`. When a circle is created, dragged, or resized, the ripple wave propagates outward and inward from the circle's actual boundary rather than its center.
- Why: Visual waves look much more realistic when they emanate directly from the circle's physical perimeter (the hull) rather than its center point.
- Decision: Integrated throttled (150ms) style-change ripples in `updateCircleStyle` when shape, rounding, sides, opacity, tone, custom color, or image properties are updated.
- Why: Gives real-time tactile wave feedback to the canvas when modifying any visual settings of a circle.

### 2026-06-30 — Remove Onboarding Tour, Keep Contextual First-Run Hints

- Decision: Removed the gesture-driven onboarding tour entirely, including the React
  component, step data, first-run card state, and onboarding CSS.
- Why: The tour competed with the board and felt like a dismissible popup rather than a
  useful path into the product. The important discovery points are already in Settings and
  Search.
- Decision: Added a one-time attention pulse to the LinkedIn Data Import help `?` until the
  user opens the LinkedIn sync guide.
- Why: The full LinkedIn archive guide is important, but it should be discovered in the
  existing Settings import section instead of through a separate onboarding surface.
- Decision: Added a one-time Search hint explaining that users can paste a LinkedIn profile
  URL to add that person to the board.
- Why: Manual profile-link import belongs directly in Search, and the hint appears exactly
  when the user first opens that control.

## 2026-06-27 — Hybrid natural-language smart search

- Decision: Smart search uses NeuralDeep (`https://api.neuraldeep.ru/v1`) with model
  `qwen3.6-35b-a3b-noreason` only to parse queries into structured filters; ranking stays
  deterministic in `graphSearch.ts` using circle paths, notes, and roles. Signed-in users
  get AI mode; anonymous users get the same ranker without LLM.
- Why: MoE 3B-active model is the fastest option on NeuralDeep's free tier; parse-only LLM
  keeps latency and cost low while hierarchy (company circles, nested subsets) handles
  scoped queries like "people at Acme".

## 2026-06-27 — Agent search with visible steps and note reading

- Decision: Replace single intent-parse with multi-pass agent search: analyze query,
  collect note-backed candidates, LLM match, optional semantic retry, suggestions on miss.
  UI shows AI badge, step list, explanation, suggestion chips, and per-result `aiReason`.
- Why: Users expect LLM search to read notes and try harder than substring match; one-shot
  JSON filters could not connect "my girlfriend" to "i love her".

## 2026-06-28 — Local LinkedIn JSONL retrieval for agents

- Decision: Add `scripts/linkedin-agent-search.mjs`, a read-only grep-like search over
  compact LinkedIn `people-for-llm.jsonl` exports with exact ids, field filters, paging,
  and 30k/50k token budgets. It is intentionally separate from Supabase, the graph API,
  MCP, and `datanode-cli`.
- Why: Full LinkedIn graph exports can exceed 1M tokens. Agents need deterministic local
  retrieval that returns large groups in compact chunks before involving an LLM.

## 2026-06-30 — Unified drag lift for board nodes

- Decision: Dragging a person or circle now uses a transient canvas lift scale instead of
  resizing individual visual parts. Circle drags treat the circle as the lifted root; its
  descendant circles and people inherit the same draw transform, so the dragged zone reads
  as one scaled picture. The effect has no shadow and does not mutate graph geometry.
- Why: Drag feedback should clearly show motion and elevation while preserving the mental
  model that a circle with contents is one movable object.
- Follow-up: Pointerdown now starts an immediate held press scale, quick clicks release
  with a spring-back, and movement past the drag threshold continues into the 10% drag
  lift. Dragging after a first click still suppresses the browser `dblclick` create event,
  preventing accidental person creation when the second click becomes a move gesture.
- Follow-up: Resize-edge hit testing now measures distance to the rendered outline for
  custom wavy/polygon circles and uses a smaller sticky leave band. Edge clicks also start
  the same press feedback as body clicks, while actual resize movement releases that press
  scale so the live radius is not visually over-inflated.

## 2026-06-30 — Mobile board navigation and dense-render LOD

- Decision: Added a vertical top-left board mode switch with edit and pan modes. Pan mode
  makes one-finger/touch dragging move the canvas instead of selecting nodes, while keeping
  pinch zoom and double-tap create available.
- Why: Dense mobile boards make two-finger navigation and accidental node grabs expensive
  and frustrating. A persistent mode control gives users a fast way to travel across a
  large graph without fighting the editing hit targets.
- Decision: Added inertial camera scrolling after a completed pan gesture.
- Why: Large boards need scroll-like momentum on phones so users can cover distance with
  fewer gestures.
- Decision: Added a live camera bitmap cache, people-dot LOD, edge skipping during dense
  intermediate zooms, tiny-circle arc rendering, and dense-board connection hover culling.
- Why: The worst mobile case is an intermediate zoom where many people are still visible
  but labels are hidden, or a far zoom with hundreds/thousands of nodes on screen. Live
  gesture frames should transform a cached picture or draw cheap dots/arcs rather than
  recomputing every avatar sprite, dashed circle outline, membership curve, and connection
  hit candidate.
