# Board canvas

## Purpose

The full-window relationship graph: a central `You` circle with connected circles,
nested subset circles, and people placed inside them. It is the primary surface of the
app — everything else (toolbar, panels, inspector) is chrome around it.

## Behavior

- **Pan / zoom**: drag empty space to pan; mouse wheel or toolbar buttons to zoom
  (`MIN_SCALE`/`MAX_SCALE` clamp).
- **Move**: drag a person to reposition inside its owning circle; nearby people in the
  same circle are pushed aside instead of overlapping. Drag a circle center or body to move
  the whole circle and everything it contains; circles at the same nesting level push each
  other apart.
- **Resize**: drag a circle's edge; parent circles auto-fit (expand and shrink back to a
  minimum) as their contents move. Shrinking a circle pulls its contained people and subset
  circles toward the center, and nested subset circles shrink with the parent when position
  packing alone cannot fit them.
- **Create**: right-click a circle to open the create menu, which now offers two actions —
  add person and add circle. "Add circle" auto-detects containment from the target point:
  inside the source circle it nests a subset blob, outside it spawns a connected circle.
- **Double-tap create**: double-click (double-tap) anywhere to drop a person exactly at the
  tapped point. It adopts a circle only when the tap lands inside one (or on someone already
  in a circle); tapping empty space leaves the person free-floating with no owning circle.
  The creation deliberately skips containment fitting so the rest of the board never reflows
  or jumps. This replaces the older Shift-drag-from-center shortcut.
- **Connect**: with the "Draw Connection" center behavior, drag from a circle center to
  another node to draw a relationship link. A dashed draft edge previews the connection.
- **Center fan-out**: automatic circle links whose source is the central `You` circle are
  not rendered. Dense imports otherwise create a starburst of non-authored lines from the
  center to every company circle. Explicit user-created connections still render.
- **Select**: click a circle, person, or connection to load it into the inspector for
  rename / styling / notes / delete.
- **Undo**: Ctrl/Cmd+Z reverts the last graph-mutating action — create, delete, move,
  resize, connect, merge, change-circle, favorite, add/delete note, and LinkedIn import.
  A whole drag or resize gesture is a single undo step, and the shortcut is ignored while
  typing in a field so it never fights an input's native undo. History is in-memory only
  (lost on reload) and structural; rename and style tweaks are intentionally excluded so
  undo stays at meaningful boundaries.
- **Demo mode**: the Settings panel includes a demo mode switch. When enabled, chrome,
  stress controls, help text, and the inspector disappear; only the board canvas and
  settings button remain. People and circles can still be moved, and circle edges can
  still be resized. Existing items can still be selected on the canvas and deleted with
  Backspace/Delete. Connector handles stay visible. Dragging a circle/person connector to
  an existing node creates a link; dragging to empty space opens the create menu so users
  can add a person or a circle without leaving demo mode.
- **Labels**: Settings includes separate toggles for circle labels and person names.
  Circle-center icon text scales with the world transform like people avatars; labels use
  the same screen-readable label treatment as person names.
- **Seed icons**: default country and region circles use geographic icons or flags in
  their center handles. Company circles may still use short text initials.
- **Circle design**: newly loaded and newly created circles default to transparent clean
  circles. Selecting a circle shows quick color swatches, the fill toggle, avatar upload,
  and the Wavyness/Edges sliders directly in the compact quick card. The palette popover
  is only for detailed color/brightness controls. Fill and shape changes apply only to
  the selected circle; new circles keep the clean transparent default.
- **Favorite**: a person can be starred; favorited people get a thicker neon-yellow
  outline on the canvas.
- **Collision rules**: people repel other people in their owning circle and the center
  handle of that circle. Nested subset circles repel people that belong directly to the
  parent circle, so a parent-level person cannot visually sit inside a subset they do not
  belong to. People use a tight collision and containment radius only slightly larger than
  the visual avatar, while larger region/company circles keep their normal spacing.
- State is browser-session-only in this prototype screen (no backend writes from here).

## Design

This is the most Material-3-aligned part of the app today; keep it that way.

- **Color**: circles and people use the categorical accent palette
  (`MATERIAL_TONES` in `src/App.tsx`) — see the accent table in
  [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md#1-color-tonal-roles). Text on a fill uses
  that tone's on-container value.
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
- **Components used**: create menu (M3 menu), inspector (side sheet), toolbar (icon
  buttons). These follow the recipes in the design system.
- **Known gaps vs. Material 3 target**:
  - Canvas-rendered label and shadow tokens should stay aligned with
    [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md) as the renderer is extracted.

## Code

- Main file: `src/App.tsx` (single-file prototype; ~3.1k lines).
- Styles: `src/index.css` (canvas + chrome).
- Key pieces:
  - `MATERIAL_TONES`, `TONE_LABELS` — the accent palette.
  - `getNodePath` — wavy/polygon/circle shape generation.
  - `createBoardIndex`, `queryPeople`, `queryCircles` — the spatial grid used for
    viewport rendering and hit testing.
  - `drawBoardLayer` — Canvas 2D renderer for circles, people, labels, edges, selected
    handles, and the draft connector.
  - `hitTestBoard` plus `handleSurfacePointerDown/Move/Up` — canvas interaction model
    for selecting, dragging, resizing, connecting, and context menus.
  - create-menu rendering; inspector `<aside className="inspector">`.

## Open questions / TODO

- Windows laptops reportedly cannot add new nodes (needs reproduction details, including browser, input device, and gesture/button behaviors).
- The single-file `App.tsx` mixes many concerns; component extraction would make the
  Material 3 chrome migration cleaner but is not required for it.
