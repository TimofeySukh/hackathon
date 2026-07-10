# Mobile Direct Controls and Single-Surface Design

## Goal

Make the touch board understandable without requiring people to learn persistent modes, and
prevent mobile panels from covering one another or the onboarding guide.

## Scope

Touch layouts only. Desktop mouse and trackpad behaviour remains unchanged.

## Direct controls

- Drag empty board space to pan; release can continue the existing inertial pan.
- Pinch with two fingers to zoom.
- Tap a person, circle, or connection to open its inspector.
- Drag a person or circle to move it; resize and centre-handle behaviour stays unchanged.
- Double-tap empty space to create a person.
- Hold empty space for 420 ms, then drag to marquee-select an area.
- Remove the persistent Edit, Select, and Pan rail entirely.

## Mobile surface rule

The following are mutually exclusive top-level workspace surfaces: Settings, Search, the
selection inspector, create actions, multi-select actions, Agent settings, and the LinkedIn
guide. Opening a surface closes the current one before showing the next.

Onboarding is not discarded when a workspace surface opens. Instead it is hidden while the
surface is active and reappears on its current step after the surface closes. Its normal
one-second completion advance remains unchanged.

## Verification

- A Playwright mobile viewport test verifies that Settings hides and then restores the
  onboarding coach, that the persistent mode rail is absent, and that opening Settings
  closes an open inspector.
- The existing mobile-search regression test, lint, and production build must remain clean
  apart from pre-existing lint warnings.
