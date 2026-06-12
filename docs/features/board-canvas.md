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
- **Create**: right-click a circle, or Shift-drag from a circle center, to open the
  create menu (add person / nested subset circle / connected external circle). People are
  endpoints; only circle centers spawn new branches.
- **Connect**: with the "Draw Connection" center behavior, drag from a circle center to
  another node to draw a relationship link. A dashed draft edge previews the connection.
- **Select**: click a circle, person, or connection to load it into the inspector for
  rename / styling / notes / delete.
- **Favorite**: a person can be starred; favorited people get a thicker neon-yellow
  outline on the canvas.
- **Collision rules**: people repel other people in their owning circle and the center
  handle of that circle. Nested subset circles repel people that belong directly to the
  parent circle, so a parent-level person cannot visually sit inside a subset they do not
  belong to.
- State is browser-session-only in this prototype screen (no backend writes from here).

## Design

This is the most Material-3-aligned part of the app today; keep it that way.

- **Color**: circles and people use the categorical accent palette
  (`MATERIAL_TONES` in `src/App.tsx`) — see the accent table in
  [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md#1-color-tonal-roles). Text on a fill uses
  that tone's on-container value.
- **Shapes**: nodes render as `wavy` (flower), soft `polygon`, or `circle` via
  `getNodePath`; circles default to `wavy`, people to `polygon`. Sides and amplitude are
  per-node and adjustable in the inspector.
- **Surfaces**: node labels draw inside the Canvas 2D board layer, while the help/stress
  panels float above the grid background. Selection is shown by a stronger border/state,
  not a color swap.
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

- Windows laptops reportedly cannot add new nodes — see
  [`../PROBLEMS.md`](../PROBLEMS.md).
- The single-file `App.tsx` mixes many concerns; component extraction would make the
  Material 3 chrome migration cleaner but is not required for it.
