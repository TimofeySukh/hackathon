import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react'

type Theme = 'dark' | 'light'

type Offset = {
  x: number
  y: number
}

type GraphNode = {
  id: string
  label: string
  x: number
  y: number
  size?: 'focus' | 'group' | 'node'
}

type GraphEdge = {
  from: string
  to: string
}

type GraphFolder = {
  id: string
  name: string
  description: string
  nodes: GraphNode[]
  edges: GraphEdge[]
}

const THEME_STORAGE_KEY = 'hackathon-theme'
const MIN_SCALE = 0.35
const MAX_SCALE = 2.4
const GRID_GAP = 38
const MAJOR_GRID_GAP = 152
const DOT_SIZE = 1.5
const MAJOR_DOT_SIZE = 3

const GRAPH_FOLDERS: GraphFolder[] = [
  {
    id: 'test-folder',
    name: 'Test Folder',
    description: 'A larger sample graph for layout and interaction testing.',
    nodes: [
      { id: 'index', label: 'index', x: 0, y: 0, size: 'focus' },
      { id: 'server-tools', label: 'Server Tools', x: -120, y: -340, size: 'group' },
      { id: 'ubuntu', label: 'Ubuntu', x: -90, y: -210 },
      { id: 'nginx', label: 'nginx', x: 38, y: -192 },
      { id: 'docker', label: 'docker', x: -10, y: -140 },
      { id: 'apache', label: 'apache', x: 18, y: -116 },
      { id: 'mail', label: 'mail', x: -62, y: -130 },
      { id: 'kubernetes', label: 'kubernetes', x: -176, y: -176 },
      { id: 'monitoring', label: 'monit', x: -18, y: -244 },
      { id: 'ufw', label: 'ufw', x: 4, y: -276 },
      { id: 'ssl', label: 'Certbot', x: -118, y: -82 },
      { id: 'hosted', label: 'Server Hosted', x: 410, y: -220, size: 'group' },
      { id: 'wordpress', label: 'WordPress', x: 276, y: -94 },
      { id: 'drupal', label: 'Drupal', x: 198, y: -254 },
      { id: 'gogs', label: 'Gogs', x: 160, y: -172 },
      { id: 'zammad', label: 'Zammad', x: 232, y: -140 },
      { id: 'mailcow', label: 'Mailcow', x: 286, y: -36 },
      { id: 'webmin', label: 'Webmin', x: 216, y: -56 },
      { id: 'discourse', label: 'Discourse', x: 388, y: -18 },
      { id: 'laravel', label: 'Laravel', x: 176, y: -6 },
      { id: 'languages', label: 'Languages', x: 330, y: 324, size: 'group' },
      { id: 'python', label: 'Python', x: 160, y: 126 },
      { id: 'rust', label: 'Rust', x: 216, y: 120 },
      { id: 'javascript', label: 'JavaScript', x: 224, y: 178 },
      { id: 'go', label: 'Go-Lang', x: 284, y: 176 },
      { id: 'ruby', label: 'Ruby', x: 258, y: 228 },
      { id: 'php', label: 'PHP', x: 192, y: 286 },
      { id: 'graphql', label: 'GraphQL', x: 160, y: 226 },
      { id: 'c-lang', label: 'C', x: 204, y: 242 },
      { id: 'frameworks', label: 'Frameworks', x: -22, y: 420, size: 'group' },
      { id: 'react', label: 'ReactJS', x: 18, y: 232 },
      { id: 'vue', label: 'Vue.js', x: -40, y: 198 },
      { id: 'nodejs', label: 'nodejs', x: -26, y: 274 },
      { id: 'rails', label: 'Rails', x: 46, y: 302 },
      { id: 'react-native', label: 'React Native', x: 86, y: 268 },
      { id: 'databases', label: 'Databases', x: 110, y: 376, size: 'group' },
      { id: 'postgres', label: 'PostgreSQL', x: 40, y: 184 },
      { id: 'mysql', label: 'MySQL', x: 102, y: 214 },
      { id: 'mongo', label: 'mongo', x: 124, y: 158 },
      { id: 'redis', label: 'Redis', x: 146, y: 232 },
      { id: 'editors', label: 'editors', x: -392, y: 176, size: 'group' },
      { id: 'vscode', label: 'VS Code', x: -246, y: 40 },
      { id: 'atom', label: 'atom', x: -188, y: 42 },
      { id: 'phpstorm', label: 'phpstorm', x: -240, y: 86 },
      { id: 'textmate', label: 'textmate', x: -170, y: 88 },
      { id: 'sublime', label: 'sublime', x: -224, y: 132 },
      { id: 'computers', label: 'computers', x: -522, y: -28, size: 'group' },
      { id: 'macs', label: 'Macs', x: -384, y: -42 },
      { id: 'magic', label: 'Magic', x: -398, y: 12 },
      { id: 'ovid', label: 'Ovid', x: -370, y: -78 },
      { id: 'woover', label: 'Woover', x: -276, y: -18 },
      { id: 'zeke', label: 'Zeke', x: -288, y: -64 },
      { id: 'services', label: 'saas', x: -266, y: -112, size: 'group' },
      { id: 'stripe', label: 'Stripe', x: -152, y: -64 },
      { id: 'contentful', label: 'Table of Contents', x: -112, y: -34 },
      { id: 'twilio', label: 'Twilio', x: -82, y: -8 },
      { id: 'aws', label: 'AWS', x: -154, y: -4 },
      { id: 'heroku', label: 'Heroku', x: -96, y: 12 },
      { id: 'localhost', label: 'Localhost', x: -248, y: 344, size: 'group' },
      { id: 'homebrew', label: 'Homebrew', x: -142, y: 242 },
      { id: 'macos', label: 'MacOS', x: -126, y: 206 },
      { id: 'chrome', label: 'Chrome', x: -80, y: 202 },
      { id: 'sketch', label: 'Sketch', x: -110, y: 286 },
      { id: 'adobe', label: 'adobe', x: -58, y: 264 },
      { id: 'shell', label: 'Shell', x: 590, y: 118, size: 'group' },
      { id: 'vim', label: 'Vim', x: 470, y: 0 },
      { id: 'zsh', label: 'zsh', x: 404, y: -16 },
      { id: 'unix', label: 'unix', x: 346, y: 24 },
      { id: 'bash', label: 'bash', x: 402, y: 52 },
      { id: 'terminal', label: 'Terminal', x: 386, y: 96 },
      { id: 'custom-shell', label: 'custom', x: 462, y: 102 },
      { id: 'git', label: 'git', x: 44, y: -32 },
      { id: 'subversion', label: 'Subversion', x: 0, y: 32 },
    ],
    edges: [
      ...connectTo('index', [
        'server-tools',
        'hosted',
        'languages',
        'frameworks',
        'editors',
        'computers',
        'services',
        'localhost',
        'shell',
        'git',
        'subversion',
      ]),
      ...connectTo('server-tools', ['ubuntu', 'nginx', 'docker', 'apache', 'mail', 'kubernetes', 'monitoring', 'ufw', 'ssl']),
      ...connectTo('hosted', ['wordpress', 'drupal', 'gogs', 'zammad', 'mailcow', 'webmin', 'discourse', 'laravel']),
      ...connectTo('languages', ['python', 'rust', 'javascript', 'go', 'ruby', 'php', 'graphql', 'c-lang']),
      ...connectTo('frameworks', ['react', 'vue', 'nodejs', 'rails', 'react-native', 'databases']),
      ...connectTo('databases', ['postgres', 'mysql', 'mongo', 'redis']),
      ...connectTo('editors', ['vscode', 'atom', 'phpstorm', 'textmate', 'sublime']),
      ...connectTo('computers', ['macs', 'magic', 'ovid', 'woover', 'zeke']),
      ...connectTo('services', ['stripe', 'contentful', 'twilio', 'aws', 'heroku']),
      ...connectTo('localhost', ['homebrew', 'macos', 'chrome', 'sketch', 'adobe']),
      ...connectTo('shell', ['vim', 'zsh', 'unix', 'bash', 'terminal', 'custom-shell']),
    ],
  },
  {
    id: 'product-notes',
    name: 'Product Notes',
    description: 'A smaller cluster around product planning.',
    nodes: [
      { id: 'product', label: 'product', x: 0, y: 0, size: 'focus' },
      { id: 'vision', label: 'Vision', x: 0, y: -170, size: 'group' },
      { id: 'users', label: 'Users', x: -180, y: -40, size: 'group' },
      { id: 'delivery', label: 'Delivery', x: 170, y: -30, size: 'group' },
      { id: 'roadmap', label: 'Roadmap', x: 0, y: 190, size: 'group' },
      { id: 'positioning', label: 'Positioning', x: -38, y: -254 },
      { id: 'problems', label: 'Problems', x: 56, y: -232 },
      { id: 'personas', label: 'Personas', x: -266, y: -92 },
      { id: 'jobs', label: 'Jobs to be done', x: -238, y: -6 },
      { id: 'pain-points', label: 'Pain points', x: -190, y: 48 },
      { id: 'mvp', label: 'MVP', x: 236, y: -82 },
      { id: 'beta', label: 'Beta', x: 258, y: -10 },
      { id: 'launch', label: 'Launch', x: 228, y: 62 },
      { id: 'metrics', label: 'Metrics', x: 2, y: 274 },
      { id: 'backlog', label: 'Backlog', x: -80, y: 248 },
      { id: 'milestones', label: 'Milestones', x: 102, y: 244 },
    ],
    edges: [
      ...connectTo('product', ['vision', 'users', 'delivery', 'roadmap']),
      ...connectTo('vision', ['positioning', 'problems']),
      ...connectTo('users', ['personas', 'jobs', 'pain-points']),
      ...connectTo('delivery', ['mvp', 'beta', 'launch']),
      ...connectTo('roadmap', ['metrics', 'backlog', 'milestones']),
    ],
  },
  {
    id: 'engineering-vault',
    name: 'Engineering Vault',
    description: 'A graph view for code, infra, and platform notes.',
    nodes: [
      { id: 'engineering', label: 'engineering', x: 0, y: 0, size: 'focus' },
      { id: 'frontend', label: 'Frontend', x: -176, y: -116, size: 'group' },
      { id: 'backend', label: 'Backend', x: 188, y: -102, size: 'group' },
      { id: 'infra', label: 'Infra', x: 0, y: -220, size: 'group' },
      { id: 'quality', label: 'Quality', x: -162, y: 140, size: 'group' },
      { id: 'data', label: 'Data', x: 176, y: 144, size: 'group' },
      { id: 'react', label: 'React', x: -256, y: -164 },
      { id: 'vite', label: 'Vite', x: -108, y: -178 },
      { id: 'design-system', label: 'Design system', x: -224, y: -68 },
      { id: 'api', label: 'API', x: 252, y: -158 },
      { id: 'workers', label: 'Workers', x: 274, y: -86 },
      { id: 'auth', label: 'Auth', x: 190, y: -28 },
      { id: 'docker', label: 'Docker', x: -44, y: -304 },
      { id: 'deploy', label: 'Deploy', x: 34, y: -306 },
      { id: 'monitoring', label: 'Monitoring', x: 82, y: -248 },
      { id: 'tests', label: 'Tests', x: -238, y: 192 },
      { id: 'linting', label: 'Linting', x: -144, y: 232 },
      { id: 'telemetry', label: 'Telemetry', x: 248, y: 208 },
      { id: 'warehouse', label: 'Warehouse', x: 142, y: 252 },
    ],
    edges: [
      ...connectTo('engineering', ['frontend', 'backend', 'infra', 'quality', 'data']),
      ...connectTo('frontend', ['react', 'vite', 'design-system']),
      ...connectTo('backend', ['api', 'workers', 'auth']),
      ...connectTo('infra', ['docker', 'deploy', 'monitoring']),
      ...connectTo('quality', ['tests', 'linting']),
      ...connectTo('data', ['telemetry', 'warehouse']),
    ],
  },
]

function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
    return savedTheme === 'light' ? 'light' : 'dark'
  })
  const [activeFolderId, setActiveFolderId] = useState(GRAPH_FOLDERS[0].id)
  const [offset, setOffset] = useState<Offset>({ x: 0, y: 0 })
  const [scale, setScale] = useState(1)
  const [isDragging, setIsDragging] = useState(false)

  const dragStateRef = useRef({
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
    active: false,
  })

  useEffect(() => {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      if (!dragStateRef.current.active) return

      const nextX = dragStateRef.current.originX + event.clientX - dragStateRef.current.startX
      const nextY = dragStateRef.current.originY + event.clientY - dragStateRef.current.startY

      setOffset({ x: nextX, y: nextY })
    }

    const handleMouseUp = () => {
      dragStateRef.current.active = false
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [])

  const startDragging = (event: ReactMouseEvent<HTMLElement>) => {
    if (event.button !== 0) return

    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
      active: true,
    }

    setIsDragging(true)
  }

  const moveWithWheel = (event: ReactWheelEvent<HTMLElement>) => {
    event.preventDefault()

    const prefersPan = Math.abs(event.deltaX) > 0 || Math.abs(event.deltaY) < 24

    if (prefersPan) {
      setOffset((currentOffset) => ({
        x: currentOffset.x - event.deltaX,
        y: currentOffset.y - event.deltaY,
      }))
      return
    }

    const zoomIntensity = event.deltaY > 0 ? 0.9 : 1.1
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * zoomIntensity))

    if (nextScale === scale) return

    const { left, top } = event.currentTarget.getBoundingClientRect()
    const pointerX = event.clientX - left
    const pointerY = event.clientY - top
    const worldX = (pointerX - offset.x) / scale
    const worldY = (pointerY - offset.y) / scale

    setScale(nextScale)
    setOffset({
      x: pointerX - worldX * nextScale,
      y: pointerY - worldY * nextScale,
    })
  }

  const activeFolder = useMemo(
    () => GRAPH_FOLDERS.find((folder) => folder.id === activeFolderId) ?? GRAPH_FOLDERS[0],
    [activeFolderId],
  )

  const nodesById = useMemo(() => {
    return Object.fromEntries(activeFolder.nodes.map((node) => [node.id, node])) as Record<string, GraphNode>
  }, [activeFolder])

  const boardStyle = {
    '--dot-gap': `${GRID_GAP * scale}px`,
    '--major-dot-gap': `${MAJOR_GRID_GAP * scale}px`,
    '--dot-size': `${Math.max(1, DOT_SIZE * scale)}px`,
    '--major-dot-size': `${Math.max(1.8, MAJOR_DOT_SIZE * scale)}px`,
    backgroundPosition: `${offset.x}px ${offset.y}px, ${offset.x}px ${offset.y}px, center, center`,
  } satisfies CSSProperties & Record<string, string>

  const graphStyle = {
    transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
  } satisfies CSSProperties

  return (
    <main className={`app-shell theme-${theme}`}>
      <aside className="sidebar">
        <div className="sidebar__header">
          <div>
            <p className="sidebar__eyebrow">Folders</p>
            <h1>Graph Vault</h1>
          </div>

          <button
            type="button"
            className="theme-toggle"
            onClick={() => setTheme((currentTheme) => (currentTheme === 'dark' ? 'light' : 'dark'))}
            aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            <span className="theme-toggle__track">
              <span className="theme-toggle__label">{theme === 'dark' ? 'Dark' : 'Light'}</span>
              <span className="theme-toggle__thumb" />
            </span>
          </button>
        </div>

        <div className="sidebar__folder-list">
          {GRAPH_FOLDERS.map((folder) => {
            const isActive = folder.id === activeFolder.id

            return (
              <button
                key={folder.id}
                type="button"
                className={`folder-card${isActive ? ' is-active' : ''}`}
                onClick={() => {
                  setActiveFolderId(folder.id)
                  setOffset({ x: 0, y: 0 })
                  setScale(1)
                }}
              >
                <span className="folder-card__name">{folder.name}</span>
                <span className="folder-card__meta">
                  {folder.nodes.length} nodes
                  {' • '}
                  {folder.edges.length} links
                </span>
                <span className="folder-card__description">{folder.description}</span>
              </button>
            )
          })}
        </div>
      </aside>

      <section className="graph-view">
        <div className="graph-toolbar">
          <span className="graph-toolbar__title">{activeFolder.name}</span>
          <span className="graph-toolbar__subtitle">{activeFolder.description}</span>
        </div>

        <section
          className={`board-viewport${isDragging ? ' is-dragging' : ''}`}
          onMouseDown={startDragging}
          onWheel={moveWithWheel}
          aria-label="Folder graph canvas"
        >
          <div className="board-surface" style={boardStyle} />

          <div className="graph-layer" style={graphStyle}>
            <svg className="graph-connections" aria-hidden="true">
              {activeFolder.edges.map((edge) => {
                const fromNode = nodesById[edge.from]
                const toNode = nodesById[edge.to]
                if (!fromNode || !toNode) return null

                return (
                  <line
                    key={`${edge.from}-${edge.to}`}
                    className="graph-edge"
                    x1={fromNode.x}
                    y1={fromNode.y}
                    x2={toNode.x}
                    y2={toNode.y}
                  />
                )
              })}
            </svg>

            {activeFolder.nodes.map((node) => (
              <div
                key={node.id}
                className={`graph-node graph-node--${node.size ?? 'node'}`}
                style={{ transform: `translate(${node.x}px, ${node.y}px)` }}
              >
                <span className="graph-node__dot" />
                <span className="graph-node__label">{node.label}</span>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  )
}

function connectTo(from: string, targets: string[]): GraphEdge[] {
  return targets.map((to) => ({ from, to }))
}

export default App
