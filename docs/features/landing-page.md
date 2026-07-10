# Landing Page

## Purpose

The landing page explains Social Datanode to startup founders and technically capable
operators: turn an existing professional network into searchable relationship context, then
give that context to the founder and their agents.

It is a polished Material 3 light product page. The voice is concise, confident, and
pragmatic; it does not lead with privacy, generic SaaS claims, customer logos, metrics, or
testimonials.

## Audience and narrative

The landing leads with the founder outcome, not a control tutorial or a generic feature
inventory:

1. **Hero — relationship intelligence.** The headline is `Your network is full of
   answers. Stop losing them.` A real board screenshot with the person inspector open
   makes the product immediately legible. The hero states the visual graph value and
   includes three concise benefits.
2. **From archive to action.** A LinkedIn ZIP becomes derived relationship context on
   people. The visible workflow is `Upload archive → Keep context → Move with clarity`.
3. **Find people by what matters.** Smart Search is presented with founder-relevant query
   examples and the explanation that names, circles, and notes make a result relevant.
   It is clearly marked as a signed-in feature.
4. **Keep the relationship usable.** Rounded, slightly offset note cards echo the board's
   person notes and show the kind of relationship context worth preserving.
5. **Built for agent workflows.** MCP, CLI, and API are a visible advanced workflow.
   This section links to the existing developer documentation rather than duplicating
   setup instructions.
6. **Closing CTA.** The final prompt is outcome-led: `Ready to get the context out of your
   head?`

## Archive processing claims

All landing copy must remain aligned with the implementation:

- A signed-in LinkedIn ZIP import starts archive AI enrichment automatically after the
  deterministic import.
- Relevant archive signals can become derived notes on the appropriate people.
- The uploaded ZIP and raw messages, invitations, and posts are not saved in the graph.
  The graph stores people, connections, and derived context.
- Do not imply that every imported person gets AI relationship facts or that anonymous
  imports receive archive AI context.

## CTA behavior

### Open your board

`Open your board` is the primary CTA in the hero and final section. It writes the existing
one-time onboarding session flag and navigates to `#board`, so the guided board opens even
for a returning browser that previously completed onboarding.

### Import LinkedIn archive

`Import LinkedIn archive` is the supporting CTA in the hero, archive, and final section.
It writes a one-time session flag and navigates to `#board`. The board consumes that flag,
opens the existing Settings panel, and shows the LinkedIn Data Import surface. It does not
start an upload, enrichment, or sign-in flow by itself.

If session storage is unavailable, both CTA handlers still navigate to the board's normal
entry state.

## Visual direction

- Use the existing board-and-inspector screenshot as the main product visual; it is a
  preview, not an interactive element.
- Use light surfaces, blue primary accents, calm shadows, and spacious typography.
- The archive workflow uses three clear cards, not generic feature-grid filler.
- Person-note inspired cards may have small desktop rotations and horizontal offsets; on
  phone widths they stack cleanly with no translated geometry.
- Keep the page light. A compact console-like panel may support the agent-access section,
  but the landing must not become a dark developer landing page.

## Header and routes

- Header: Social Datanode logo, Docs, Contact, Log in, Sign up (or Launch app when signed
  in).
- The landing logo returns to `#`; it does not open the board.
- Docs opens `#docs` and Contact opens `#contact`.
- Signed-in users can remain on the landing page until they choose a board CTA.

## Code

- Main component: [`LandingPage.tsx`](../../src/LandingPage.tsx)
- Main stylesheet: [`landing.css`](../../src/styles/landing.css)
- Board entry integration: [`App.tsx`](../../src/App.tsx)
- Main product screenshot: [`product-board-inspector.png`](../../src/assets/landing/product-board-inspector.png)
