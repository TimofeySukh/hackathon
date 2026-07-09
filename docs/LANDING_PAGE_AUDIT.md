# Landing Page Audit

Reviewed: 2026-07-09

This is an evidence-based product and conversion audit of the current landing page. It is
not a request to add generic SaaS sections or make claims the product cannot support.

## Current strengths

- The first viewport has a clear primary action and shows the real board product surface.
- The problem statement is understandable: relationship context should not remain in memory
  or in a flat spreadsheet.
- The page explains the spatial board, notes, circles, LinkedIn import, and private sync.
- The visual system is coherent: calm Material 3 surfaces, clear hierarchy, and a visible
  product screenshot instead of abstract decoration.

## Highest-priority gaps

### P0 — The page hides the product's strongest differentiated workflow

The page describes a visual board but not the workflow that turns a large contact archive
into useful relationship memory. A visitor cannot learn that Social Datanode can:

- import a LinkedIn archive into people and company circles;
- derive relationship context from selected messages, invitations, and posts after a
  signed-in archive import;
- preserve generated relationship summaries, tags, action items, and contact warmth as
  derived notes;
- use natural-language Smart Search to find people by role, company, and note context.

Relationship-fact queries such as “warmest contacts” and exact tag filters belong on the
landing only after the structured relationship-facts search design is implemented.

As a result, the landing reads like a pleasant manual whiteboard. It does not explain the
reason to choose the product over drawing circles in a general-purpose tool.

**Recommended addition:** a prominent “From contacts to context” product story immediately
after the hero. It should show the sequence `Import archive → AI extracts durable context →
search a relationship question → open the right person`, using real product screenshots or
an accurately recreated UI state.

### P0 — “Search” is mentioned but its outcome is invisible

The hero lists “Search, import, and let agents work” in one bullet. It does not show what
Smart Search returns or why it is useful. This is especially costly because search is the
fastest proof that the board remains usable after a large LinkedIn import.

**Recommended addition:** a Smart Search proof section with 2–3 grounded examples, such as:

- “Recruiters I spoke with about product roles”
- “People I met at WebConf”
- “Product managers at Google”

The section must use a real result card with its source explanation (note or circle
context). After structured relationship facts ship, it may also show `Warmth` and tags. Do
not show an invented result or imply that every imported contact has AI relationship facts.

### P0 — Archive enrichment is not presented as an opt-in value exchange

Visitors do not learn what archive AI enrichment reads, what it produces, or when it runs.
This leaves the import feature looking like a plain CSV-to-circles conversion and creates
uncertainty around the more valuable context workflow.

**Recommended addition:** a compact “What enrichment adds” comparison:

| Before enrichment | After enrichment |
| --- | --- |
| Name, company, role, connection date | Relationship summary, tags, warmth, action items, and event context when supported by the archive |

Copy must state that only relevant excerpts are processed to create derived notes and that
raw archive text is not persisted in the graph. The wording should be reviewed against the
actual implementation whenever this feature changes.

## Conversion and activation gaps

### P1 — The primary CTA starts with controls, not the visitor's goal

“Open guided board” is clear mechanically, but it sells the tutorial before it sells an
outcome. The first workflow presented below the fold also begins with “Learn the controls
first.” This is useful for onboarding but weak as the main activation narrative.

**Recommended adjustment:** keep the guided-board CTA, but pair it with outcome-led support
copy such as “Start with one person or import the contacts you already know.” Add a
secondary, non-competing CTA near the LinkedIn section that opens the board at the import
path rather than making visitors discover Settings themselves.

### P1 — The hero screenshot is attractive but does not resemble the user's data

The current demo graph uses well-known AI-company names. It demonstrates circles and the
inspector, but it does not visually connect to the LinkedIn/networking problem discussed in
the copy. It can read as a generic graph demo rather than a personal relationship system.

**Recommended adjustment:** retain the polished board composition, but add a second,
authentic-looking screenshot lower on the page showing imported companies, a contact note,
and a Smart Search result. Do not overload the hero with several screenshots.

### P1 — The capability table flattens feature importance

“Map the network,” “Import the raw list,” and “Let agents help” appear at equal weight.
The table does not communicate the differentiated sequence: import, enrich, retrieve, and
act. Agent access is valuable for advanced users but is not the first reason a new visitor
will sign up.

**Recommended adjustment:** reorder the narrative around user outcomes:

1. Map the people you already know.
2. Recover context from your imported history.
3. Find the right person with search.
4. Keep notes and action items attached to the graph.
5. Expose the graph to agents for advanced workflows.

## Trust and clarity gaps

### P2 — The page needs implementation-grounded expectations, not broad assurances

“Work privately” is helpful but underspecified next to LinkedIn import and AI enrichment.
At the same time, the landing should not become a legal page.

**Recommended addition:** a single factual line close to the archive-enrichment section:
“Your board is private; archive processing produces derived notes, while raw archive text
is not saved in the graph.” Link only to documentation that exists.

### P2 — No proof that the product works at realistic contact volume

The page does not address the natural objection: “Will this still work after I import
thousands of contacts?” The product has an explicit large-graph search and import
performance focus, but the landing does not express it.

**Recommended addition:** after measuring and agreeing on a truthful threshold, add a
small, qualified proof point about navigating a large imported graph. Do not publish a
number before it has a repeatable benchmark and clear hardware/context conditions.

### P2 — No social proof or founder credibility is visible in the main narrative

The Contact page exists, but the landing does not offer any credibility signal between the
hero and the final CTA. This does not require fabricated logos or testimonials.

**Recommended options:** link to a real founder/contact section, show a real use case, or
omit this section until authentic proof is available. Never add invented customer quotes,
company logos, or metrics.

## Recommended section order

1. Hero — private visual relationship board plus one strong CTA.
2. From contacts to context — LinkedIn archive import → derived relationship context.
3. Find people by what matters — Smart Search examples and explainable results.
4. Keep the relationship usable — notes, action items, links, and circles.
5. Advanced access — API/CLI/MCP for agents, clearly secondary.
6. Final CTA — open the board or import contacts.

## Acceptance criteria for a future landing revision

- A first-time visitor can explain Smart Search and archive enrichment without opening
  product docs.
- Every AI/relationship claim is traceable to current product behavior.
- Screenshots show the board, imported context, and search results rather than only a demo
  graph.
- The import/enrichment workflow has a clear next action from the landing page.
- The page does not add generic pricing, testimonial, logo-wall, or invented benchmark
  sections.
