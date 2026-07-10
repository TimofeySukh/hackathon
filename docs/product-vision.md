# Product Vision

See [`AI_CONTEXT.md`](AI_CONTEXT.md) for what is implemented today versus aspirational direction below.

## Current Product Idea

The product starts as a clean infinite board for social networking graphs.

This first version is intentionally limited:

- no drawing tools
- no widgets
- one compact details sidebar for the selected person
- no collaboration features
- no multiplayer presence

The core value right now is building and exploring relationship maps on a large visual surface.

## Interaction Goal

The board should feel calm and frictionless.

Users should be able to open the page and immediately:

1. start from a central node
2. drag out a connection from any node
3. release the cursor to create a new connected node
4. move across the board with a trackpad, mouse drag, mouse wheel, or by dragging empty space on mobile
5. optionally sign in with Google or email to claim a personal board space

6. save people, notes, tags, and connections to a private personal graph

## Visual Goal (target vs today)

**Target:** deep green-black dark theme and a brighter light theme, both with a visible dot grid.

**Today:** the shipped UI uses Material 3 **light** tokens across chrome and board (`src/styles/theme.css`).
A user-facing theme toggle is not implemented yet. The board still uses a dotted grid background.

The graph layer should feel compact and readable, with node growth happening through a direct drag gesture rather than extra UI chrome.

## Why This Direction

The project needs a strong custom foundation instead of a generic third-party canvas product.

Building the board ourselves keeps the interaction model simple and gives us complete control over:

- movement behavior
- theme design
- grid density and styling
- graph density and link shape
- future product objects and interactions

## MVP Priorities

1. Smooth drag-based navigation
2. Fast drag-to-create node growth
3. A distinctive visual identity
4. Minimal interface chrome with one focused inspector
5. A reliable account and persistence foundation for personal graph ownership

## What We Intentionally Avoid Right Now

- drawing tools
- sticky notes
- multiplayer
- templates

## Possible Future Product Directions

- Contact cards with richer metadata
- Relationship types and strengths
- Saved camera positions
- Multiplayer presence
- Domain-specific networking workflows

## Product Principle

Each new addition should protect the feeling of a clean and readable relationship map.

If a feature adds clutter before it adds value, it should not be introduced yet.
