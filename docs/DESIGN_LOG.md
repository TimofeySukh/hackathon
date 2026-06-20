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

### 2026-06-20 — Replace Social Datanode brand mark

- Decision: replaced the legacy purple lightning favicon and CSS-generated landing marks
  with the provided SDN concentric-node SVG.
- Scope: the shared SVG now lives in [`src/assets/sdn-logo.svg`](../src/assets/sdn-logo.svg),
  the browser favicon uses the same artwork via [`public/favicon.svg`](../public/favicon.svg)
  with a versioned URL in [`index.html`](../index.html) to avoid stale tab-icon caches, and
  the landing header/footer plus auth loading mark render it as an image.
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

### 2026-06-14 — Manual LinkedIn enrichment uses Bright Data behind Supabase

- Decision: single-profile LinkedIn imports from board search call a Supabase Edge
  Function that validates the user's session and then calls Bright Data's LinkedIn
  profile scraper. ZIP import remains local CSV processing and never calls Bright Data.
- Quota control: the frontend first checks whether the normalized LinkedIn URL already
  exists in the graph, then checks a local 30-day per-URL enrichment cache. Bright Data is
  only called for uncached manual one-profile imports.
- Data mapping: Bright Data fields normalize into person name, current company circle,
  headline/role, avatar image, and a "Profile" note containing the profile description.
- Why: the Bright Data API key must stay server-side, and the free monthly request budget
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
