# Product Vision

## Current Product Idea

The product starts as a clean infinite board that focuses on movement, space, and atmosphere.

This first version is intentionally limited:

- no drawing tools
- no widgets
- no sidebars
- no collaboration features
- no board content persistence

The core value right now is simple navigation across a large visual surface.

## Interaction Goal

The board should feel calm and frictionless.

Users should be able to open the page and immediately:

1. drag the board with the mouse
2. move across the board with a trackpad or mouse wheel
3. understand the available space from the point grid
4. switch between dark and light visual modes
5. optionally sign in with Google to claim a personal board space

## Visual Goal

The dark theme should feel deep, green-black, and slightly futuristic, similar to the provided reference.

The light theme should keep the same product identity while becoming brighter, cleaner, and easier to use in daylight conditions.

The board background should include visible point markers at regular intervals, similar to spatial references on tools like Miro.

## Why This Direction

The project needs a strong custom foundation instead of a generic third-party canvas product.

Building the board ourselves keeps the interaction model simple and gives us complete control over:

- movement behavior
- theme design
- grid density and styling
- future product objects and interactions

## MVP Priorities

1. Smooth drag-based navigation
2. A distinctive visual identity
3. Minimal interface chrome
4. A codebase that is easy to extend with custom board objects later
5. A lightweight account foundation for personal board ownership

## What We Intentionally Avoid Right Now

- drawing tools
- sticky notes
- comments
- multiplayer
- board object persistence
- templates

## Possible Future Product Directions

- Custom cards or blocks placed on the board
- Project nodes and connectors
- Spatial planning views
- Board persistence and saved camera positions
- Multiplayer presence
- Domain-specific interaction tools

## Product Principle

Each new addition should protect the feeling of a clean board.

If a feature adds clutter before it adds value, it should not be introduced yet.
