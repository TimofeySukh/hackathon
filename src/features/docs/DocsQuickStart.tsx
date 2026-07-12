const QUICK_STARTS = [
  {
    href: '#docs/mcp-server',
    label: 'Connect with MCP',
    body: 'Give Cursor, Claude Desktop, or another compatible client access to your graph.',
    action: 'Open MCP setup',
  },
  {
    href: '#docs/cli-tool',
    label: 'Use the CLI',
    body: 'Search and update relationship context directly from your terminal.',
    action: 'Open CLI guide',
  },
  {
    href: '#docs/get-meta',
    label: 'Browse the REST API',
    body: 'Build a revision-safe integration with focused endpoint examples.',
    action: 'Open API reference',
  },
] as const

export default function DocsQuickStart() {
  return (
    <nav className="docs-quick-nav" aria-label="Choose an integration path">
      {QUICK_STARTS.map((item) => (
        <a key={item.href} className="docs-quick-card" href={item.href}>
          <span className="docs-quick-card__icon" aria-hidden="true">→</span>
          <strong>{item.label}</strong>
          <span className="docs-quick-card__hint">{item.body}</span>
          <span className="docs-quick-card__action">{item.action}</span>
        </a>
      ))}
    </nav>
  )
}

