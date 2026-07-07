import { useState, useMemo, useEffect, useRef, useCallback, type MouseEvent } from 'react'
import sdnLogo from './assets/sdn-logo.svg'

type Article = {
  id: string
  category: 'getting-started' | 'mcp' | 'cli' | 'api'
  title: string
  keywords: string[]
  badge?: 'get' | 'post' | 'delete'
  render: (copyFn: (text: string, msg: string) => void) => React.ReactNode
}

type NavGroup = {
  id: string
  title: string
  articleIds: string[]
}

type NavSection = {
  title: string
  groups: NavGroup[]
  collapsible?: boolean
}

const DOC_SECTIONS: NavSection[] = [
  {
    title: '',
    groups: [{ id: 'intro', title: 'Getting started', articleIds: ['welcome'] }],
  },
  {
    title: 'Integrations',
    groups: [{ id: 'integrations', title: 'Clients', articleIds: ['mcp-server', 'cli-tool'] }],
  },
  {
    title: 'REST API',
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
        title: 'Graph & batch',
        articleIds: ['get-graph', 'put-graph', 'clear-graph', 'batch-operations'],
      },
    ],
  },
]

const DEFAULT_COLLAPSED = new Set(
  DOC_SECTIONS.flatMap((section) =>
    section.collapsible ? section.groups.map((group) => group.id) : [],
  ),
)

function readArticleIdFromHash(): string {
  const hash = window.location.hash
  if (hash.startsWith('#docs/')) {
    return hash.slice('#docs/'.length) || 'welcome'
  }
  return 'welcome'
}

function tokenizeSearch(query: string): string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
}

function scoreArticle(article: Article, tokens: string[]): number {
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

export default function DocsPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeArticleId, setActiveArticleId] = useState(readArticleIdFromHash)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set(DEFAULT_COLLAPSED))
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null)
  const contentRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  const handleCopy = (text: string, msg: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedStatus(msg)
      setTimeout(() => setCopiedStatus(null), 2500)
    }).catch(() => {
      // fallback
    })
  }

  const articles: Article[] = useMemo(() => [
    {
      id: 'welcome',
      category: 'getting-started',
      title: 'Welcome & Getting Started',
      keywords: ['welcome', 'start', 'getting started', 'intro', 'key', 'token', 'authorization'],
      render: () => (
        <div>
          <h2>DataNode Developer Wiki</h2>
          <p>
            Welcome to the DataNode Developer Portal. DataNode is a social graph board application designed to model relationships, circles, and connections.
            This portal provides everything you need to connect remote AI agents, terminal command-line interfaces (CLIs), and custom integrations directly to your social graph.
          </p>

          <h3>Authentication</h3>
          <p>
            All API requests must be authenticated using a revocable, scoped **Agent Token**. You can generate these keys in the application:
          </p>
          <ol style={{ lineHeight: '1.6', fontSize: '14px', color: 'var(--md-on-surface-variant)' }}>
            <li>Open the DataNode board workspace.</li>
            <li>Click the **Settings** (gear icon) in the top right.</li>
            <li>Select the **Agent API** panel.</li>
            <li>Navigate to the **Keys** tab, enter a descriptive name, and click **Create key**.</li>
            <li>Copy the generated token (`dn_live_...`) immediately. It is stored as a secure hash and will not be displayed again.</li>
          </ol>

          <div className="docs-alert info">
            <div className="docs-alert-title">Authorization Header</div>
            <p className="docs-alert-body">
              Include your token as a Bearer credential in the standard HTTP request headers:
              <code style={{ display: 'block', marginTop: '8px', padding: '6px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', fontFamily: 'monospace' }}>
                Authorization: Bearer dn_live_&lt;your-token&gt;
              </code>
            </p>
          </div>

          <h3>Concurrency & Revision Checking</h3>
          <p>
            To prevent concurrent edits from overwriting each other, the DataNode graph API implements optimistic revision concurrency control:
          </p>
          <ul style={{ lineHeight: '1.6', fontSize: '14px', color: 'var(--md-on-surface-variant)' }}>
            <li>Every mutation request requires an <code>expectedRevision</code> parameter.</li>
            <li>You can fetch the current revision of your graph from the <code>GET /graph/meta</code> endpoint.</li>
            <li>If the current revision on the server does not match your <code>expectedRevision</code>, the server rejects the request with a <code>409 Conflict</code> and includes the current <code>revision</code>.</li>
            <li>When receiving a <code>409</code>, use the returned revision or read the latest metadata, resolve the payload differences, and retry the mutation.</li>
          </ul>
        </div>
      )
    },
    {
      id: 'mcp-server',
      category: 'mcp',
      title: 'Model Context Protocol (MCP)',
      keywords: ['mcp', 'model context protocol', 'claude', 'desktop', 'cursor', 'windsurf', 'server'],
      render: (copy) => {
        const snippet = `{
  "mcpServers": {
    "datanode": {
      "command": "npx",
      "args": ["-y", "github:TimofeySukh/hackathon"],
      "env": {
        "DATANODE_API_URL": "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1",
        "DATANODE_API_TOKEN": "dn_live_your_token_here"
      }
    }
  }
}`
        return (
          <div>
            <h2>Model Context Protocol (MCP)</h2>
            <p>
              The Model Context Protocol (MCP) allows LLM clients (such as Claude Desktop, Cursor, or Windsurf) to securely inspect and edit your social graph.
              Our MCP server runs universally via `npx` without requiring a local clone.
              Tool calls return a structured JSON envelope with <code>status</code>, <code>summary</code>, <code>data</code>, and <code>next_valid_actions</code>.
            </p>

            <h3>Configuration</h3>
            <p>
              Add the following configuration block to your client's MCP configuration settings file (e.g., <code>claude_desktop_config.json</code>):
            </p>

            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>claude_desktop_config.json</span>
                <button className="docs-code-copy-btn" onClick={() => copy(snippet, 'MCP config copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{snippet}</code>
              </pre>
            </div>

            <h3>Exposed Tools</h3>
            <p>
              Once connected, the following tools are made available to the AI assistant. Large, experimental, bulk, or destructive changes should be preceded
              by <code>export_graph</code> or explicit user confirmation.
            </p>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Tool Name</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="docs-param-name">list_capabilities</td>
                  <td>List DataNode MCP capabilities with compact risk and side-effect metadata.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">search_people_and_circles</td>
                  <td>Search the graph by person name, circle, notes, links, or circle name.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">list_circles</td>
                  <td>List circles with ids, parent ids, paths, and people counts.</td>
                </tr>
                 <tr>
                  <td className="docs-param-name">create_person</td>
                  <td>Create a person in a circle. Position is calculated automatically.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">import_linkedin_person</td>
                  <td>Import or update a person by their LinkedIn profile URL.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">add_note</td>
                  <td>Add a text note to a person.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">add_link</td>
                  <td>Add a social link (LinkedIn, Telegram, X, etc.) to a person.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">create_connection</td>
                  <td>Create a relationship connection (line) between two node IDs.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">batch_operations</td>
                  <td>Run a small transactional batch of person.create, note.create, or link.create operations.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">delete_person</td>
                  <td>Delete a person node from the graph.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">delete_note</td>
                  <td>Delete a specific note from a person.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">delete_link</td>
                  <td>Delete a specific link/social connection from a person.</td>
                </tr>
                 <tr>
                  <td className="docs-param-name">delete_connection</td>
                  <td>Delete a relationship connection between two nodes.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">export_graph</td>
                  <td>Retrieve the entire social graph JSON. Recommended for backup before changes.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">import_graph</td>
                  <td>Replace the entire graph with a new graph JSON.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">clear_graph</td>
                  <td>Clear the graph, resetting it.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">create_circle</td>
                  <td>Create a circle (standalone or nested).</td>
                </tr>
                <tr>
                  <td className="docs-param-name">update_circle</td>
                  <td>Update properties of a circle.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">delete_circle</td>
                  <td>Delete a circle (detaches people in place; nested circles move to parent).</td>
                </tr>
                <tr>
                  <td className="docs-param-name">upload_avatar</td>
                  <td>Upload/set a photo or avatar for a person or circle (Base64 or URL).</td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      }
    },
    {
      id: 'cli-tool',
      category: 'cli',
      title: 'CLI Client',
      keywords: ['cli', 'command line', 'terminal', 'install', 'datanode-cli'],
      render: (copy) => {
        const installCmd = `npm install -g github:TimofeySukh/hackathon`
        const npxCmd = `npx -y --package github:TimofeySukh/hackathon datanode-cli circles`
        return (
          <div>
            <h2>CLI Client</h2>
            <p>
              The command-line interface (CLI) client allows you to query and edit your social graph directly from your terminal.
            </p>

            <h3>Option A: Run On-The-Fly (NPX)</h3>
            <p>
              Execute commands immediately without cloning or globally installing anything:
            </p>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>Terminal</span>
                <button className="docs-code-copy-btn" onClick={() => copy(npxCmd, 'npx command copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{`export DATANODE_API_URL="https://.../functions/v1/graph-api/v1"
export DATANODE_API_TOKEN="dn_live_..."

${npxCmd}`}</code>
              </pre>
            </div>

            <h3>Option B: Global Installation</h3>
            <p>
              Install the CLI tool globally via npm for faster startup and native access:
            </p>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>Terminal</span>
                <button className="docs-code-copy-btn" onClick={() => copy(installCmd, 'Install command copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{installCmd}</code>
              </pre>
            </div>

            <h3>CLI Usage Guide</h3>
            <p>Once installed, you can invoke the CLI with the following commands:</p>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Command</th>
                  <th>Arguments</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="docs-param-name">meta</td>
                  <td>None</td>
                  <td>Inspect graph size counts and revision.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">search</td>
                  <td><code>&lt;query&gt; [limit]</code></td>
                  <td>Search people, circles, and notes.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">circles</td>
                  <td>None</td>
                  <td>List all circles.</td>
                </tr>
                 <tr>
                  <td className="docs-param-name">people:add</td>
                  <td><code>&lt;circleId&gt; &lt;name&gt; [note]</code></td>
                  <td>Add a new person inside a circle.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">people:import-linkedin</td>
                  <td><code>&lt;url&gt;</code></td>
                  <td>Import or update a person by their LinkedIn profile URL.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">notes:add</td>
                  <td><code>&lt;personId&gt; &lt;body&gt;</code></td>
                  <td>Add a note to a person.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">links:add</td>
                  <td><code>&lt;personId&gt; &lt;service&gt; &lt;url&gt; [label]</code></td>
                  <td>Add a social link to a person.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">connections:add</td>
                  <td><code>&lt;fromId&gt; &lt;toId&gt;</code></td>
                  <td>Create a connector link between two nodes.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">operations:run</td>
                  <td><code>&lt;filePath&gt;</code></td>
                  <td>Run a JSON file containing a batch operations array.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">people:delete</td>
                  <td><code>&lt;personId&gt;</code></td>
                  <td>Delete a person node.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">notes:delete</td>
                  <td><code>&lt;personId&gt; &lt;noteId&gt;</code></td>
                  <td>Delete a note from a person.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">links:delete</td>
                  <td><code>&lt;personId&gt; &lt;linkId&gt;</code></td>
                  <td>Delete a social link from a person.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">connections:delete</td>
                  <td><code>&lt;connectionId&gt;</code></td>
                  <td>Delete a connector link.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">graph:export</td>
                  <td>None</td>
                  <td>Retrieve the entire social graph JSON. Recommended for backups.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">graph:import</td>
                  <td><code>&lt;filePath&gt;</code></td>
                  <td>Replace the entire graph with a local JSON file.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">graph:clear</td>
                  <td>None</td>
                  <td>Reset the graph, deleting all circles/people.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">circles:add</td>
                  <td><code>&lt;name&gt; [parentId] [connectedTo]</code></td>
                  <td>Create a new circle.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">circles:update</td>
                  <td><code>&lt;circleId&gt; &lt;field&gt; &lt;value&gt;</code></td>
                  <td>Update properties of a circle.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">circles:delete</td>
                  <td><code>&lt;circleId&gt;</code></td>
                  <td>Delete a circle (detaches people in place; nested circles move to parent).</td>
                </tr>
                <tr>
                  <td className="docs-param-name">avatars:upload</td>
                  <td><code>&lt;type&gt; &lt;id&gt; &lt;base64OrUrlOrFilePath&gt;</code></td>
                  <td>Upload/set avatar or photo for a person or circle.</td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      }
    },
    {
      id: 'local-linkedin-agent-search',
      category: 'cli',
      title: 'Local LinkedIn Agent Search',
      keywords: ['linkedin', 'jsonl', 'agent search', 'grep', 'local', 'token budget'],
      render: (copy) => {
        const statsCmd = `npm run --silent linkedin:agent-search -- stats`
        const searchCmd = `npm run --silent linkedin:agent-search -- search "founder agile" --budget-tokens 30000`
        const pinnedCmd = `npm run --silent linkedin:agent-search -- search "role:coach circle:Novo" \\
  --data /Users/velizard/Downloads/linkedin-graph-export-2026-06-14-basic/people-for-llm.jsonl`
        return (
          <div>
            <h2>Local LinkedIn Agent Search</h2>
            <p>
              This read-only helper is separate from the authenticated DataNode CLI and MCP server. It searches compact LinkedIn export JSONL files on your machine and returns exact person ids, circle paths, notes, and links within a 30k/50k token budget for LLM context assembly.
            </p>

            <h3>Commands</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>Terminal</span>
                <button className="docs-code-copy-btn" onClick={() => copy(searchCmd, 'LinkedIn search command copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{`${statsCmd}
${searchCmd}
${pinnedCmd}`}</code>
              </pre>
            </div>

            <h3>Query Syntax</h3>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Pattern</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="docs-param-name">founder agile</td>
                  <td>Match all terms across name, role, circle path, notes, id, and links.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">role:coach circle:Novo</td>
                  <td>Restrict terms to specific fields.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">--mode any</td>
                  <td>Return broad groups where any term matches instead of requiring every term.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">--offset</td>
                  <td>Page through large groups using the returned <code>next</code> command.</td>
                </tr>
              </tbody>
            </table>
          </div>
        )
      }
    },
    {
      id: 'get-meta',
      category: 'api',
      title: 'GET /graph/meta',
      badge: 'get',
      keywords: ['get', '/graph/meta', 'meta', 'revision', 'counts'],
      render: (copy) => {
        const curl = `curl -X GET "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/graph/meta" \\
  -H "Authorization: Bearer dn_live_your_token"`
        const response = `{
  "revision": 12,
  "counts": {
    "people": 147,
    "circles": 18,
    "connections": 84
  }
}`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge get">GET</span>
              <span className="docs-endpoint-path">/graph/meta</span>
            </div>
            <p>
              Retrieves the metadata of your graph, including the current concurrency revision count and item stats. Use this revision number for subsequent mutation checks.
            </p>

            <h3>Request Example</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{curl}</code>
              </pre>
            </div>

            <h3>Response Example (200 OK)</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>JSON Response</span>
                <button className="docs-code-copy-btn" onClick={() => copy(response, 'JSON response copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{response}</code>
              </pre>
            </div>
          </div>
        )
      }
    },
    {
      id: 'get-search',
      category: 'api',
      title: 'GET /search',
      badge: 'get',
      keywords: ['get', '/search', 'query', 'people', 'circles', 'find'],
      render: (copy) => {
        const curl = `curl -X GET "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/search?q=alice&limit=5" \\
  -H "Authorization: Bearer dn_live_your_token"`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge get">GET</span>
              <span className="docs-endpoint-path">/search</span>
            </div>
            <p>Queries both people (by name, notes, links) and circles (by name) in the social graph.</p>

            <h3>Query Parameters</h3>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Parameter</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="docs-param-name">q</td>
                  <td className="docs-param-type">string</td>
                  <td><span className="docs-param-required">Required</span></td>
                  <td>The search keyword or text query.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">limit</td>
                  <td className="docs-param-type">number</td>
                  <td><span className="docs-param-optional">Optional</span></td>
                  <td>Maximum number of results to return. Defaults to 10.</td>
                </tr>
              </tbody>
            </table>

            <h3>Request Example</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{curl}</code>
              </pre>
            </div>
          </div>
        )
      }
    },
    {
      id: 'post-search-smart',
      category: 'api',
      title: 'POST /search/smart',
      badge: 'post',
      keywords: ['post', '/search/smart', 'natural language', 'ai', 'semantic', 'query'],
      render: (copy) => {
        const curl = `curl -X POST "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/search/smart" \\
  -H "Authorization: Bearer dn_live_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "query": "product managers at Google",
    "limit": 8
  }'`
        const response = `{
  "query": "find my girlfriend",
  "mode": "agent",
  "explanation": "Looking for a close romantic partner in your graph.",
  "steps": [
    { "id": "read", "label": "Reading your question" },
    { "id": "scan", "label": "Scanning contacts and notes" },
    { "id": "pick", "label": "AI picked matches", "detail": "1 suggestion" }
  ],
  "suggestions": ["Search by her name", "Add a note like \\"my girlfriend\\""],
  "results": [
    {
      "type": "person",
      "id": "person-123",
      "name": "Alice Chen",
      "subtitle": "Personal › Close",
      "aiReason": "Note says \\"i love her\\" — likely your partner"
    }
  ]
}`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/search/smart</span>
            </div>
            <p>
              Runs multi-step agent search: analyze the query, scan note-backed candidates,
              match with AI (with an optional retry pass), then return ranked people/circles with
              `aiReason`, visible `steps`, and follow-up `suggestions`. Requires the
              <code>search:read</code> scope and Edge Function secret <code>AI_SEARCH_API_KEY</code>.
            </p>

            <h3>Request Body</h3>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="docs-param-name">query</td>
                  <td className="docs-param-type">string</td>
                  <td><span className="docs-param-required">Required</span></td>
                  <td>Natural-language search text.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">limit</td>
                  <td className="docs-param-type">number</td>
                  <td><span className="docs-param-optional">Optional</span></td>
                  <td>Maximum results (1–50). Defaults to 10.</td>
                </tr>
              </tbody>
            </table>

            <h3>Request Example</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{curl}</code>
              </pre>
            </div>

            <h3>Response Example</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>JSON Response</span>
                <button className="docs-code-copy-btn" onClick={() => copy(response, 'JSON response copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{response}</code>
              </pre>
            </div>
          </div>
        )
      }
    },
    {
      id: 'get-circles',
      category: 'api',
      title: 'GET /circles',
      badge: 'get',
      keywords: ['get', '/circles', 'list circles', 'hierarchy'],
      render: (copy) => {
        const curl = `curl -X GET "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/circles" \\
  -H "Authorization: Bearer dn_live_your_token"`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge get">GET</span>
              <span className="docs-endpoint-path">/circles</span>
            </div>
            <p>Returns an array of all circles defined in the graph with their geometries, parent references, and customized shapes/colors.</p>

            <h3>Request Example</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{curl}</code>
              </pre>
            </div>
          </div>
        )
      }
    },
    {
      id: 'post-people',
      category: 'api',
      title: 'POST /people',
      badge: 'post',
      keywords: ['post', '/people', 'create person', 'add person'],
      render: (copy) => {
        const curl = `curl -X POST "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/people" \\
  -H "Authorization: Bearer dn_live_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "expectedRevision": 12,
    "circleId": "circle-12345",
    "name": "Alice Chen",
    "notes": [{ "body": "Met at developer summit" }]
  }'`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/people</span>
            </div>
            <p>Creates a new person node inside a target circle. The server automatically calculates a safe, non-overlapping location inside the circle boundary.</p>

            <h3>Request Parameters</h3>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="docs-param-name">expectedRevision</td>
                  <td className="docs-param-type">number | null</td>
                  <td><span className="docs-param-required">Required</span></td>
                  <td>The optimistic revision count you expect the graph to be at.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">circleId</td>
                  <td className="docs-param-type">string</td>
                  <td><span className="docs-param-required">Required</span></td>
                  <td>Target circle ID to contain the new person.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">name</td>
                  <td className="docs-param-type">string</td>
                  <td><span className="docs-param-required">Required</span></td>
                  <td>The person's full name.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">notes</td>
                  <td className="docs-param-type">array</td>
                  <td><span className="docs-param-optional">Optional</span></td>
                  <td>An array of notes to seed the person with. Each note needs a <code>body</code>.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">links</td>
                  <td className="docs-param-type">array</td>
                  <td><span className="docs-param-optional">Optional</span></td>
                  <td>An array of links (e.g. <code>{"{ \"service\": \"linkedin\", \"url\": \"https://...\" }"}</code>).</td>
                </tr>
              </tbody>
            </table>

            <h3>Request Example</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{curl}</code>
              </pre>
            </div>
          </div>
        )
      }
    },
    {
      id: 'post-people-import-linkedin',
      category: 'api',
      title: 'POST /people/import-linkedin',
      badge: 'post',
      keywords: ['post', '/people/import-linkedin', 'import linkedin', 'add linkedin'],
      render: (copy) => {
        const curl = `curl -X POST "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/people/import-linkedin" \\
  -H "Authorization: Bearer dn_live_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "expectedRevision": 12,
    "url": "https://www.linkedin.com/in/velizar-seleznev/"
  }'`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/people/import-linkedin</span>
            </div>
            <p>Imports or updates a person node inside a target circle by scraping their LinkedIn profile URL. The circle is automatically resolved or created based on the person\'s current company, with a stable palette tone assigned to newly created LinkedIn company circles.</p>

            <h3>Request Parameters</h3>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="docs-param-name">expectedRevision</td>
                  <td className="docs-param-type">number | null</td>
                  <td><span className="docs-param-required">Required</span></td>
                  <td>The optimistic revision count you expect the graph to be at.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">url</td>
                  <td className="docs-param-type">string</td>
                  <td><span className="docs-param-required">Required</span></td>
                  <td>The LinkedIn profile URL to import (e.g. <code>https://www.linkedin.com/in/username</code>).</td>
                </tr>
              </tbody>
            </table>

            <h3>Request Example</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{curl}</code>
              </pre>
            </div>
          </div>
        )
      }
    },
    {
      id: 'post-notes',
      category: 'api',
      title: 'POST /people/:id/notes',
      badge: 'post',
      keywords: ['post', 'note', '/people/notes', 'add note'],
      render: (copy) => {
        const curl = `curl -X POST "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/people/person-123/notes" \\
  -H "Authorization: Bearer dn_live_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "expectedRevision": 13,
    "body": "Follow up next week"
  }'`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/people/:personId/notes</span>
            </div>
            <p>Adds a text note card to an existing person's inspector panel.</p>

            <h3>Request Parameters</h3>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="docs-param-name">expectedRevision</td>
                  <td className="docs-param-type">number</td>
                  <td><span className="docs-param-required">Required</span></td>
                  <td>Current expected revision.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">body</td>
                  <td className="docs-param-type">string</td>
                  <td><span className="docs-param-required">Required</span></td>
                  <td>The markdown/text content of the note.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">title</td>
                  <td className="docs-param-type">string</td>
                  <td><span className="docs-param-optional">Optional</span></td>
                  <td>Note title. Defaults to the first line of the body.</td>
                </tr>
              </tbody>
            </table>

            <h3>Request Example</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{curl}</code>
              </pre>
            </div>
          </div>
        )
      }
    },
    {
      id: 'post-links',
      category: 'api',
      title: 'POST /people/:id/links',
      badge: 'post',
      keywords: ['post', 'link', '/people/links', 'add link', 'linkedin', 'telegram'],
      render: (copy) => {
        const curl = `curl -X POST "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/people/person-123/links" \\
  -H "Authorization: Bearer dn_live_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "expectedRevision": 14,
    "service": "linkedin",
    "url": "https://linkedin.com/in/alicechen",
    "label": "Alice LinkedIn"
  }'`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/people/:personId/links</span>
            </div>
            <p>Appends an external URL connection (like LinkedIn, Telegram, custom website) to a person's contact panel.</p>

            <h3>Request Parameters</h3>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="docs-param-name">expectedRevision</td>
                  <td className="docs-param-type">number</td>
                  <td><span className="docs-param-required">Required</span></td>
                  <td>Current expected revision.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">service</td>
                  <td className="docs-param-type">string</td>
                  <td><span className="docs-param-required">Required</span></td>
                  <td>Enum: <code>linkedin</code>, <code>telegram</code>, <code>instagram</code>, <code>facebook</code>, <code>whatsapp</code>, <code>x</code>, <code>website</code>.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">url</td>
                  <td className="docs-param-type">string</td>
                  <td><span className="docs-param-required">Required</span></td>
                  <td>The target URL.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">label</td>
                  <td className="docs-param-type">string</td>
                  <td><span className="docs-param-optional">Optional</span></td>
                  <td>Display label for the chip.</td>
                </tr>
              </tbody>
            </table>

            <h3>Request Example</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{curl}</code>
              </pre>
            </div>
          </div>
        )
      }
    },
    {
      id: 'post-connections',
      category: 'api',
      title: 'POST /connections',
      badge: 'post',
      keywords: ['post', '/connections', 'create connection', 'add relationship', 'line'],
      render: (copy) => {
        const curl = `curl -X POST "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/connections" \\
  -H "Authorization: Bearer dn_live_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "expectedRevision": 15,
    "fromId": "person-111",
    "toId": "person-222"
  }'`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/connections</span>
            </div>
            <p>Creates a relationship line connecting two nodes in the board graph. Nodes can be people or circles.</p>

            <h3>Request Parameters</h3>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="docs-param-name">expectedRevision</td>
                  <td className="docs-param-type">number</td>
                  <td><span className="docs-param-required">Required</span></td>
                  <td>Current expected revision.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">fromId</td>
                  <td className="docs-param-type">string</td>
                  <td><span className="docs-param-required">Required</span></td>
                  <td>First node ID.</td>
                </tr>
                <tr>
                  <td className="docs-param-name">toId</td>
                  <td className="docs-param-type">string</td>
                  <td><span className="docs-param-required">Required</span></td>
                  <td>Second node ID (must be different from fromId).</td>
                </tr>
              </tbody>
            </table>

            <h3>Request Example</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{curl}</code>
              </pre>
            </div>
          </div>
        )
      }
    },
    {
      id: 'batch-operations',
      category: 'api',
      title: 'POST /operations (Batch)',
      badge: 'post',
      keywords: ['post', '/operations', 'batch', 'transactions', 'multiple operations'],
      render: (copy) => {
        const payload = `{
  "expectedRevision": 16,
  "operations": [
    {
      "type": "person.create",
      "data": {
        "circleId": "circle-eu",
        "name": "Jane Smith"
      }
    },
    {
      "type": "note.create",
      "data": {
        "personId": "person-jane-id",
        "body": "Seeded via bulk operation"
      }
    }
  ]
}`
        const curl = `curl -X POST "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/operations" \\
  -H "Authorization: Bearer dn_live_your_token" \\
  -H "Content-Type: application/json" \\
  -d '${payload}'`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/operations</span>
            </div>
            <p>
              Executes a transactional list of operations in a single request. 
              If any operation in the list fails, the whole batch transaction fails, maintaining graph integrity.
            </p>

            <h3>Supported Operation Types</h3>
            <ul style={{ lineHeight: '1.6', fontSize: '14px', color: 'var(--md-on-surface-variant)' }}>
              <li><code>person.create</code> — create a person</li>
              <li><code>note.create</code> — add a note to a person</li>
              <li><code>link.create</code> — add a link to a person</li>
            </ul>

            <h3>Request Example</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{curl}</code>
              </pre>
            </div>
          </div>
        )
      }
    },
    {
      id: 'delete-person',
      category: 'api',
      title: 'DELETE /people/:id',
      badge: 'delete',
      keywords: ['delete', '/people', 'remove person', 'delete person'],
      render: (copy) => {
        const curl = `curl -X DELETE "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/people/person-123" \\
  -H "Authorization: Bearer dn_live_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "expectedRevision": 12
  }'`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge delete">DELETE</span>
              <span className="docs-endpoint-path">/people/:personId</span>
            </div>
            <p>Deletes a person node from the graph and cleans up any connection lines associated with them.</p>

            <h3>Request Parameters</h3>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="docs-param-name">expectedRevision</td>
                  <td className="docs-param-type">number | null</td>
                  <td><span className="docs-param-required">Required</span></td>
                  <td>Current expected revision. Can also be supplied in the URL query parameter <code>?expectedRevision=12</code> or header <code>x-expected-revision</code>.</td>
                </tr>
              </tbody>
            </table>

            <h3>Request Example</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{curl}</code>
              </pre>
            </div>
          </div>
        )
      }
    },
    {
      id: 'delete-notes',
      category: 'api',
      title: 'DELETE /people/:id/notes/:noteId',
      badge: 'delete',
      keywords: ['delete', 'note', '/people/notes', 'remove note'],
      render: (copy) => {
        const curl = `curl -X DELETE "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/people/person-123/notes/note-456" \\
  -H "Authorization: Bearer dn_live_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "expectedRevision": 13
  }'`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge delete">DELETE</span>
              <span className="docs-endpoint-path">/people/:personId/notes/:noteId</span>
            </div>
            <p>Deletes a specific note card from a person.</p>

            <h3>Request Parameters</h3>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="docs-param-name">expectedRevision</td>
                  <td className="docs-param-type">number | null</td>
                  <td><span className="docs-param-required">Required</span></td>
                  <td>Current expected revision. Can also be supplied in the URL query parameter <code>?expectedRevision=13</code> or header <code>x-expected-revision</code>.</td>
                </tr>
              </tbody>
            </table>

            <h3>Request Example</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{curl}</code>
              </pre>
            </div>
          </div>
        )
      }
    },
    {
      id: 'delete-links',
      category: 'api',
      title: 'DELETE /people/:id/links/:linkId',
      badge: 'delete',
      keywords: ['delete', 'link', '/people/links', 'remove link'],
      render: (copy) => {
        const curl = `curl -X DELETE "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/people/person-123/links/link-456" \\
  -H "Authorization: Bearer dn_live_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "expectedRevision": 14
  }'`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge delete">DELETE</span>
              <span className="docs-endpoint-path">/people/:personId/links/:linkId</span>
            </div>
            <p>Deletes a specific social link connection from a person.</p>

            <h3>Request Parameters</h3>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="docs-param-name">expectedRevision</td>
                  <td className="docs-param-type">number | null</td>
                  <td><span className="docs-param-required">Required</span></td>
                  <td>Current expected revision. Can also be supplied in the URL query parameter <code>?expectedRevision=14</code> or header <code>x-expected-revision</code>.</td>
                </tr>
              </tbody>
            </table>

            <h3>Request Example</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{curl}</code>
              </pre>
            </div>
          </div>
        )
      }
    },
    {
      id: 'delete-connection',
      category: 'api',
      title: 'DELETE /connections/:id',
      badge: 'delete',
      keywords: ['delete', '/connections', 'remove connection', 'delete connection'],
      render: (copy) => {
        const curl = `curl -X DELETE "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/connections/connection-123" \\
  -H "Authorization: Bearer dn_live_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "expectedRevision": 15
  }'`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge delete">DELETE</span>
              <span className="docs-endpoint-path">/connections/:connectionId</span>
            </div>
            <p>Deletes a connector line between two nodes.</p>

            <h3>Request Parameters</h3>
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="docs-param-name">expectedRevision</td>
                  <td className="docs-param-type">number | null</td>
                  <td><span className="docs-param-required">Required</span></td>
                  <td>Current expected revision. Can also be supplied in the URL query parameter <code>?expectedRevision=15</code> or header <code>x-expected-revision</code>.</td>
                </tr>
              </tbody>
            </table>

            <h3>Request Example</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{curl}</code>
              </pre>
            </div>
          </div>
        )
      }
    },
    {
      id: 'get-graph',
      category: 'api',
      title: 'GET /graph',
      badge: 'get',
      keywords: ['get', '/graph', 'export graph', 'backup'],
      render: (copy) => {
        const curl = `curl -X GET "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/graph" \\
  -H "Authorization: Bearer dn_live_your_token"`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge get">GET</span>
              <span className="docs-endpoint-path">/graph</span>
            </div>
            <p>Retrieves the entire graph state (circles, people, connections) and the current revision. This is useful for making backups.</p>
            <h3>Request Example</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre"><code className="docs-code">{curl}</code></pre>
            </div>
          </div>
        )
      }
    },
    {
      id: 'put-graph',
      category: 'api',
      title: 'PUT /graph',
      badge: 'post',
      keywords: ['put', '/graph', 'import graph', 'replace'],
      render: (copy) => {
        const curl = `curl -X PUT "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/graph" \\
  -H "Authorization: Bearer dn_live_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "expectedRevision": 10,
    "graph": {
      "circles": [...],
      "people": [...],
      "connections": [...]
    }
  }'`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge post">PUT</span>
              <span className="docs-endpoint-path">/graph</span>
            </div>
            <p>Replaces the entire graph state with a new graph payload. Requires <code>graph:replace</code> scope. Revision conflicts return <code>409 Conflict</code> with the latest <code>revision</code>.</p>
            <h3>Request Example</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre"><code className="docs-code">{curl}</code></pre>
            </div>
          </div>
        )
      }
    },
    {
      id: 'clear-graph',
      category: 'api',
      title: 'POST /graph/clear',
      badge: 'post',
      keywords: ['post', '/graph/clear', 'reset graph', 'clear'],
      render: (copy) => {
        const curl = `curl -X POST "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/graph/clear" \\
  -H "Authorization: Bearer dn_live_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "expectedRevision": 10
  }'`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/graph/clear</span>
            </div>
            <p>Clears all circles, people, and connections, resetting the graph to a single "You" circle. Requires <code>graph:replace</code> scope.</p>
            <h3>Request Example</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre"><code className="docs-code">{curl}</code></pre>
            </div>
          </div>
        )
      }
    },
    {
      id: 'post-circles',
      category: 'api',
      title: 'POST /circles',
      badge: 'post',
      keywords: ['post', '/circles', 'create circle'],
      render: (copy) => {
        const curl = `curl -X POST "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/circles" \\
  -H "Authorization: Bearer dn_live_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "expectedRevision": 10,
    "name": "Design Team",
    "parentId": "you",
    "tone": "violet"
  }'`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/circles</span>
            </div>
            <p>Creates a new circle (either standalone or nested inside a parent circle). Requires <code>circles:write</code> scope.</p>
            <h3>Request Example</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre"><code className="docs-code">{curl}</code></pre>
            </div>
          </div>
        )
      }
    },
    {
      id: 'patch-circles',
      category: 'api',
      title: 'PATCH /circles/:id',
      badge: 'post',
      keywords: ['patch', '/circles', 'update circle', 'edit circle'],
      render: (copy) => {
        const curl = `curl -X PATCH "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/circles/circle-123" \\
  -H "Authorization: Bearer dn_live_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "expectedRevision": 11,
    "name": "Product Design",
    "tone": "blue"
  }'`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge post">PATCH</span>
              <span className="docs-endpoint-path">/circles/:circleId</span>
            </div>
            <p>Updates properties of a circle (name, coordinates, parentId, connectedTo, color tone, shape style, etc.). Requires <code>circles:write</code> scope.</p>
            <h3>Request Example</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre"><code className="docs-code">{curl}</code></pre>
            </div>
          </div>
        )
      }
    },
    {
      id: 'delete-circles',
      category: 'api',
      title: 'DELETE /circles/:id',
      badge: 'delete',
      keywords: ['delete', '/circles', 'remove circle'],
      render: (copy) => {
        const curl = `curl -X DELETE "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/circles/circle-123" \\
  -H "Authorization: Bearer dn_live_your_token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "expectedRevision": 12
  }'`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge delete">DELETE</span>
              <span className="docs-endpoint-path">/circles/:circleId</span>
            </div>
            <p>Deletes a circle. People in the deleted circle stay at their current positions but are detached from any circle. Nested child circles move to the deleted circle&apos;s parent. Requires <code>circles:write</code> scope.</p>
            <h3>Request Example</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre"><code className="docs-code">{curl}</code></pre>
            </div>
          </div>
        )
      }
    },
    {
      id: 'post-people-avatar',
      category: 'api',
      title: 'POST /people/:id/avatar',
      badge: 'post',
      keywords: ['post', '/people/avatar', 'upload photo', 'avatar'],
      render: (copy) => {
        const curl = `curl -X POST "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/people/person-123/avatar" \\
  -H "Authorization: Bearer dn_live_your_token" \\
  -H "Content-Type: image/png" \\
  --data-binary "@avatar.png"`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/people/:personId/avatar</span>
            </div>
            <p>Uploads and updates a person's avatar photo. Accepts a raw binary payload (with image Content-Type) or a JSON body with <code>imageUrl</code> or <code>base64</code>. Requires <code>people:write</code> scope.</p>
            <h3>Request Example (Raw Binary)</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre"><code className="docs-code">{curl}</code></pre>
            </div>
          </div>
        )
      }
    },
    {
      id: 'post-circles-avatar',
      category: 'api',
      title: 'POST /circles/:id/avatar',
      badge: 'post',
      keywords: ['post', '/circles/avatar', 'upload photo', 'avatar'],
      render: (copy) => {
        const curl = `curl -X POST "https://lycfoukfoesobeuumuad.supabase.co/functions/v1/graph-api/v1/circles/circle-123/avatar" \\
  -H "Authorization: Bearer dn_live_your_token" \\
  -H "Content-Type: image/png" \\
  --data-binary "@circle.png"`
        return (
          <div>
            <div className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/circles/:circleId/avatar</span>
            </div>
            <p>Uploads and updates a circle's photo. Accepts a raw binary payload (with image Content-Type) or a JSON body with <code>imageUrl</code> or <code>base64</code>. Requires <code>circles:write</code> scope.</p>
            <h3>Request Example (Raw Binary)</h3>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre"><code className="docs-code">{curl}</code></pre>
            </div>
          </div>
        )
      }
    }
  ], [])

  const articleById = useMemo(() => new Map(articles.map((article) => [article.id, article])), [articles])

  const searchTokens = useMemo(() => tokenizeSearch(searchQuery), [searchQuery])

  const searchResults = useMemo(() => {
    if (searchTokens.length === 0) return []
    return articles
      .map((article) => ({ article, score: scoreArticle(article, searchTokens) }))
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
  }, [articles, searchTokens])

  const matchesSearch = useCallback(
    (articleId: string) => {
      if (searchTokens.length === 0) return true
      const article = articleById.get(articleId)
      return article ? scoreArticle(article, searchTokens) > 0 : false
    },
    [articleById, searchTokens],
  )

  const displayedArticle = articleById.get(activeArticleId) ?? articleById.get('welcome') ?? null

  const selectArticle = useCallback((id: string) => {
    setActiveArticleId(id)
    setSearchQuery('')
    setSearchOpen(false)
    setMobileNavOpen(false)
    window.location.hash = `#docs/${id}`
    contentRef.current?.scrollTo({ top: 0 })
  }, [])

  const toggleGroup = useCallback((groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  useEffect(() => {
    const syncFromHash = () => {
      const id = readArticleIdFromHash()
      if (articleById.has(id)) setActiveArticleId(id)
    }
    window.addEventListener('hashchange', syncFromHash)
    return () => window.removeEventListener('hashchange', syncFromHash)
  }, [articleById])

  useEffect(() => {
    for (const section of DOC_SECTIONS) {
      for (const group of section.groups) {
        if (group.articleIds.includes(activeArticleId)) {
          setCollapsedGroups((prev) => {
            if (!prev.has(group.id)) return prev
            const next = new Set(prev)
            next.delete(group.id)
            return next
          })
        }
      }
    }
  }, [activeArticleId])

  useEffect(() => {
    if (searchTokens.length === 0) return
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      for (const section of DOC_SECTIONS) {
        if (!section.collapsible) continue
        for (const group of section.groups) {
          if (group.articleIds.some((id) => matchesSearch(id))) next.delete(group.id)
        }
      }
      return next
    })
  }, [searchTokens, matchesSearch])

  useEffect(() => {
    const handlePointerDown = (event: globalThis.MouseEvent) => {
      if (!searchRef.current?.contains(event.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [])

  const handleGoHome = (event: MouseEvent) => {
    event.preventDefault()
    window.location.hash = ''
  }

  return (
    <div className={`app-shell docs-container ${mobileNavOpen ? 'docs-nav-open' : ''}`}>
      {/* Toast notifications */}
      {copiedStatus && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          background: 'var(--md-on-surface)',
          color: 'var(--md-surface)',
          padding: '12px 24px',
          borderRadius: 'var(--md-r-sm)',
          fontSize: '13px',
          boxShadow: 'var(--md-elev-3)',
          zIndex: 9999,
          animation: 'docsFadeIn 0.2s ease'
        }}>
          {copiedStatus}
        </div>
      )}

      <header className="docs-header">
        <a href="#" className="docs-brand" onClick={handleGoHome} aria-label="Back to Social Datanode home">
          <img src={sdnLogo} alt="" aria-hidden="true" />
          <span className="docs-brand-title">Developer Docs</span>
        </a>
        <div className="docs-controls">
          <button
            type="button"
            className="docs-nav-toggle"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            {mobileNavOpen ? 'Hide menu' : 'Browse docs'}
          </button>
          <div className="docs-search-wrapper" ref={searchRef}>
            <svg className="docs-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="search"
              placeholder="Search endpoints, tools, topics…"
              className="docs-search-input"
              value={searchQuery}
              aria-expanded={searchOpen && searchResults.length > 0}
              aria-controls="docs-search-results"
              onFocus={() => setSearchOpen(true)}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setSearchOpen(true)
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchResults[0]) {
                  e.preventDefault()
                  selectArticle(searchResults[0].article.id)
                }
                if (e.key === 'Escape') {
                  setSearchQuery('')
                  setSearchOpen(false)
                }
              }}
            />
            {searchQuery && (
              <button
                type="button"
                className="docs-search-clear"
                aria-label="Clear search"
                onClick={() => {
                  setSearchQuery('')
                  setSearchOpen(false)
                }}
              >
                ×
              </button>
            )}
            {searchOpen && searchQuery.trim() && (
              <div className="docs-search-dropdown" id="docs-search-results" role="listbox">
                {searchResults.length > 0 ? (
                  searchResults.map(({ article }) => (
                    <button
                      key={article.id}
                      type="button"
                      role="option"
                      className="docs-search-result"
                      onClick={() => selectArticle(article.id)}
                    >
                      <span className="docs-search-result__title">{article.title}</span>
                      <span className="docs-search-result__meta">
                        {article.category === 'api' ? 'REST API' : article.category === 'mcp' ? 'MCP' : article.category === 'cli' ? 'CLI' : 'Guide'}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="docs-search-empty">No matches for “{searchQuery.trim()}”</div>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      <aside className={`docs-sidebar ${mobileNavOpen ? 'is-open' : ''}`}>
        {DOC_SECTIONS.map((section) => {
          const visibleGroups = section.groups
            .map((group) => ({
              ...group,
              articles: group.articleIds
                .map((id) => articleById.get(id))
                .filter((article): article is Article => Boolean(article))
                .filter((article) => matchesSearch(article.id)),
            }))
            .filter((group) => group.articles.length > 0)

          if (visibleGroups.length === 0) return null

          return (
            <div key={section.title || 'root'} className="docs-sidebar-section">
              {section.title && (
                <div className="docs-sidebar-section__title">{section.title}</div>
              )}
              {visibleGroups.map((group) => {
                const isCollapsed = section.collapsible && collapsedGroups.has(group.id)
                return (
                  <div key={group.id} className="docs-sidebar-group">
                    {section.collapsible ? (
                      <button
                        type="button"
                        className="docs-sidebar-group__toggle"
                        aria-expanded={!isCollapsed}
                        onClick={() => toggleGroup(group.id)}
                      >
                        <span>{group.title}</span>
                        <svg className={`docs-sidebar-group__chevron ${isCollapsed ? '' : 'is-open'}`} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <polyline points="6 9 12 15 18 9"></polyline>
                        </svg>
                      </button>
                    ) : (
                      <div className="docs-sidebar-group__label">{group.title}</div>
                    )}
                    {!isCollapsed && (
                      <div className="docs-sidebar-list">
                        {group.articles.map((article) => (
                          <button
                            key={article.id}
                            type="button"
                            className={`docs-sidebar-item ${activeArticleId === article.id ? 'is-active' : ''}`}
                            onClick={() => selectArticle(article.id)}
                          >
                            <span>{article.title.replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/, '')}</span>
                            {article.badge && (
                              <span className={`docs-sidebar-item__badge ${article.badge}`}>
                                {article.badge}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )
        })}
      </aside>

      <main className="docs-content" ref={contentRef}>
        {activeArticleId === 'welcome' && searchTokens.length === 0 && (
          <div className="docs-quick-nav">
            <button type="button" className="docs-quick-card" onClick={() => selectArticle('welcome')}>
              <span className="docs-quick-card__label">Start here</span>
              <strong>Authentication & basics</strong>
              <span className="docs-quick-card__hint">Tokens, scopes, revision checks</span>
            </button>
            <button type="button" className="docs-quick-card" onClick={() => selectArticle('mcp-server')}>
              <span className="docs-quick-card__label">MCP</span>
              <strong>Connect an AI client</strong>
              <span className="docs-quick-card__hint">Cursor, Claude Desktop, Windsurf</span>
            </button>
            <button type="button" className="docs-quick-card" onClick={() => selectArticle('cli-tool')}>
              <span className="docs-quick-card__label">CLI</span>
              <strong>Terminal commands</strong>
              <span className="docs-quick-card__hint">npx or global install</span>
            </button>
            <button type="button" className="docs-quick-card" onClick={() => selectArticle('get-meta')}>
              <span className="docs-quick-card__label">REST API</span>
              <strong>HTTP reference</strong>
              <span className="docs-quick-card__hint">Grouped by resource in the sidebar</span>
            </button>
          </div>
        )}

        {displayedArticle ? (
          <article className="docs-article is-visible" key={displayedArticle.id}>
            {displayedArticle.render(handleCopy)}
          </article>
        ) : (
          <div className="docs-no-results">
            <h4>Page not found</h4>
            <p>Pick a topic from the sidebar or use search above.</p>
          </div>
        )}
      </main>
    </div>
  )
}
