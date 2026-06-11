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
