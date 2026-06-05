# Material Circles Prototype

This branch contains a frontend-only design prototype for a calmer social map direction.

## Purpose

The prototype explores replacing the hackathon-era hacker graph look with a spatial relationship map built around large Material-style organic circles.

The intended product model is:

- circles represent life contexts such as family, school, work, hackathons, or local communities
- people live inside circles
- moving a circle moves its people as a unit
- resizing a circle gives a context more or less visual space
- zooming out can collapse a circle into a compact group summary

## Current Prototype Behavior

- No Supabase calls are made from the visible app screen.
- The graph data is hard-coded sample data in `src/App.tsx`.
- The board supports pointer panning.
- Mouse wheel zooms the board.
- Circles can be dragged.
- Circles can be resized from their bottom-right handles.
- People can be dragged inside their current circle.
- People are now global objects with group memberships instead of being owned by exactly one circle.
- Dropping a person into an overlap auto-attaches every circle containing that point.
- Dragging a person outside their primary circle expands and warps that circle instead of snapping the person back.
- Clicking a person opens a person card in the inspector.
- The person card supports local name and role editing.
- The person card supports manual membership toggles for every circle.
- The person card can place a person into any circle without removing their other memberships.
- The top toolbar and circle inspector can add a person to the selected circle.
- The top toolbar and circle inspector can create a new empty circle.
- The circle inspector supports editing the circle name and color.
- Soft relationship ribbons show relationships without drawing hard person-to-person graph lines.
- The person card lists soft relationships as navigable relationship cues.
- The right inspector updates when a circle is selected.
- Search dims non-matching circles and highlights matching people.

## Design Direction

The visual direction is calm and product-focused:

- light, soft spatial canvas instead of green-black hacker styling
- subtle dot grid for orientation
- translucent organic rounded circles inspired by Material You shapes
- overlapping blobs use translucent fills and multiply blending so the overlap reads as a mixed color
- restrained color clustering by relationship context
- compact person nodes that remain readable inside each circle

## Product Caveat

This is not yet a database schema or persistence decision. If this direction is accepted, the app should introduce a real group/circle model separately from tags.
