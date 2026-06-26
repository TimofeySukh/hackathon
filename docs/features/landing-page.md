# Landing Page

## Purpose

The landing page must communicate one product idea: Social Datanode turns messy
relationship information into an organized visual board.

It is not a generic startup marketing page. It should not lead with API, CLI, or
MCP material. It should show that contacts, companies, notes, follow-ups, and
connections can be sorted into a readable board.

## Core Message

The first screen should make this clear:

- relationship data starts as chaos
- people can be sorted into zones
- each person keeps their context: zone, photo, notes, and connections
- opening the board starts from a clean workspace

Keep the copy short. Avoid long explanatory paragraphs in the hero.

## Header

The header should copy the structure of Linear's header instead of loosely
imitating it.

Required structure:

- light page background
- narrow navigation bar near the top
- logo and product name on the left
- navigation links in the center
- authentication/actions on the right
- visually compact proportions

Required links/actions:

- `Product`
- `Docs`
- `Contact`
- `Log in`
- `Sign up`

`Log in` and `Sign up` must open the same authentication dialogs used by the
main board. After the auth flow, the user should be in the main product.

`Contact` can be inert for now.

Do not make the whole landing visually black. If the Linear reference uses a
dark header, only copy the compact header structure and proportions, not a large
black banner.

## First Viewport

The first viewport should follow the provided sketch closely.

Required composition:

1. Header at the top.
2. Three primary slogans above the separator.
3. A stepped separator as the central visual motif.
4. One blue-ish note below the separator.
5. The blue note acts as the main CTA and opens the board.

The three slogans are not three large SaaS cards. They should read as part of
the hero composition around the stepped separator.

The blue CTA note should look clickable. It should not be buried among many
other cards.

## Hero Copy Direction

The exact text can change, but it should stay close to these meanings:

- sort the chaos of contacts and relationships
- put people into clear zones
- open the board and act on the context

Avoid API language, tool jargon, and long product explanations in the hero.

## Stepped Separator

The stepped separator is a required visual element.

It should:

- divide the upper slogans from the lower CTA note
- feel connected to the board/relationship-map visual language
- preserve the stepped shape from the sketch
- stay visually central on the first screen

Do not turn it into unrelated decorative stairs with random marketing cards
placed on top.

## Interactive Product Demo

The interactive section should be a concrete person inspector demo, not an
abstract marketing preview.

Required fields and actions:

- editable person name
- zone selector
- three zones: `Anthropic`, `Google`, `OpenAI`
- photo upload/preview
- notes
- connections

The demo must be local-only. It should not save to Supabase, localStorage, or
the real board graph.

The demo should visually match the real board inspector enough that users
understand this is the product interaction model.

## Docs

The main landing page should not contain the large technical documentation.

The header should include a `Docs` button. That destination is where existing
technical docs belong, including API, CLI, MCP, setup, and operational material.

Do not invent new API/CLI/MCP marketing cards for the landing page. Move or
surface the real documentation there instead.

## Contact

`Contact` does not need a finished page yet. It can be a placeholder or inert
button until the contact flow is defined.

## CTA Buttons

Primary CTA buttons should use the same general structure:

- blue filled button
- pill shape where appropriate
- simple label
- no extra decorative wrapper

The blue hero note is the main first-screen CTA. Other CTA buttons should feel
related to it, not like unrelated components.

## What Not To Do

- Do not make a dark landing page.
- Do not create a large black header/banner.
- Do not replace the sketch with a generic SaaS card layout.
- Do not put API, CLI, or MCP content on the main hero.
- Do not invent placeholder technical documentation.
- Do not make the first three slogans into oversized independent cards.
- Do not make a similar-looking block when the instruction is to transfer a
  specific element.
- Do not save interactive demo edits to real product data.

## Code

- Main component: [`LandingPage.tsx`](../../src/LandingPage.tsx)
- Stylesheet: [`landing.css`](../../src/styles/landing.css)
- App integration: [`App.tsx`](../../src/App.tsx)
