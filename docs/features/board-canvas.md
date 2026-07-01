# Board canvas

## Purpose

The full-window relationship graph: a central `You` circle with connected circles,
nested subset circles, and people placed inside them. It is the primary surface of the
app — everything else (toolbar, panels, inspector) is chrome around it.

## Behavior

- **Pan / zoom**: on desktop, drag empty space to pan and use mouse wheel, trackpad
  scroll, or trackpad pinch to zoom (`MIN_SCALE`/`MAX_SCALE` clamp). On touch/mobile,
  pinch with two fingers to zoom. The vertical **tool mode** menu (top-left) is shown only
  on touch/mobile layouts and switches **Edit**, **Select** (marquee), and **Pan**. Pan
  mode makes one-finger drag move the canvas; releasing a pan gesture can continue with
  short inertial scrolling.
- **Move**: drag a person to reposition inside its owning circle; nearby people in the
  same circle are pushed aside instead of overlapping. Drag a circle center or body to move
  the whole circle and everything it contains. Live pointer frames never run the global
  collision solver, but they do refit parent circles in-place when the dragged person or
  nested circle crosses the current parent boundary and when it moves back inward. On small
  boards, the final drop still runs containment/collision cleanup; on large boards, final
  cleanup is skipped so one interaction cannot reflow or freeze a dense import. While a
  person or circle is pressed, the grabbed root immediately scales up into a held press
  state. If the pointer moves past the 5px drag threshold, that press continues into the
  10% drag lift and eases back after drop. A plain click that stays under the threshold
  plays the same press-in plus release spring without starting drag geometry cleanup. For
  circles, the renderer applies one canvas transform to the circle root and its descendants
  so the zone reads like one scaled picture rather than separately animated parts.
- **Resize**: drag a circle's edge; parent circles auto-fit (expand and shrink back to a
  minimum) as their contents move. Shrinking a circle pulls its contained people and subset
  circles toward the center, and nested subset circles shrink with the parent when position
  packing alone cannot fit them. Live resize frames update only the resized circle and
  contained nodes; large boards skip global collision cleanup after the resize gesture.
  Resize hover and hit testing follow the rendered circle outline, including wavy and
  polygon shapes, rather than an invisible perfect-circle radius. Clicking the resize edge
  without moving still plays the same press feedback as clicking the body.
- **Create**: right-click a circle to open the create menu, which now offers two actions —
  add person and add circle. "Add circle" auto-detects containment from the target point:
  inside the source circle it nests a subset blob, outside it spawns a connected circle.
  Dragging from a circle center to empty space opens the same creation options at the
  release point.
- **Double-tap create**: double-click (double-tap) anywhere to drop a person exactly at the
  tapped point. It adopts a circle only when the tap lands inside one (or on someone already
  in a circle); tapping empty space leaves the person free-floating with no owning circle.
  The creation deliberately skips containment fitting so the rest of the board never reflows
  or jumps. If the second click turns into a drag, the drag suppresses the browser's
  follow-up `dblclick` event so no accidental person is created on drop. This replaces the
  older Shift-drag-from-center shortcut.
- **Connect**: with the "Draw Connection" center behavior, drag from a circle center to
  another node to draw a relationship link. A dashed draft edge previews the connection.
  Links render as adaptive quadratic curves: longer and more diagonal links get a little
  more shape, while short links stay close to direct. Hover and selection hit-testing uses
  the same curve geometry as rendering, not the straight line between endpoints.
  The board keeps one relationship edge per pair of endpoints; drawing the same pair again
  is a no-op, including reversed endpoint order.
  In the far-zoom zones-only view, hidden centers, people, and connector handles are not
  interactive, so dragging from a hidden center cannot open the create menu.
- **Center fan-out**: automatic circle links whose source is the central `You` circle are
  not rendered. Dense imports otherwise create a starburst of non-authored lines from the
  center to every company circle. Explicit user-created connections still render.
- **Membership edges**: person-to-circle membership lines render only for people in the
  current viewport, so a visible imported company circle does not draw thousands of
  offscreen contact lines during unrelated repaints. Membership lines are selectable like
  authored connections; deleting one detaches the person from the circle without deleting
  either node. They use the same adaptive curved geometry as custom connections.
- **Connected-circle edges**: circle-to-circle edges created through `connectedTo` share
  the same hover, selection, and delete behavior as custom connections. Deleting one clears
  that circle's connected parent without deleting the circle.
- **Hit priority**: circle center handles own their visible hit area. A relationship line
  passing underneath a center does not hover or select while the pointer is on the center.
- **Circle rendering performance**: clean circles render with the native Canvas `arc`
  path instead of a sampled polyline. Wavy and polygon circles still use sampled paths,
  and circle paths are cached at a large-board-friendly size so dense imports do not
  rebuild every visible circle path on each repaint. During pan/zoom, the board first
  renders an expanded bitmap snapshot and transforms that cached image for live frames;
  the final settled frame redraws sharply as vectors. Dense intermediate zoom levels use
  a people-dot LOD and skip non-essential membership/custom edge drawing while moving, so
  mobile devices do not redraw thousands of full avatars and curves for every gesture
  frame. Tiny far-away transparent circles use simple arc strokes instead of dashed outline
  paths.
- **Select**: click a circle, person, or connection to load it into the inspector for
  rename / styling / notes / delete. Circles can only be removed with the inspector's
  **Delete circle** button, which asks for confirmation first. People and connections
  can still be deleted with Backspace/Delete.
- **Area select**: on desktop, right-drag empty space to draw a marquee selection box.
  On touch/mobile, switch to Select mode and drag across the board.
- **Onboarding guide**: first board visit opens a short board guide; landing CTAs
  force-open it for that launch, and the toolbar Help button reopens it. Steps
  auto-advance after the matching action is performed, while `Skip` manually advances.
  The mobile copy explains Edit / Select / Pan modes.
- **Undo**: Ctrl/Cmd+Z reverts the last graph-mutating action — create, delete, move,
  resize, connect, merge, change-circle, favorite, add/delete note, and LinkedIn import.
  A whole drag or resize gesture is a single undo step. History is in-memory only (lost on
  reload); rename and style tweaks are excluded.
- **Settings panel** (gear): LinkedIn ZIP import (+ sync guide), account sign-in/out,
  Agent API key management (signed-in), graph import/export/clear.
- **Graph file actions**: export downloads JSON; import replaces the board and flushes
  immediately; clear resets to a fresh `You` circle after confirmation (both undoable).
- **Persistence safety**: signed-in boards load only from the `user_graphs` blob.
  A brand-new empty graph is not immediately autosaved on load, so a temporary
  backend/schema mismatch cannot overwrite an existing board with a single `You` circle.
- **Labels**: circle and person labels render on the canvas when zoom permits; center icon
  text scales with the world transform.
- **Circle design**: newly loaded and newly created circles default to transparent clean
  circles. Per-circle fill, waviness, edges, and color are edited in the inspector quick
  card and palette popover.
- **Favorite**: favorited people show a thicker neon-yellow outline on the canvas.
- **Avatar fallback**: remote person avatar URLs render initials until the image loads,
  and keep initials if the image fails, so imported profiles never draw as empty chips.
- **Collision rules**: people repel other people in their owning circle and the center
  handle of that circle. Nested subset circles repel people that belong directly to the
  parent circle, so a parent-level person cannot visually sit inside a subset they do not
  belong to. People use a tight collision and containment radius only slightly larger than
  the visual avatar, while larger region/company circles keep their normal spacing.
- Signed-in state autosaves to Supabase after edits; anonymous state stays in
  `localStorage`.

## Design

This is the most Material-3-aligned part of the app today; keep it that way.

- **Color**: circles and people use the categorical accent palette
  (`MATERIAL_TONES` in `src/lib/board/constants.ts`) — see the accent table in
  [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md#1-color-tonal-roles).
- **Shapes**: nodes render as `wavy` (flower), soft `polygon`, or `circle` via
  `getNodePath`. Circle Wavyness maps to amplitude; Edges maps to side count, with 25
  edges treated as a clean circle. New circles and unmarked legacy circle styles load as
  transparent clean circles; figures appear only after explicit per-circle styling, which
  records `shapeCustom`. People default to clean circular avatars.
- **Surfaces**: node labels draw inside the Canvas 2D board layer, while the help/stress
  panels float above the grid background. Selection is shown by a stronger border/state,
  not a color swap.
- **Layering**: circle fills render first, then relationship links, then circle centers,
  labels, and people. This keeps links readable even when they pass through large circles.
  Drag lift feedback is a transient draw transform only; it does not mutate persisted
  coordinates, radii, labels, or avatar sizes. Resize-edge hover highlights the actual
  rendered outline so the visible affordance and hit area stay aligned.
- **Components used**: create menu (M3 menu), inspector (side sheet), toolbar (icon
  buttons). These follow the recipes in the design system.
- **Known gaps vs. Material 3 target**:
  - Canvas-rendered label and shadow tokens should stay aligned with
    [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) as the renderer is extracted.

## Code

- Main file: `src/App.tsx` (board shell + interaction host; component extraction ongoing).
- Board engine: `src/lib/board/` (`types`, `constants`, `geometry`, `layout`, `render`).
- Styles: `src/styles/board.css`, `src/styles/chrome.css`, … via `src/index.css`.
- Key pieces:
  - `createFreshGraph`, `ensureContainment`, `packedCircleRadius`, `packCirclesInRings` — layout/import.
  - `createBoardIndex`, `hitTestBoard`, `drawBoardLayer` — spatial index, interaction, render.
  - `BOARD_INTERACTION_LAYOUT_LIMIT`, `IMPORT_LAYOUT_LIMIT` — dense-board guards.
  - Inspector `<aside className="inspector">`, create menu, board mode menu.

## Open questions / TODO

- Windows laptops reportedly cannot add new nodes (needs reproduction: browser, input device, gestures).
- Continue extracting subcomponents from `App.tsx` without changing board behavior.
