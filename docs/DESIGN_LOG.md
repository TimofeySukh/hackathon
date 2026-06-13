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

### 2026-06-13 — Arc-Like Circle Color Picker

- Decision: Replaced the native color input in the circle style popover with an in-app HSV picker inspired by Arc-style color panels: a large dotted spatial color field, a hue rail, quick preset swatches, and solid/transparent tabs. The circle inspector keeps five quick color buttons directly visible.
- Shape rule: Circle shape customization is driven by only two sliders. `Amplitude = 0` renders a smooth polygon, or a true circle at 25 corners. `Amplitude > 0` renders the same corner count as a flower/wavy shape. There is no separate rounding control.
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
