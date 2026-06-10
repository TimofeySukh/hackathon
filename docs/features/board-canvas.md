# Board canvas

## Purpose

The full-window relationship graph: a central `You` circle with connected circles,
nested subset circles, and people placed inside them. It is the primary surface of the
app — everything else (toolbar, panels, inspector) is chrome around it.

## Behavior

- **Pan / zoom**: drag empty space to pan; mouse wheel or toolbar buttons to zoom
  (`MIN_SCALE`/`MAX_SCALE` clamp).
- **Move**: drag a person to reposition inside its owning circle; drag a circle center to
  move the whole circle and everything it contains.
- **Resize**: drag a circle's edge; parent circles auto-fit (expand and shrink back to a
  minimum) as their contents move.
- **Create**: right-click a circle, or Shift-drag from a circle center, to open the
  create menu (add person / nested subset circle / connected external circle). People are
  endpoints; only circle centers spawn new branches.
- **Connect**: with the "Draw Connection" center behavior, drag from a circle center to
  another node to draw a relationship link. A dashed draft edge previews the connection.
- **Select**: click a circle, person, or connection to load it into the inspector for
  rename / styling / notes / delete.
- **Favorite**: a person can be starred; favorited people get a thicker neon-yellow
  outline on the canvas.
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
- **Surfaces**: node labels and the help/stress panels float above the grid background.
  Selection is shown by a stronger border/state, not a color swap.
- **Components used**: create menu (M3 menu), inspector (side sheet), toolbar (icon
  buttons). These follow the recipes in the design system.
- **Known gaps vs. Material 3 target**:
  - Node labels (`.circle__label`, `.person-label`) use font-weight 800 → should be 500.
  - The draft edge color `#2563eb` is a second blue; align it to `--md-primary`
    (`#00629d`) so there is one blue in the system.
  - Shadows on labels are heavier than `--md-elev-1`.

## Code

- Main file: `src/App.tsx` (single-file prototype; ~2.7k lines).
- Styles: `src/index.css` (canvas + chrome).
- Key pieces:
  - `MATERIAL_TONES`, `TONE_LABELS` — the accent palette.
  - `getNodePath` — wavy/polygon/circle shape generation.
  - `makeCurve` — curved edge paths.
  - Pointer handlers: `handleSurfacePointerDown/Move/Up`, `startCircleCenterDrag`,
    `startCircleSurfaceDrag`.
  - `openCircleCreateMenu` / create-menu rendering; inspector `<aside className="inspector">`.

## Open questions / TODO

- Windows laptops reportedly cannot add new nodes — see
  [`../PROBLEMS.md`](../PROBLEMS.md).
- The single-file `App.tsx` mixes many concerns; component extraction would make the
  Material 3 chrome migration cleaner but is not required for it.
