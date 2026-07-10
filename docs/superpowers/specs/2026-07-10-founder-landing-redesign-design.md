# Founder landing redesign

## Goal

Make Social Datanode's landing page convincingly explain why a founder should use it:
turn an existing professional network into searchable relationship context, then make that
context available to the founder and their agents.

The page must remain minimal, calm, and Material 3 light. It must not invent customers,
metrics, performance claims, or product behavior.

## Audience and voice

Primary audience: startup founders and ambitious, technically capable operators who are
comfortable adopting AI coding tools and agent workflows.

Voice: confident, concise, and pragmatic. The page leads with the founder outcome rather
than a tutorial or generic feature inventory. MCP, CLI, and API are a visible advanced
advantage, not the first concept a new visitor has to understand. Privacy is not the
leading positioning or opening message.

## Page narrative

1. **Hero — relationship context for decisions.**
   - Headline: `Your network is full of answers. Stop losing them.`
   - Explain the visual graph of people, notes, groups, and links.
   - Keep the existing real board preview as the hero product surface.
   - Primary CTA: `Open your board`, which keeps the guided-board launch behavior.

2. **From archive to useful context.**
   - Show the truthful workflow: upload a LinkedIn ZIP, analyze its useful relationship
     signals, add derived context to the relevant people, then save the resulting graph.
   - State clearly that the uploaded ZIP and raw messages, invitations, and posts are not
     saved in the graph; the product saves the resulting people, connections, and derived
     context instead.
   - Mention that archive AI enrichment runs for signed-in imports without making an
     unsupported promise about a particular result for every contact.
   - Do not claim every contact receives AI relationship facts.

3. **Find people by what matters.**
   - Explain Smart Search with founder-relevant example queries.
   - Describe why a result matches by citing the person note or circle context.
   - Keep copy conditional where appropriate: Smart Search is a signed-in feature.

4. **Keep the relationship usable.**
   - Present circles, notes, links, action items, and the visual board as one compact
     relationship-memory workflow.
   - Use a small deck of rounded, offset note cards inspired by the board's person notes.
     The cards are supporting visual texture, not unrelated floating feature cards.

5. **Built for agent workflows.**
   - Give MCP, CLI, and API their own product proof section.
   - Message: an agent can work from the founder's relationship graph rather than from
     disconnected prompts or spreadsheets.
   - Link to the existing developer documentation instead of duplicating setup content.

6. **Closing CTA.**
   - Use an outcome-led prompt such as `Ready to get the context out of your head?`.
   - Repeat the board entry action only.

## Implementation boundaries

- `src/LandingPage.tsx` owns the reworked narrative, semantic sections, CTA handlers, and
  a code-native visual representation of the archive-to-context flow.
- `src/styles/landing.css` owns responsive visual hierarchy, presentation of proof cards,
  and mobile layout.
- `docs/features/landing-page.md` describes the new structure and CTA behavior.
- `docs/AI_CONTEXT.md` reflects the new landing CTA entry point; `docs/DESIGN_LOG.md`
  records the durable decision to lead with relationship context and position agent access
  as an explicit advanced workflow. The existing board screenshot is retained as the
  primary product visual because it makes the board and inspector immediately legible.

No API, CLI, MCP protocol, persistence schema, or enrichment implementation changes are
part of this redesign.

## CTA data flow

`Open your board` writes the existing onboarding session flag and navigates to `#board`.

## Error handling and accessibility

- Session storage failures remain non-blocking: the board CTA still navigates to the board,
  which retains its normal default experience.
- Buttons, headings, sections, and tables/cards retain semantic labels and keyboard access.
- The landing makes no unsupported mobile import promise; archive import remains product
  context inside Settings.

## Verification

- Run `npm run build` and `npm run lint`.
- Start or restart the local Vite server.
- Inspect the landing at desktop and phone widths for copy hierarchy, overflow, and CTA
  placement.
- Verify `Open your board` still forces the onboarding guide.
- Confirm every archive-processing and Smart Search claim matches current code and
  `docs/AI_CONTEXT.md`.

## Revision — board-first density pass

The landing must lead every visitor to the board, not directly to archive import. The
guided board is the first product experience; LinkedIn import remains an optional,
signed-in Settings action reached after that experience.

- Remove every landing CTA and inline link that opens LinkedIn import. Keep one clear
  action throughout the page: `Open your board`.
- Remove the blue pill-style overlines, including the founder audience label. They create
  visual noise without helping the main story.
- Expand the desktop composition rather than reducing content or section height. The hero
  product image becomes materially larger, while the headline copy gains enough width to
  avoid an unnecessarily tall stack of short lines.
- Reframe the three workflow cards around the board-first journey: open the board, map
  what matters, and keep context close. Every card is a same-height, keyboard-accessible
  path to the board with a restrained hover lift.
- Keep the LinkedIn ZIP explanation as small neutral helper copy, not a colored callout,
  link, or call to action. It explains the later Settings option truthfully without making
  import appear to be the first step.
- Fill the Search, notes, and agent sections with larger, denser product proof rather than
  creating more whitespace: a multi-result search surface, aligned note cards, and a
  larger MCP/CLI/API console.
- The closing section repeats only `Open your board`.
