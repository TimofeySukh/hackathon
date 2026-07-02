# Landing Page

## Purpose

The landing page should be a polished product landing page for Social Datanode.
It should use the user's sketch as the source of truth for the main layout and
turn that sketch into a clean, finished screen.

Do not invent a different concept. Do not replace the sketch with a generic SaaS
layout. Do not add unrelated API, CLI, or MCP marketing sections to the main
landing page.

## Reference Direction

Use Linear's landing/header as a reference for obvious product-page structure:

- a clean top navigation
- logo and product name
- central navigation links
- auth/actions on the right
- balanced spacing and careful proportions
- polished product-page typography

This does not mean making a dark page or copying colors blindly. The structure
and proportions matter more than decorative styling.

## Header

Required header items:

- `Docs`
- `Contact`
- `Log in`
- `Sign up`

Docs and Contact sit on the right side of the header, next to the auth actions.

Header requirements:

- It should feel like a normal polished landing-page header.
- It should follow the clear structure of the Linear reference.
- It should not become a huge black banner.
- It should not dominate the first screen.
- Clicking the Social Datanode logo on the landing page returns to the landing home
  (`#` / empty hash). It must not unexpectedly open the board; the board CTA owns that
  action.
- On `#docs`, `#contact`, and `#privacy`, the top-left brand control also returns to the
  landing home. Do not add a separate Back button in the docs header.
- `Contact` opens a separate contact screen at `#contact`.
- Active header nav item (`Docs` / `Contact`) uses a light primary-container pill, not the
  same filled style as Sign up / Launch App.
- On phone widths, the header uses two compact rows: logo plus auth action on the first
  row, Docs/Contact centered below. Header contents must never overflow horizontally.

Auth behavior:

- `Log in` and `Sign up` should use the same auth menu/dialog system as the
  board.
- The landing page should not simply dump the user onto the board with an auth
  modal as a visual surprise.
- The auth flow should feel intentional from the landing header and then move
  the user into the main product when appropriate.
- Signed-in users must still be able to open and stay on the landing page. Do not
  redirect authenticated visitors from the landing page to `#board` unless they click an
  explicit board CTA or navigate directly to `#board`.

## First Viewport

The first viewport is the product screenshot hero. It replaces the older
stepped-path sketch screen.

Required elements:

1. Header at the top.
2. A real product screenshot of the board with the inspector open.
3. A short headline, lead line, and three aligned bullet points beside the screenshot.
4. A single primary **Open board** button.
5. A short non-clickable reassurance line under the CTA.

Do not bring back the stepped-path ribbon as the main hero element.

The three hero points stay as a simple vertical list, not scattered deck cards.

The product screenshot is a visual preview only. Clicking it must not open the board or
perform any navigation; the button owns the hero CTA.

The hero copy must clearly introduce the user problem and the product answer:
people often keep relationship context in their head or in flat spreadsheets, while
Social Datanode turns people, notes, groups, and links into a visual board.

Current hero positioning:

- Headline: direct problem framing (`Stop managing people from memory and spreadsheets`).
- Lead: describes the product as a private visual board for people, notes, groups, and links.
- CTA note: explains that the board opens with lightweight progressive hints and that
  visitors can sign in later for private sync.
- The desktop product screenshot aligns with the top of the hero copy stack so the first
  viewport stays balanced and the preview reads at full size beside the CTA.

## Copy

Do not invent extra product claims beyond the user's provided direction.

The copy should stay short and should support the visual idea in the sketch.
Avoid long paragraphs in the hero.

The landing can communicate that Social Datanode helps organize relationship
information on a visual board, but it should not over-explain the product or add
new promises that were not requested.

Use a direct problem/solution structure near the top of the page. The problem is
that relationship knowledge is scattered across memory and non-visual tables. The
solution is a spatial interface for managing people, notes, groups, and links.

The landing narrative should use user actions and concrete product nouns before abstract
feature labels. Prefer verbs such as map, remember, import, search, attach, group, and sync.

## Below-the-fold Sections

After the hero, the landing page includes:

1. **Problem and solution** — a vertical Before → After stack with distinct styling:
   scattered memory in a muted dashed card, then a bridge label, then the product answer
   in a brighter primary-accent card.
2. **How it works** — three step cards describing progressive hints, first person,
   and organize-in-place workflow.
3. **Core Capabilities** — a compact two-column table (capability + what you get).
4. **LinkedIn import** — deck cards describing the import flow.
5. **Final CTA** — a quiet centered `Open board` section before the footer.

The hero owns the first and most important board CTA. A second **Open board** CTA is allowed
near the bottom after the product story has been explained.
Board CTAs navigate directly to `#board`; they do not set a session flag or force-open a
guide for returning browsers.

Deck cards across these sections share the white rounded-card, slight rotation,
and hover straightening behavior from the hero slogan stack.

Do not add a generic multi-column feature grid to the main landing page.

On phone widths, cards lose their scattered/translated geometry and stack in one clean
column. The mobile page must not rely on desktop rotations, negative margins, or hover
expansion that can push content outside the viewport.

The mobile hero uses a cropped product preview strip to keep the first screen focused and to
leave a visible hint of the next section.

## Docs

`Docs` should lead to existing documentation, not invented content.

The docs destination should expose the documentation/access material that
already exists in the product/project. The provided reference shows a docs/access
layout with:

- sidebar navigation
- `Agent access`
- `Quick setup`
- `MCP`
- `CLI`
- `API`
- `Keys`
- a `Full Wiki & Docs` link
- setup panels and copyable instructions

Do not create fake docs cards such as made-up API/CLI/MCP marketing summaries.
Use the real existing documentation/content and organize it in a polished docs
view.

## Contact

`Contact` in the header opens a separate screen at `#contact`, similar to `#docs`.

Founder cards show:

- avatar from the existing LinkedIn import presets in `public/`
- name and role (Timofey Sukhov — CEO, Velizar Seleznev — CTO)
- LinkedIn profile link
- email when provided in `TEAM_CONTACTS`

Do not invent contact details beyond what the team provides.

- Main component: [`ContactPage.tsx`](../../src/ContactPage.tsx)

## CTA Style

Primary CTAs should share one clear button structure:

- blue filled button or blue clickable note when used in the hero
- simple label
- polished spacing
- no extra decorative wrapper

Buttons should feel consistent across the landing page.

## What Not To Do

- Do not make the page dark.
- Do not create a large black header.
- Do not restore the stepped-path ribbon hero.
- Do not replace the product screenshot hero with a generic SaaS feature-card layout.
- Do not invent docs content.
- Do not put fake API/CLI/MCP summaries on the main landing page.
- Do not turn the three hero slogans into unrelated oversized cards.
- Do not make a similar-looking element when the instruction is to copy or
  transfer a specific element.

## Code

- Main component: [`LandingPage.tsx`](../../src/LandingPage.tsx)
- Board preview screenshots: [`src/assets/landing/`](../../src/assets/landing/)
- Stylesheet: [`landing.css`](../../src/styles/landing.css)
- App integration: [`App.tsx`](../../src/App.tsx) (`#contact`, `#privacy` view modes)
