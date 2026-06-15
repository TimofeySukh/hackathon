# Design System

This document is the source of truth for how the app should look and feel. Anything
new that has a UI must follow it. The target visual language is **Material 3 (Material
You)** by Google.

## Maintenance Rule

- Read this file before building or restyling any UI.
- When you add a new screen, panel, menu, or control, style it with the tokens and
  component recipes below. Do not invent new colors, radii, shadows, or font weights.
- **Reuse before you build. Do not reinvent the wheel.** If a control already exists
  (`SelectionIndicator`, the swatch/preset shape-morph, the pill/button recipes, etc.),
  reuse it — and *modify it for the new use case* (add a variant/prop) rather than writing a
  second, parallel default. One concept = one component. The whole UI must read as one system:
  same elements, same motion, same tokens everywhere. Before adding a control, grep
  `src/components/` and `src/styles/` for an existing one.
- **Get the M3 spec right — don't guess.** When a recipe here doesn't cover what you need, or
  you're unsure how Material does something, either (a) consult the official M3 docs
  (links in *Reference* below), or (b) work only from a detailed recipe written down here.
  If you learn a concrete M3 detail from the web, write it into this file (token/recipe) in the
  same change so the next person doesn't have to re-research it. Keep one source of truth.
- If a real need is not covered here, add the token or recipe to this file in the same
  change, then use it.
- When you make a notable, durable design decision (a deviation, a new pattern, a
  rejected option), record it in [`DESIGN_LOG.md`](DESIGN_LOG.md).
- Per-feature look and behavior is documented under [`features/`](features/README.md).

## Reference (official Material 3)

When in doubt, read the source rather than guessing — then fold what you learn back into this
file as a token or recipe.

- Material 3 Expressive overview: https://m3.material.io/blog/building-with-m3-expressive
- Motion (springs, schemes): https://m3.material.io/styles/motion/overview/how-it-works
- Transitions (continuity, shared axis, container transform): https://m3.material.io/styles/motion/transitions
- Shape & shape morph: https://m3.material.io/styles/shape/shape-morph
- Buttons (incl. interactive shape morph / button groups): https://m3.material.io/components/buttons/overview
- Color roles: https://m3.material.io/styles/color/roles

## Current Status (be honest about the gap)

The migration to Material 3 is in progress, not finished.

- The **board canvas** already uses a Material 3 tonal palette for circles and people
  (`MATERIAL_TONES` in `src/App.tsx`). This part is close to target.
- The **chrome** around the canvas (toolbar, settings panel, stress panel, help panel,
  create menu, inspector, forms) is **not** Material 3 yet. It uses heavy font weights
  (760–900), hard `1.5px` borders, ad-hoc grays, and deep shadows.

Rule of thumb: **new UI ships Material 3 from day one.** Old chrome is migrated panel by
panel toward the recipes below. Do not copy the old chrome style into new code.

---

## 1. Color (tonal roles)

Material 3 uses semantic color *roles*, not raw hex literals. The chrome shares the same
blue primary as the canvas so the whole screen reads as one system.

Define these once on `.app-shell` and reference the variables everywhere. Never hardcode
a color in an inline style if a role exists for it.

```css
.app-shell {
  /* Primary (matches the canvas blue tone) */
  --md-primary: #00629d;
  --md-on-primary: #ffffff;
  --md-primary-container: #d2e4ff;
  --md-on-primary-container: #001d35;

  /* Secondary — used for selected/active state layers */
  --md-secondary-container: #d6e3f7;
  --md-on-secondary-container: #0f1d2a;

  /* Error — destructive actions (delete) */
  --md-error: #ba1a1a;
  --md-on-error: #ffffff;
  --md-error-container: #ffdad6;
  --md-on-error-container: #410002;

  /* Neutral surfaces — elevation is expressed by container tone, not just shadow */
  --md-surface: #f8f9fc;
  --md-surface-container-low: #f1f3f8;
  --md-surface-container: #ecedf2;
  --md-surface-container-high: #e6e8ed;
  --md-surface-container-highest: #e0e2e8;
  --md-on-surface: #1a1c1e;          /* primary text */
  --md-on-surface-variant: #43474e;  /* muted text, icons, labels */

  /* Outline — only for outlined components and dividers */
  --md-outline: #73777f;
  --md-outline-variant: #c3c7cf;
}
```

### Categorical accent palette (canvas tones)

Circles and people are colored by category, not by sequence. Keep using the existing
`MATERIAL_TONES` set. Each tone is a full M3 tonal slice:

| Tone   | fill (container) | strong (border/center) | on-container (text) |
| ------ | ---------------- | ---------------------- | ------------------- |
| blue   | `#D2E4FF`        | `#00629D`              | `#001D35`           |
| red    | `#FFDAD6`        | `#C00015`              | `#410002`           |
| green  | `#D1E8D2`        | `#1E824A`              | `#00210B`           |
| amber  | `#FFE082`        | `#D87A00`              | `#2A1400`           |
| violet | `#EADDFF`        | `#7F67BE`              | `#21005D`           |

Text on a colored fill always uses that tone's on-container value — never plain black or
a generic gray.

---

## 2. Typography

Two weights only: **400 (regular)** and **500 (medium)**. The current code uses 760–900
everywhere; that is the single biggest reason the chrome does not read as Material 3.
Never use 600, 700, 800, or 900.

Use the Material 3 type scale (sizes in px):

| Role            | Size / Weight | Where                                   |
| --------------- | ------------- | --------------------------------------- |
| headline-small  | 24 / 400      | The big editable name in the inspector  |
| title-medium    | 16 / 500      | Panel titles, section headers           |
| title-small     | 14 / 500      | Sub-section headers                     |
| label-large     | 14 / 500      | Button text, segmented buttons          |
| label-medium    | 12 / 500      | Eyebrows, chips, dense labels           |
| body-medium     | 14 / 400      | Default body text                       |
| body-small      | 12 / 400      | Helper text, captions                   |

- Font family: Roboto is the native Material 3 face. Inter is acceptable as long as the
  weights stay at 400/500.
- Use **sentence case** for labels and buttons. Avoid `UPPERCASE` + letter-spacing
  eyebrows; if you need an eyebrow, use label-medium in sentence case and the
  `--md-on-surface-variant` color.

---

## 3. Shape (corner radius scale)

Use only these radii. No more 6/7/9px one-offs.

```css
--md-r-xs: 4px;    /* nested chips, small accents          */
--md-r-sm: 8px;    /* menu items, inputs, small buttons     */
--md-r-md: 12px;   /* cards, menus, panels (default)        */
--md-r-lg: 16px;   /* large sheets                          */
--md-r-xl: 28px;   /* side sheets, dialogs, bottom sheets   */
--md-r-full: 999px;/* pills: buttons, chips, FAB, brand     */
```

- Buttons are **pill-shaped** (`--md-r-full`) in Material 3.
- Cards, menus, and panels default to `--md-r-md` (12px).
- The inspector side sheet uses `--md-r-lg` or `--md-r-xl`.

---

## 4. Elevation

Material 3 expresses elevation with a combination of **surface container tone** plus a
**soft, layered shadow** — not a single heavy drop shadow.

```css
--md-elev-1: 0 1px 2px rgba(0,0,0,.30), 0 1px 3px 1px rgba(0,0,0,.15);
--md-elev-2: 0 1px 2px rgba(0,0,0,.30), 0 2px 6px 2px rgba(0,0,0,.15);
--md-elev-3: 0 4px 8px 3px rgba(0,0,0,.15), 0 1px 3px rgba(0,0,0,.30);
```

- Floating panels / menus: `--md-elev-2`, no border.
- The inspector / persistent surfaces: `--md-elev-1`.
- Do not put a `1.5px` hard border on a surface. Separate surfaces by tone + elevation.
  Use `--md-outline-variant` (1px) only for genuinely *outlined* components and dividers.

---

## 5. State layers

Interactive elements get a translucent overlay of the relevant role color on hover /
focus / press. Implement as a background tint on hover, not a color swap.

| State   | Opacity | Color base                        |
| ------- | ------- | --------------------------------- |
| hover   | 8%      | `--md-on-surface` (or `--md-primary` on tonal surfaces) |
| focus   | 10%     | same                              |
| pressed | 10%     | same                              |

Example hover: `background: color-mix(in srgb, var(--md-on-surface) 8%, transparent);`

---

## 5b. Motion

Interactions must give feedback, not flip state instantly. Material 3 uses short,
decelerating motion. Use the tokens (defined on `.app-shell`); never hardcode ad-hoc
durations or beziers.

```css
--md-ease-standard:   cubic-bezier(0.2, 0, 0, 1);
--md-ease-emphasized: cubic-bezier(0.2, 0, 0, 1);
--md-ease-decelerate: cubic-bezier(0.05, 0.7, 0.1, 1); /* enters */
--md-ease-accelerate: cubic-bezier(0.3, 0, 0.8, 0.15); /* exits  */
--md-ease-spring:     cubic-bezier(0.34, 1.45, 0.5, 1); /* expressive spatial: fast, slight overshoot */
--md-dur-short:  0.12s;  /* press feedback, small state changes */
--md-dur-medium: 0.22s;  /* panel / menu entrances              */
--md-dur-long:   0.32s;  /* larger sheets                       */
```

Rules of thumb:

- **Continuity over appear/disappear.** This is the core of M3 motion: interface elements
  persist and *move* rather than spawn and vanish. Selection state is an object that lives in
  the UI and slides between options — not a property that blinks on each item.
- **Selection should change, not blink.** Never toggle a per-item `outline`/`background` on
  `.is-selected`. Express the selected state with continuous motion, matched to the control:
  - **Shape morph** for swatch-like items (color swatches, presets): the selected item morphs
    from a circle to a rounded square (`border-radius: 50% → 8–9px`) with `--md-ease-spring`.
    Best when items are tightly packed and an extra ring/background would crowd them.
  - **Sliding indicator** (`SelectionIndicator`, `src/components/SelectionIndicator.tsx`) for
    segmented controls, tabs, and the active toolbar tool: one persistent pill/track that
    translates and resizes to the selected segment. Mount it in a `position: relative` group,
    tag each option with `data-ind-key`, drive it with `activeKey`. It moves with
    `--md-ease-spring` at `--md-dur-medium`; first placement on mount is instant, only later
    moves animate.
- **Surfaces that appear** (inspector, menus, dropdowns, prompts) enter with a fade plus a
  small translate/scale toward their resting position, `--md-dur-medium` + `--md-ease-decelerate`.
- **Press feedback is springy, not linear.** Interactive controls get `:active { transform: scale(...) }`
  transitioned with `--md-ease-spring` so they spring back on release (not a flat ease).
  Plain controls scale *down* on press (pills ~0.96, icon buttons ~0.9). Thumbs/handles
  scale *up* on grab (~1.18).
- **Connected button group (M3 Expressive) with Spring-Back return.** When several like controls sit in a single row and
  are pressed individually (color swatches, presets, a toolbar tool group), the pressed item
  **grows/squashes** and **only its immediate neighbours** react — each recoiling *away* from the pressed
  one. The press applies squash/recoil, and release triggers a multi-stage bouncy spring-back wobble:
  - **Pressing** (`.is-pressing`): Applied instantly on pointerdown. Active item scales down/squashes (`scaleX(1.12) scaleY(0.93)`), neighbors shift away (`translateX(-4.5px) scaleX(0.92) scaleY(1.04)` for left, positive `translateX` for right).
  - **Release/Returning** (`.is-returning`): Active for ~350ms on release. Triggers `@keyframes swatchSpringBack` (wobbles and settles to `scale(1)`) while neighbors play `@keyframes swatchNeighbor[Left/Right]SpringBack` (recoils organically back to `translateX(0) scale(1)`). Transitions are disabled (`transition: none !important`) during keyframes to prevent interference.
  Single row only — adjacency breaks across grid wraps.
  Canonical impl: the circle picker (`.quick-circle-colors`, `.circle-style-presets`).
- **Shape morph on state.** Selection/toggle changes morph the corner radius (circle ↔ rounded
  square) with `--md-ease-spring`, rather than toggling an outline. This is also valid as press
  feedback (corners briefly square on press) for pill/icon buttons.
- **Canvas nodes**: feedback is rendered in the draw loop, not CSS. Newly created nodes
  **grow in** through the transient board-animation loop (`startBoardAnim` / `AnimFrame` in
  `src/App.tsx`) — repaint only while an animation is live, then settle. Note: a selection
  *bounce* was tried and removed (looked bad); selection feedback comes from the inspector
  entrance and the existing selection emphasis, not from animating the node. The same loop also
  **morphs a circle's wavy amplitude** (`morph:<id>` anim → `AnimFrame.amplitudes`) on jumps, so
  shape changes ease instead of snapping. Only continuous params morph — `sides` (polygon/wave
  vertex count) is discrete and snaps.
- **Always honor `prefers-reduced-motion: reduce`**: a global CSS guard collapses animations
  and transitions to ~0; the canvas loop is skipped via `prefersReducedMotion()`.
- Don't add decorative motion that isn't feedback (e.g. a separate pulse ring) — animate the
  element the user acted on.

## 6. Component recipes

These are the canonical patterns. Reach for one of these before writing a new control.

### Buttons

- **Filled** (primary action): `background: --md-primary; color: --md-on-primary;`
  pill shape, height 40, label-large. Hover adds an 8% on-primary state layer.
- **Tonal** (secondary emphasis): `background: --md-primary-container;
  color: --md-on-primary-container;` pill, height 40.
- **Outlined**: transparent bg, `1px solid --md-outline-variant`, `color: --md-primary`,
  pill.
- **Text**: transparent bg, `color: --md-primary`, no border.
- **Destructive**: filled with `--md-error-container` / `--md-on-error-container`
  (or `--md-error` / `--md-on-error` for a stronger warning).

> Replaces today's `.primary-action` (dark `#1c2528` rectangle → blue on hover).

### Icon buttons (toolbar)

- 40×40, circular, transparent background, icon in `--md-on-surface-variant`.
- Hover/active = state layer. The **active/selected** state is a filled
  `--md-secondary-container` background.

### Segmented button

- An outlined container split into segments. The **selected** segment is filled with
  `--md-secondary-container` and shows a leading check. Unselected segments are
  transparent text.

> Replaces today's black-fill `Draw Connection / Move Circle` toggle.

### Switch

- Use a Material 3 **switch** for on/off, not a checkbox.

> Replaces the `Edges` / `Labels` checkboxes in the stress panel.

### Slider

- Use the reusable `M3Slider` (`src/components/M3Slider.tsx`) — don't hand-roll another or use a
  bare `input[type=range]`. Thick track (`--md-primary` active / `--md-surface-container-highest`
  inactive), a vertical **pill handle** (grows on press via `--md-ease-spring`), and a gap on each
  side of the handle.
- `variant="wave"` renders the active track as a sine wave whose amplitude grows with the value —
  use it when the value *is* a wave amount (e.g. the circle "Wavyness" control) so the slider
  visualises what it changes. `variant="plain"` (default) for everything else.

### Menu (e.g. create menu)

- Container: `--md-surface-container`, `--md-r-md`, `--md-elev-2`, no border.
- Items: min-height 48, leading icon 24 in `--md-on-surface-variant`, label body-medium,
  `--md-r-sm` hover target with an on-surface 8% state layer.

### Cards (e.g. note cards)

- `--md-surface-container`, `--md-r-md`, no hard Tailwind-gray borders. Optional 1px
  `--md-outline-variant` for an outlined card.

### Text fields

- Material 3 **filled** text field: `--md-surface-container-highest` background, no top
  border, focus shows a 2px `--md-primary` underline. Label in `--md-on-surface-variant`.

### Side sheet (inspector)

- `--md-surface-container-low`, `--md-r-lg`/`--md-r-xl`, `--md-elev-1`, no border.
  Section headers in title-small; the editable name is headline-small (24/400).

---

## 7. New feature checklist

Before merging any UI, confirm:

- [ ] All colors come from the role tokens — no raw hex in inline styles.
- [ ] Font weights are only 400 or 500.
- [ ] Radii come from the shape scale; buttons are pills.
- [ ] Surfaces use tone + `--md-elev-*`, not `1.5px` hard borders.
- [ ] Interactive elements have hover/focus/press state layers.
- [ ] Interactions give motion feedback (entrance for new surfaces, press feedback for
      controls) using the motion tokens, and honor `prefers-reduced-motion`.
- [ ] Controls use the recipe components (filled/tonal button, switch, segmented button,
      M3 slider, M3 menu) — not browser defaults or the old chrome style.
- [ ] Labels are sentence case.
- [ ] The feature is documented under [`features/`](features/README.md).
- [ ] Any notable design decision is recorded in [`DESIGN_LOG.md`](DESIGN_LOG.md).
