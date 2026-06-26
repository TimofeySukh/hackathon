import { useMemo, useState } from 'react'
import type { ChangeEvent } from 'react'
import sdnLogo from './assets/sdn-logo.svg'

type LandingRoute = 'home' | 'docs' | 'contact'
type AuthIntent = 'signin' | 'signup'

type LandingPageProps = {
  route: LandingRoute
  onOpenProduct: () => void
  onAuthIntent: (intent: AuthIntent) => void
}

const docGroups = [
  {
    title: 'API surface',
    body: 'Browser app, Supabase Edge Functions, AI note sync, LinkedIn enrichment, and graph persistence entry points.',
    items: ['sync-person-ai-note', 'search-people-ai', 'enrich-linkedin-profile', 'user_graphs graph blob'],
  },
  {
    title: 'CLI',
    body: 'Local commands for development, builds, seeding, load checks, and production validation.',
    items: ['npm run dev', 'npm run build', 'npm run seed:board', 'npm run test:load'],
  },
  {
    title: 'MCP',
    body: 'Agent-facing project resources and service-role scoped board graph tools live behind the local MCP server.',
    items: ['npm run mcp:start', '.env.mcp.local', 'docs resources', 'board graph tools'],
  },
]

const zones = ['Anthropic', 'Google', 'OpenAI']

export default function LandingPage({ route, onOpenProduct, onAuthIntent }: LandingPageProps) {
  const [personName, setPersonName] = useState('New person 2')
  const [selectedZone, setSelectedZone] = useState(zones[2])
  const [noteDraft, setNoteDraft] = useState('')
  const [notes, setNotes] = useState(['Met at AI infra dinner', 'Can intro to platform teams'])
  const [connectionDraft, setConnectionDraft] = useState('@sam-network')
  const [connections, setConnections] = useState(['linkedin.com/in/sam'])
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  const selectedZoneText = useMemo(() => `${selectedZone} zone`, [selectedZone])

  const handleAvatar = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    setAvatarUrl(URL.createObjectURL(file))
  }

  const addNote = () => {
    const nextNote = noteDraft.trim()
    if (!nextNote) return
    setNotes((current) => [...current, nextNote])
    setNoteDraft('')
  }

  const addConnection = () => {
    const nextConnection = connectionDraft.trim()
    if (!nextConnection) return
    setConnections((current) => [...current, nextConnection])
    setConnectionDraft('')
  }

  return (
    <main className="landing-page" aria-label="Social Datanode">
      <Header route={route} onAuthIntent={onAuthIntent} onOpenProduct={onOpenProduct} />
      {route === 'docs' ? (
        <DocsPage />
      ) : route === 'contact' ? (
        <ContactPage />
      ) : (
        <>
          <section className="landing-hero" id="top">
            <div className="landing-hero-slogans" aria-label="Product focus">
              <article>
                <span>01</span>
                <strong>Sort the chaos</strong>
                <p>Contacts, notes, companies, follow-ups, and half-remembered intros stop living in separate piles.</p>
              </article>
              <article>
                <span>02</span>
                <strong>Make the map visible</strong>
                <p>Drop people into zones, keep context attached, and see where the relationship actually belongs.</p>
              </article>
              <article>
                <span>03</span>
                <strong>Act from the board</strong>
                <p>Open the workspace when the next person, intro, or note is clear enough to move.</p>
              </article>
            </div>

            <div className="landing-chaos-stage">
              <svg className="landing-stairs" viewBox="0 0 1200 440" preserveAspectRatio="none" aria-hidden="true">
                <path
                  className="landing-stairs-outline"
                  d="M18 82 H264 V126 H330 V172 H454 V214 H560 V252 H716 V302 H842 V344 H1048 V386 H1182"
                />
                <path
                  className="landing-stairs-fill"
                  d="M18 82 H264 V126 H330 V172 H454 V214 H560 V252 H716 V302 H842 V344 H1048 V386 H1182"
                />
              </svg>
              <div className="chaos-card chaos-card-a">Investor list.pdf</div>
              <div className="chaos-card chaos-card-b">OpenAI lead</div>
              <div className="chaos-card chaos-card-c">Google alumni</div>
              <div className="chaos-card chaos-card-d">Need warm intro</div>
              <button type="button" className="landing-board-note" onClick={onOpenProduct}>
                <span>Open the blank board</span>
                <strong>Start turning loose relationship data into a working map.</strong>
              </button>
            </div>
          </section>

          <section className="landing-interactive" id="product">
            <div className="landing-interactive-copy">
              <span className="landing-section-kicker">Interactive inspector</span>
              <h1>One person, three zones, all the context attached.</h1>
              <p>
                This mock panel behaves like the board inspector. Try changing the zone, adding a photo,
                writing notes, and collecting connections. Nothing here is saved.
              </p>
            </div>

            <div className="landing-inspector-demo" aria-label="Person inspector demo">
              <div className="landing-demo-board">
                {zones.map((zone, index) => (
                  <button
                    type="button"
                    key={zone}
                    className={`landing-zone landing-zone-${index + 1} ${zone === selectedZone ? 'is-active' : ''}`}
                    onClick={() => setSelectedZone(zone)}
                  >
                    {zone}
                  </button>
                ))}
                <div className="landing-person-chip">
                  {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{personName.slice(0, 1) || 'N'}</span>}
                  <strong>{personName || 'Unnamed person'}</strong>
                  <small>{selectedZoneText}</small>
                </div>
              </div>

              <aside className="landing-person-panel">
                <div className="landing-panel-title">
                  <input
                    aria-label="Person name"
                    value={personName}
                    onChange={(event) => setPersonName(event.target.value)}
                  />
                  <span aria-hidden="true">☆</span>
                </div>
                <div className="landing-person-row">
                  <label className="landing-zone-select">
                    <span aria-hidden="true" />
                    <select value={selectedZone} onChange={(event) => setSelectedZone(event.target.value)}>
                      {zones.map((zone) => (
                        <option key={zone} value={zone}>{zone}</option>
                      ))}
                    </select>
                  </label>
                  <label className="landing-avatar-picker">
                    {avatarUrl ? <img src={avatarUrl} alt="" /> : <span aria-hidden="true">⌁</span>}
                    <input type="file" accept="image/*" onChange={handleAvatar} aria-label="Add photo" />
                  </label>
                </div>
                <section className="landing-panel-block">
                  <h2>Notes</h2>
                  <div className="landing-note-list">
                    {notes.map((note) => <p key={note}>{note}</p>)}
                  </div>
                  <div className="landing-inline-compose">
                    <input
                      value={noteDraft}
                      onChange={(event) => setNoteDraft(event.target.value)}
                      placeholder="Add note"
                    />
                    <button type="button" onClick={addNote}>Add</button>
                  </div>
                </section>
                <section className="landing-panel-block">
                  <h2>Connections</h2>
                  <div className="landing-connection-list">
                    {connections.map((connection) => <span key={connection}>{connection}</span>)}
                  </div>
                  <div className="landing-inline-compose">
                    <input
                      value={connectionDraft}
                      onChange={(event) => setConnectionDraft(event.target.value)}
                      placeholder="Add link, @handle, or phone"
                    />
                    <button type="button" onClick={addConnection}>Save</button>
                  </div>
                </section>
                <button type="button" className="landing-delete-person">Delete person</button>
              </aside>
            </div>
          </section>

          <section className="landing-final">
            <div>
              <span className="landing-section-kicker">Blank by default</span>
              <h1>Open the board when you are ready to organize the real mess.</h1>
            </div>
            <button type="button" className="landing-product-button" onClick={onOpenProduct}>
              Open workspace
            </button>
          </section>
        </>
      )}
    </main>
  )
}

function Header({ route, onAuthIntent, onOpenProduct }: LandingPageProps) {
  return (
    <nav className="landing-nav" aria-label="Landing navigation">
      <a className="landing-brand" href="#top" aria-label="Social Datanode home">
        <img src={sdnLogo} alt="" aria-hidden="true" />
        <strong>Social Datanode</strong>
      </a>
      <div className="landing-nav-links">
        <a className={route === 'home' ? 'is-active' : ''} href="#top">Product</a>
        <a className={route === 'docs' ? 'is-active' : ''} href="#docs">Docs</a>
        <a className={route === 'contact' ? 'is-active' : ''} href="#contact">Contact</a>
      </div>
      <div className="landing-nav-actions">
        <button type="button" onClick={() => onAuthIntent('signin')}>Log in</button>
        <button type="button" className="landing-nav-cta" onClick={() => onAuthIntent('signup')}>Sign up</button>
        <button type="button" className="landing-nav-open" onClick={onOpenProduct}>Open app</button>
      </div>
    </nav>
  )
}

function DocsPage() {
  return (
    <section className="landing-docs" aria-label="Developer documentation">
      <div className="landing-docs-hero">
        <span className="landing-section-kicker">Docs</span>
        <h1>API, CLI, and MCP notes belong here, not on the board.</h1>
        <p>
          This page collects the operational docs that were crowding the product story:
          app commands, server-side functions, graph persistence, and agent tooling.
        </p>
      </div>
      <div className="landing-doc-grid">
        {docGroups.map((group) => (
          <article className="landing-doc-card" key={group.title}>
            <h2>{group.title}</h2>
            <p>{group.body}</p>
            <ul>
              {group.items.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </article>
        ))}
      </div>
    </section>
  )
}

function ContactPage() {
  return (
    <section className="landing-contact" aria-label="Contact">
      <h1>Contact</h1>
    </section>
  )
}
