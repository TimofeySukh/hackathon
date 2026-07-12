# Developer documentation redesign

## Goal

Turn the public developer documentation into a clear continuation of the Social Datanode
landing experience. A visitor following the landing-page documentation link should retain
their sense of place, understand the available integration paths immediately, and reach a
useful setup guide or API reference without scanning a dense administration-style screen.

The redesign must preserve the current API, CLI, and MCP documentation coverage. This is
an information architecture, presentation, accessibility, and maintainability change; it
does not change any public protocol or command behavior.

## Audience and voice

Primary audience: technically capable founders, operators, and developers who want to
connect an agent or script to an existing Social Datanode graph.

Voice: concise, practical, and task-led. Prefer direct verbs such as `Connect`, `Install`,
`Authenticate`, and `Create`. Explain product-specific concepts once, then let examples
carry the detail. Use the `Social Datanode` product name consistently; `DataNode` alone is
reserved for technical identifiers that already use it.

## Approaches considered

1. **Product-integrated developer hub — selected.** Keep the documentation inside the
   application and give it the same brand, navigation, spacing, and Material 3 language as
   the landing page. Introduce a task-led documentation home, then place detailed guides
   and reference pages inside a dedicated docs shell.
2. **Cosmetic restyle only.** Retain the current single component and information
   architecture while changing colors and spacing. This is lower effort, but leaves the
   mobile hierarchy, literal Markdown defects, search limitations, and maintenance cost
   unresolved.
3. **External generated documentation site.** Adopt a separate docs framework or hosted
   reference product. This could improve long-term authoring, but adds deployment and
   synchronization overhead and makes the landing-to-docs transition less cohesive.

## Experience structure

### Shared product header

- Preserve the Social Datanode logo and product name when entering documentation.
- Keep a compact set of public navigation actions so the visitor can return to the
  product, contact page, or authentication flow without relying on browser history.
- Mark `Docs` as the current destination and add a restrained `Developer docs` context
  label instead of replacing the entire product identity.
- On small screens, keep the first header row compact and expose documentation navigation
  through one clearly labelled contents control.

### Documentation home

- Lead with the single page-level heading `Build with Social Datanode` and one short
  explanation of agent and programmatic access.
- Present three primary routes in this order:
  1. `Connect with MCP`
  2. `Use the CLI`
  3. `Browse the REST API`
- Each route states who it is for, the expected first outcome, and one clear action.
- Keep authentication guidance visible near these routes, but do not make token details a
  competing fourth route.
- Replace the four large generic welcome cards with three compact, task-specific cards.
  On phones, their summary remains visible without pushing the first useful setup content
  beyond the initial viewport.

### Guides and reference

- Separate task-led guides from endpoint reference in the navigation.
- Desktop uses a persistent left navigation, a readable main column, and an optional local
  table of contents only for long articles.
- Mobile uses a modal navigation drawer. Closing the drawer returns focus to its trigger.
- Every article has one `h1`, optional breadcrumbs, a short purpose statement, and logical
  heading order.
- Endpoint reference keeps method, path, authentication, parameters, examples, and error
  behavior visually distinct without turning the whole page into a dense console.

### Search

- Provide a full-width-enough search field whose placeholder cannot be clipped.
- Search titles, descriptions, endpoint paths, CLI commands, and MCP tool names from one
  explicit content index.
- Results identify their section and destination. Keyboard navigation, Escape-to-close,
  focus management, and a useful empty state are required.

## Visual system

- Follow `docs/DESIGN_SYSTEM.md`: Material 3 roles, sentence case, and only font weights
  400 and 500.
- Continue the landing page's calm white and neutral surfaces, rounded containers, and
  blue primary action color. Documentation may be denser than marketing content, but must
  still feel like the same product.
- Remove uppercase, letter-spaced labels and unsupported 600/700 font weights.
- Use design tokens instead of raw colors wherever a Material role exists. Syntax and HTTP
  method colors may use dedicated documented tokens because they encode technical meaning.
- Active navigation uses a filled tonal state, not only a thin color change. Hover and
  focus states must remain distinct.
- Motion is limited to short drawer, search, and route-content transitions and respects
  `prefers-reduced-motion`.

## Content quality

- Replace literal Markdown characters currently displayed in JSX with semantic elements.
  Important labels use `<strong>` and identifiers use `<code>`; users must never see
  authoring syntax such as `**Agent Token**` or raw backticks.
- Use consistent product naming and remove duplicate explanations.
- Retain every current public endpoint, CLI command, and MCP tool. A content inventory test
  or fixture should make accidental omissions visible during the refactor.
- Code examples remain copyable and provide accessible success feedback without inline
  presentation styles.

## Component and content architecture

The current `src/DocsPage.tsx` combines the application shell, navigation, search, article
content, and interaction logic in one large file. Split responsibilities while keeping
the public hash routes stable.

- `src/DocsPage.tsx` remains the route-level composition entry point.
- A dedicated docs feature directory owns the header, navigation drawer, search interface,
  article layout, quick-start cards, code blocks, and endpoint presentation components.
- Navigation and search metadata come from a single typed content registry rather than
  independent hard-coded lists.
- Article content is separated by topic so API, CLI, and MCP changes can update a focused
  source file while still satisfying the repository synchronization rule.
- Existing deep links under `#docs/...` must continue to resolve. Unknown doc routes return
  to the docs home with a visible not-found explanation rather than a blank page.

## Responsive and accessibility requirements

- Verify layouts at 393 px, 820 px, 1024 px, and a wide desktop viewport.
- No header control, search placeholder, code sample, endpoint path, or table may overflow.
- The primary article begins high enough on phone screens to communicate useful content
  without scrolling through a full viewport of navigation cards.
- Navigation, search, accordions, copy actions, and route changes are keyboard accessible.
- Use landmarks and semantic lists, maintain visible focus, announce search result counts
  and copy success, and meet WCAG AA text contrast.

## Documentation updates

- Add a feature document under `docs/features/` and link it from the feature index.
- Update `docs/AI_CONTEXT.md`, `docs/PROJECT_MAP.md`, and `docs/ARCHITECTURE.md` if the
  component structure changes as planned.
- Record the durable information architecture and shared-brand decision in
  `docs/DESIGN_LOG.md`.
- No API, CLI, or MCP behavior documentation should change unless verification finds the
  current public docs out of sync with the implementation.

## Verification

- Run the repository lint, unit tests, production build, and full quality gate.
- Add focused tests for public docs routing, deep links, search results, mobile navigation,
  heading structure, and representative API/CLI/MCP content coverage.
- Inspect the landing-to-docs transition in the in-app browser at desktop and phone widths.
- Exercise search and the mobile drawer with keyboard input.
- Confirm that no literal Markdown emphasis or code markers remain in rendered prose.
- Restart the local development server after the change and verify `#docs` directly.
