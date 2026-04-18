# Product Vision

## Current Product Idea

The product is now an Obsidian-inspired graph viewer with folder-based navigation.

Each folder represents a separate graph space. The user can choose a folder from the left sidebar and explore its node network on the right.

## Core Interaction Goal

The graph should feel lightweight, readable, and spatial.

Users should be able to:

1. choose a folder from the sidebar
2. instantly open that folder as a graph
3. pan through the graph smoothly
4. zoom around the cursor
5. recognize clusters, hubs, and related notes visually

## Visual Goal

The graph should resemble the compact look of Obsidian graph view:

- small dots
- thin links
- readable labels
- dark neutral background
- restrained accent color on the focus node

The light theme should preserve the same structure and interaction model without turning the interface into a different product.

## Why This Direction

This gives the project a clearer product identity than a generic empty board.

Instead of being “just a canvas”, it becomes a visual explorer for folder knowledge and note relationships.

That makes the product easier to understand and easier to evolve later.

## MVP Priorities

1. Folder switching from the sidebar
2. Clear graph readability
3. Smooth panning and zooming
4. A convincing Obsidian-like visual style
5. Test data that is rich enough to validate the graph experience

## What We Intentionally Avoid Right Now

- graph editing tools
- note creation UI
- persistence
- backend storage
- collaboration
- filters and search
- graph physics simulation

## Possible Future Product Directions

- Real folder ingestion from the filesystem
- Search and filtering
- Highlighting links on hover
- Local graph mode around one node
- Note preview panels
- Tag coloring and graph grouping

## Product Principle

Every new feature should make the folder graph easier to explore, understand, or navigate.

If a feature does not improve graph exploration directly, it should wait.
