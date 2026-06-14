# Landing Page

## Purpose

The landing page provides a beautiful and clean entry point for the Social Datanode service. It introduces first-time visitors to the value proposition, outlines the core workflows (Create/Group, LinkedIn Import, AI Enrichment), highlights key features, and routes users to the interactive spatial board canvas.

## Behavior

- **Default Loading:** The landing page is displayed when a visitor hits the root URL `/` without active view query parameters/hashes.
- **Persistent Routing:** Clicking the "Launch App" CTA button changes the URL hash to `#board`, sets the view preference in `localStorage`, and switches the UI to the board canvas.
- **Auto-bypass:** If a user has previously launched the app (indicated by a `localStorage` flag or active `#board`/`?app=true` pathing), the landing page is automatically bypassed, loading the workspace immediately.
- **Return Path:** A "← Back to Landing Page" button is added to the settings panel of the board workspace. Clicking it redirects the user back to the landing page, updating both the React view state and URL hash.
- **Rotating Orbits:** A custom SVG graphic in the hero section features three orbit lines rotating at different speeds (`45s`, `70s`, `100s`) carrying categorized node representations that scale and glow on hover.

## Design

The page strictly follows the `docs/DESIGN_SYSTEM.md` styling parameters:
- **Surfaces / Elevation:** The header uses a translucent blurred background with `backdrop-filter`. The feature cards use `var(--md-surface-container-low)` and float up on hover with `--md-elev-2`.
- **Components:** Primary actions use filled M3 pills, secondary links use text buttons, and outline buttons are used for alternate CTAs. All text elements follow regular (`400`) and medium (`500`) font weights exclusively.
- **Color Roles:** Leverages `var(--md-primary)`, `var(--md-tone-blue)`, `var(--md-tone-violet)`, `var(--md-tone-green)`, and `var(--md-tone-amber)` to create a cohesive and bright Material 3 branding identity.

## Code

- **Main Component:** [LandingPage.tsx](../../src/LandingPage.tsx)
- **Main Stylesheet:** [landing.css](../../src/styles/landing.css)
- **App Shell Integration:** [App.tsx](../../src/App.tsx)
- **Key States:** `viewMode` (`'landing' | 'board'`) and `handleLaunchApp` function.

## Open questions / TODO

- None. The component is fully functional, statically typed, and matches the target Material 3 motion framework.
