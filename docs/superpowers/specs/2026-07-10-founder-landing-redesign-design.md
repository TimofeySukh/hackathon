# Founder landing redesign

## Goal

Make Social Datanode's landing page convincingly explain why a founder should use it:
turn an existing professional network into private, searchable relationship context, then
make that context available to the founder and their agents.

The page must remain minimal, calm, and Material 3 light. It must not invent customers,
metrics, performance claims, or product behavior.

## Audience and voice

Primary audience: startup founders and ambitious, technically capable operators who are
comfortable adopting AI coding tools and agent workflows.

Voice: confident, concise, and pragmatic. The page leads with the founder outcome rather
than a tutorial or generic feature inventory. MCP, CLI, and API are a visible advanced
advantage, not the first concept a new visitor has to understand.

## Page narrative

1. **Hero — relationship context for decisions.**
   - Headline: `Your network is full of answers. Stop losing them.`
   - Explain the private visual graph of people, notes, groups, and links.
   - Keep the existing real board preview as the hero product surface.
   - Primary CTA: `Open your board`, which keeps the guided-board launch behavior.
   - Supporting action: `Import your LinkedIn archive`, which opens the board directly at
     the LinkedIn import surface.

2. **From contacts to context.**
   - Show the truthful workflow: import a LinkedIn archive, receive derived relationship
     notes when signed in, then retrieve the relevant person through search.
   - State that the graph saves derived notes, not raw archive text.
   - Do not claim every contact receives AI relationship facts.

3. **Find people by what matters.**
   - Explain Smart Search with founder-relevant example queries.
   - Describe why a result matches by citing the person note or circle context.
   - Keep copy conditional where appropriate: Smart Search is a signed-in feature.

4. **Keep the relationship usable.**
   - Present circles, notes, links, action items, and the visual board as one compact
     relationship-memory workflow.

5. **Built for agent workflows.**
   - Give MCP, CLI, and API their own product proof section.
   - Message: an agent can work from the founder's private relationship graph rather than
     from disconnected prompts or spreadsheets.
   - Link to the existing developer documentation instead of duplicating setup content.

6. **Closing CTA.**
   - Repeat both paths: open the board or start with a LinkedIn archive.

## Implementation boundaries

- `src/LandingPage.tsx` owns the reworked narrative, semantic sections, CTA handlers, and
  a code-native visual representation of the import-to-context flow.
- `src/styles/landing.css` owns responsive visual hierarchy, presentation of proof cards,
  and mobile layout.
- `src/App.tsx` consumes a narrowly-scoped session flag that opens Settings at the existing
  LinkedIn import surface after the route changes to `#board`.
- `docs/features/landing-page.md` describes the new structure and CTA behavior.
- `docs/AI_CONTEXT.md` reflects the new landing CTA entry point; `docs/DESIGN_LOG.md`
  records the durable decision to lead with relationship context and position agent access
  as an explicit advanced workflow.

No API, CLI, MCP protocol, persistence schema, or enrichment implementation changes are
part of this redesign.

## CTA data flow

`Open your board` writes the existing onboarding session flag and navigates to `#board`.

`Import your LinkedIn archive` writes a new, one-time session flag and navigates to
`#board`. During board initialization, `App.tsx` consumes the flag and opens the existing
Settings panel. It does not upload files, invoke enrichment, or bypass any existing
consent/authentication requirement.

## Error handling and accessibility

- Session storage failures remain non-blocking: both CTA handlers still navigate to the
  board, which retains its normal default experience.
- Buttons, headings, sections, and tables/cards retain semantic labels and keyboard access.
- The import entry point provides helpful board-local context when an archive is unavailable
  on a phone; no unsupported mobile import promise is made in the landing copy.

## Verification

- Run `npm run build` and `npm run lint`.
- Start or restart the local Vite server.
- Inspect the landing at desktop and phone widths for copy hierarchy, overflow, and CTA
  placement.
- Verify `Open your board` still forces the onboarding guide.
- Verify `Import your LinkedIn archive` opens the board and its existing Settings import
  surface without starting an upload.
- Confirm every enrichment and Smart Search claim matches current code and
  `docs/AI_CONTEXT.md`.
