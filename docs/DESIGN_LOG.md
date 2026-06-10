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
