import type { Article, DocsCategory, NavSection } from './types'

export const DOC_SECTIONS: NavSection[] = [
  {
    title: 'Start',
    groups: [{ id: 'intro', title: 'Overview', articleIds: ['welcome'] }],
  },
  {
    title: 'Guides',
    groups: [{
      id: 'integrations',
      title: 'Connect a client',
      articleIds: ['mcp-server', 'cli-tool', 'local-linkedin-agent-search'],
    }],
  },
  {
    title: 'REST API reference',
    collapsible: true,
    groups: [
      { id: 'api-meta', title: 'Meta', articleIds: ['get-meta'] },
      { id: 'api-search', title: 'Search', articleIds: ['get-search', 'post-search-smart'] },
      {
        id: 'api-people',
        title: 'People',
        articleIds: [
          'post-people',
          'post-people-import-linkedin',
          'post-notes',
          'post-links',
          'delete-person',
          'delete-notes',
          'delete-links',
          'post-people-avatar',
        ],
      },
      {
        id: 'api-circles',
        title: 'Circles',
        articleIds: ['get-circles', 'post-circles', 'patch-circles', 'delete-circles', 'post-circles-avatar'],
      },
      {
        id: 'api-connections',
        title: 'Connections',
        articleIds: ['post-connections', 'delete-connection'],
      },
      {
        id: 'api-graph',
        title: 'Graph and batch',
        articleIds: ['get-graph', 'put-graph', 'clear-graph', 'batch-operations'],
      },
    ],
  },
]

export const DEFAULT_COLLAPSED = new Set(
  DOC_SECTIONS.flatMap((section) =>
    section.collapsible ? section.groups.map((group) => group.id) : [],
  ),
)

export function tokenizeSearch(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

export function scoreArticle(article: Article, tokens: string[]): number {
  if (tokens.length === 0) return 1

  const title = article.title.toLowerCase()
  const id = article.id.toLowerCase()
  const keywordBlob = article.keywords.join(' ').toLowerCase()

  let score = 0
  for (const token of tokens) {
    if (!title.includes(token) && !id.includes(token) && !keywordBlob.includes(token)) {
      return 0
    }
    if (title.includes(token)) score += 12
    if (id.includes(token)) score += 10
    if (keywordBlob.includes(token)) score += 6
    if (article.badge === token) score += 8
  }
  return score
}

export function categoryLabel(category: DocsCategory): string {
  if (category === 'api') return 'REST API'
  if (category === 'mcp') return 'MCP guide'
  if (category === 'cli') return 'CLI guide'
  return 'Getting started'
}
