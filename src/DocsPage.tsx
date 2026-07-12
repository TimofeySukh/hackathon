import { useState, useMemo, useEffect, useRef, useCallback } from 'react'
import DocsHeader from './features/docs/DocsHeader'
import DocsQuickStart from './features/docs/DocsQuickStart'
import DocsSidebar from './features/docs/DocsSidebar'
import { DEFAULT_COLLAPSED, DOC_SECTIONS, scoreArticle, tokenizeSearch } from './features/docs/navigation'
import type { Article } from './features/docs/types'

function readArticleIdFromHash(): string {
  const hash = window.location.hash
  if (hash.startsWith('#docs/')) {
    return hash.slice('#docs/'.length) || 'welcome'
  }
  return 'welcome'
}

interface DocsPageProps {
  onLogin: () => void
  onSignUp: () => void
  isAuthenticated: boolean
}

export default function DocsPage({ onLogin, onSignUp, isAuthenticated }: DocsPageProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeArticleId, setActiveArticleId] = useState(readArticleIdFromHash)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(() => new Set(DEFAULT_COLLAPSED))
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [copiedStatus, setCopiedStatus] = useState<string | null>(null)
  const contentRef = useRef<HTMLElement>(null)
  const searchRef = useRef<HTMLDivElement>(null)
  const mobileNavTriggerRef = useRef<HTMLButtonElement>(null)

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
      title: 'Build with Social Datanode',
      keywords: ['welcome', 'start', 'getting started', 'intro', 'key', 'token', 'authorization'],
      render: () => (
        <div>
          <div className="docs-hero">
            <p className="docs-hero__eyebrow">Developer documentation</p>
            <h1>Build with Social Datanode</h1>
            <p className="docs-hero__lead">
              Connect AI clients, terminal workflows, and custom integrations to the same
              relationship graph you use on the board.
            </p>
          </div>

          <DocsQuickStart />

          <h2>Authentication</h2>
          <p>
            Every API request uses a revocable, scoped <strong>agent token</strong>. Create one
            from your board:
          </p>
          <ol>
            <li>Open your Social Datanode board.</li>
            <li>Open <strong>Settings</strong> from the top-right toolbar.</li>
            <li>Find <strong>Agent API</strong> and select <strong>Connect MCP</strong>.</li>
            <li>Open <strong>Keys</strong>, name the key, and select <strong>Create key</strong>.</li>
            <li>Copy the <code>dn_live_…</code> token immediately. Only its secure hash is stored.</li>
          </ol>

          <div className="docs-alert info">
            <div className="docs-alert-title">Authorization header</div>
            <p className="docs-alert-body">
              Send the token as a Bearer credential with every request:
              <code className="docs-token-example">
                Authorization: Bearer dn_live_&lt;your-token&gt;
              </code>
            </p>
          </div>

          <h2>Revision-safe writes</h2>
          <p>
            Social Datanode prevents concurrent clients from silently overwriting each other:
          </p>
          <ul>
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
            <h1>Connect with Model Context Protocol</h1>
            <p>
              The Model Context Protocol (MCP) allows LLM clients (such as Claude Desktop, Cursor, or Windsurf) to securely inspect and edit your social graph.
              The MCP server runs through <code>npx</code> without requiring a local clone.
              Tool calls return a structured JSON envelope with <code>status</code>, <code>summary</code>, <code>data</code>, and <code>next_valid_actions</code>.
            </p>

            <h2>Configuration</h2>
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

            <h2>Exposed tools</h2>
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
                  <td>List Social Datanode MCP capabilities with compact risk and side-effect metadata.</td>
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
            <h1>Use the CLI</h1>
            <p>
              The command-line interface (CLI) client allows you to query and edit your social graph directly from your terminal.
            </p>

            <h2>Option A: run on the fly with npx</h2>
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

            <h2>Option B: global installation</h2>
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

            <h2>CLI usage guide</h2>
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
            <h1>Search a local LinkedIn archive</h1>
            <p>
              This read-only helper is separate from the authenticated Social Datanode CLI and MCP server. It searches compact LinkedIn export JSONL files on your machine and returns exact person ids, circle paths, notes, and links within a 30k/50k token budget for LLM context assembly.
            </p>

            <h2>Commands</h2>
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

            <h2>Query syntax</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge get">GET</span>
              <span className="docs-endpoint-path">/graph/meta</span>
            </h1>
            <p>
              Retrieves the metadata of your graph, including the current concurrency revision count and item stats. Use this revision number for subsequent mutation checks.
            </p>

            <h2>Request example</h2>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{curl}</code>
              </pre>
            </div>

            <h2>Response example (200 OK)</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge get">GET</span>
              <span className="docs-endpoint-path">/search</span>
            </h1>
            <p>
              Queries people and circles with deterministic hybrid ranking across exact names,
              name tokens, role/headline notes, note text, circle paths, links, and coverage.
            </p>

            <h2>Query parameters</h2>
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

            <h2>Request example</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/search/smart</span>
            </h1>
            <p>
              Runs multi-step agent search: analyze the query, scan note-backed candidates,
              match with AI (with an optional retry pass), then return ranked people/circles with
              <code>aiReason</code>, visible <code>steps</code>, and follow-up <code>suggestions</code>. Requires the
              <code>search:read</code> scope and the shared Edge Function secret <code>OPENROUTER_API_KEY</code>.
            </p>

            <h2>Request body</h2>
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

            <h2>Request example</h2>
            <div className="docs-code-container">
              <div className="docs-code-header">
                <span>cURL</span>
                <button className="docs-code-copy-btn" onClick={() => copy(curl, 'cURL copied!')}>Copy</button>
              </div>
              <pre className="docs-code-pre">
                <code className="docs-code">{curl}</code>
              </pre>
            </div>

            <h2>Response example</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge get">GET</span>
              <span className="docs-endpoint-path">/circles</span>
            </h1>
            <p>Returns an array of all circles defined in the graph with their geometries, parent references, and customized shapes/colors.</p>

            <h2>Request example</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/people</span>
            </h1>
            <p>Creates a new person node inside a target circle. The server automatically calculates a safe, non-overlapping location inside the circle boundary.</p>

            <h2>Request parameters</h2>
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

            <h2>Request example</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/people/import-linkedin</span>
            </h1>
            <p>Imports or updates a person node inside a target circle by scraping their LinkedIn profile URL. The circle is automatically resolved or created based on the person\'s current company, with a stable palette tone assigned to newly created LinkedIn company circles.</p>

            <h2>Request parameters</h2>
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

            <h2>Request example</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/people/:personId/notes</span>
            </h1>
            <p>Adds a text note card to an existing person's inspector panel.</p>

            <h2>Request parameters</h2>
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

            <h2>Request example</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/people/:personId/links</span>
            </h1>
            <p>Appends an external URL connection (like LinkedIn, Telegram, custom website) to a person's contact panel.</p>

            <h2>Request parameters</h2>
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

            <h2>Request example</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/connections</span>
            </h1>
            <p>Creates a relationship line connecting two nodes in the board graph. Nodes can be people or circles.</p>

            <h2>Request parameters</h2>
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

            <h2>Request example</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/operations</span>
            </h1>
            <p>
              Executes a transactional list of operations in a single request. 
              If any operation in the list fails, the whole batch transaction fails, maintaining graph integrity.
            </p>

            <h2>Supported operation types</h2>
            <ul style={{ lineHeight: '1.6', fontSize: '14px', color: 'var(--md-on-surface-variant)' }}>
              <li><code>person.create</code> — create a person</li>
              <li><code>note.create</code> — add a note to a person</li>
              <li><code>link.create</code> — add a link to a person</li>
            </ul>

            <h2>Request example</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge delete">DELETE</span>
              <span className="docs-endpoint-path">/people/:personId</span>
            </h1>
            <p>Deletes a person node from the graph and cleans up any connection lines associated with them.</p>

            <h2>Request parameters</h2>
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

            <h2>Request example</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge delete">DELETE</span>
              <span className="docs-endpoint-path">/people/:personId/notes/:noteId</span>
            </h1>
            <p>Deletes a specific note card from a person.</p>

            <h2>Request parameters</h2>
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

            <h2>Request example</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge delete">DELETE</span>
              <span className="docs-endpoint-path">/people/:personId/links/:linkId</span>
            </h1>
            <p>Deletes a specific social link connection from a person.</p>

            <h2>Request parameters</h2>
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

            <h2>Request example</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge delete">DELETE</span>
              <span className="docs-endpoint-path">/connections/:connectionId</span>
            </h1>
            <p>Deletes a connector line between two nodes.</p>

            <h2>Request parameters</h2>
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

            <h2>Request example</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge get">GET</span>
              <span className="docs-endpoint-path">/graph</span>
            </h1>
            <p>Retrieves the entire graph state (circles, people, connections) and the current revision. This is useful for making backups.</p>
            <h2>Request example</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge post">PUT</span>
              <span className="docs-endpoint-path">/graph</span>
            </h1>
            <p>Replaces the entire graph state with a new graph payload. Requires <code>graph:replace</code> scope. Revision conflicts return <code>409 Conflict</code> with the latest <code>revision</code>.</p>
            <h2>Request example</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/graph/clear</span>
            </h1>
            <p>Clears all circles, people, and connections, resetting the graph to a single "You" circle. Requires <code>graph:replace</code> scope.</p>
            <h2>Request example</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/circles</span>
            </h1>
            <p>Creates a new circle (either standalone or nested inside a parent circle). Requires <code>circles:write</code> scope.</p>
            <h2>Request example</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge post">PATCH</span>
              <span className="docs-endpoint-path">/circles/:circleId</span>
            </h1>
            <p>Updates properties of a circle (name, coordinates, parentId, connectedTo, color tone, shape style, etc.). Requires <code>circles:write</code> scope.</p>
            <h2>Request example</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge delete">DELETE</span>
              <span className="docs-endpoint-path">/circles/:circleId</span>
            </h1>
            <p>Deletes a circle. People in the deleted circle stay at their current positions but are detached from any circle. Nested child circles move to the deleted circle&apos;s parent. Requires <code>circles:write</code> scope.</p>
            <h2>Request example</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/people/:personId/avatar</span>
            </h1>
            <p>Uploads and updates a person's avatar photo. Accepts a raw binary payload (with image Content-Type) or a JSON body with <code>imageUrl</code> or <code>base64</code>. Requires <code>people:write</code> scope.</p>
            <h2>Request example (raw binary)</h2>
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
            <h1 className="docs-endpoint-title">
              <span className="docs-method-badge post">POST</span>
              <span className="docs-endpoint-path">/circles/:circleId/avatar</span>
            </h1>
            <p>Uploads and updates a circle's photo. Accepts a raw binary payload (with image Content-Type) or a JSON body with <code>imageUrl</code> or <code>base64</code>. Requires <code>circles:write</code> scope.</p>
            <h2>Request example (raw binary)</h2>
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
      .map((entry) => entry.article)
  }, [articles, searchTokens])

  const matchesSearch = useCallback(
    (articleId: string) => {
      if (searchTokens.length === 0) return true
      const article = articleById.get(articleId)
      return article ? scoreArticle(article, searchTokens) > 0 : false
    },
    [articleById, searchTokens],
  )

  const displayedArticle = articleById.get(activeArticleId) ?? null

  const selectArticle = useCallback((id: string) => {
    setActiveArticleId(id)
    setSearchQuery('')
    setSearchOpen(false)
    setMobileNavOpen(false)
    window.location.hash = `#docs/${id}`
    contentRef.current?.scrollTo({ top: 0 })
  }, [])

  const closeMobileNav = useCallback(() => setMobileNavOpen(false), [])

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
      setActiveArticleId(id)
      setMobileNavOpen(false)
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

  return (
    <div className={`app-shell docs-container ${mobileNavOpen ? 'docs-nav-open' : ''}`}>
      {copiedStatus && (
        <div className="docs-toast" role="status" aria-live="polite">
          {copiedStatus}
        </div>
      )}

      <DocsHeader
        isAuthenticated={isAuthenticated}
        mobileNavOpen={mobileNavOpen}
        mobileNavTriggerRef={mobileNavTriggerRef}
        onHome={() => { window.location.hash = '' }}
        onContact={() => { window.location.hash = '#contact' }}
        onBoard={() => { window.location.hash = '#board' }}
        onLogin={onLogin}
        onSignUp={onSignUp}
        onToggleMobileNav={() => setMobileNavOpen((open) => !open)}
        query={searchQuery}
        searchOpen={searchOpen}
        searchRef={searchRef}
        searchResults={searchResults}
        onQueryChange={(query) => {
          setSearchQuery(query)
          setSearchOpen(true)
        }}
        onSearchOpenChange={setSearchOpen}
        onSelectArticle={selectArticle}
      />

      <DocsSidebar
        activeArticleId={activeArticleId}
        articleById={articleById}
        collapsedGroups={collapsedGroups}
        isOpen={mobileNavOpen}
        matchesSearch={matchesSearch}
        onClose={closeMobileNav}
        onSelectArticle={selectArticle}
        onToggleGroup={toggleGroup}
        triggerElement={mobileNavTriggerRef.current}
      />

      <main className="docs-content" ref={contentRef}>
        {displayedArticle ? (
          <article className="docs-article" key={displayedArticle.id}>
            {displayedArticle.render(handleCopy)}
          </article>
        ) : (
          <div className="docs-no-results">
            <p className="docs-no-results__code">404</p>
            <h1>Documentation page not found</h1>
            <p>The link may be out of date. Return to the docs home or search for a topic.</p>
            <button type="button" className="docs-button docs-button--filled" onClick={() => selectArticle('welcome')}>
              Open docs home
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
