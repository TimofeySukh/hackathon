import { useState, type MouseEvent, type ChangeEvent, type FormEvent } from 'react'
import sdnLogo from './assets/sdn-logo.svg'
import productBoardInspector from './assets/landing/product-board-inspector.png'

const HOW_IT_WORKS_STEPS = [
  {
    title: 'Start with one person',
    body: 'Open a blank board, keep yourself at the center, and add the first person you need to remember.',
  },
  {
    title: 'Put context where it belongs',
    body: 'Drop people into circles, attach notes and links, and keep the relationship visible instead of buried in rows.',
  },
  {
    title: 'Let the map grow with you',
    body: 'Pan, zoom, resize, and connect circles as your network turns into a working memory system.',
  },
] as const

const PROBLEM_SOLUTION_CARDS = [
  {
    label: 'Before',
    title: 'Your network is stored in the wrong shape',
    body: 'Names sit in spreadsheets, meeting details sit in memory, and introductions lose their surrounding context. The data exists, but the relationship is invisible.',
  },
  {
    label: 'After',
    title: 'Every person has a place on the board',
    body: 'Social Datanode turns people, notes, groups, and links into a spatial graph, so the structure of your network stays visible while you work.',
  },
] as const

const TRUST_ITEMS = [
  {
    title: 'Try first',
    body: 'Open the board without an account and test the workflow immediately.',
  },
  {
    title: 'Local by default',
    body: 'Anonymous edits stay in this browser until you decide to sign in.',
  },
  {
    title: 'Private sync',
    body: 'Signed-in boards sync to your own private graph.',
  },
  {
    title: 'Clear limits',
    body: 'No shared boards or multiplayer collaboration yet.',
  },
] as const

const CORE_CAPABILITIES = [
  {
    label: 'Map the network',
    description: 'Place people inside circles, connect zones, and zoom from a close note to the whole graph.',
  },
  {
    label: 'Remember the details',
    description: 'Store notes, links, and photos directly on the person they describe.',
  },
  {
    label: 'Import the raw list',
    description: 'Turn a LinkedIn Connections.csv export into organized people on the board.',
  },
  {
    label: 'Work privately',
    description: 'Use a browser-local board anonymously, or sign in when you want private sync.',
  },
  {
    label: 'Let agents help',
    description: 'Use the documented API, CLI, and MCP access when you want scripts or AI tools to read and update the graph.',
    docsLink: true,
  },
] as const

const LINKEDIN_POINTS = [
  'Request your LinkedIn archive and upload the Connections.csv ZIP',
  'Companies become readable circle zones instead of one long table',
  'Open a person, add notes, and enrich one profile when the detail matters',
] as const

const HERO_CARDS = [
  'Use circles for companies, communities, projects, and relationship groups',
  'Keep notes, links, and photos attached to the person they describe',
  'Search, import, and let agents work with the same private graph',
] as const

const HERO_TRUST_ITEMS = ['No account needed to try', 'Private sync when signed in', 'Real board preview'] as const

const DEMO_CARDS = [
  'Edit the person name the same way you would in the real inspector.',
  'Move the person into a circle so context stays spatial, not just textual.',
  'Add the note or link you would otherwise forget after the meeting.',
] as const

const DEFAULT_DEMO_CONNECTIONS = [
  { id: 'demo-linkedin', label: 'LinkedIn Profile', url: 'https://linkedin.com/in/example', service: 'linkedin' as const },
]

interface LandingPageProps {
  onLogin: () => void
  onSignUp: () => void
  isAuthenticated: boolean
}

export default function LandingPage({ onLogin, onSignUp, isAuthenticated }: LandingPageProps) {
  // Interactive Inspector Simulator local state
  const [demoName, setDemoName] = useState('Maya Chen')
  const [demoZone, setDemoZone] = useState<'Anthropic' | 'Google' | 'OpenAI' | null>('OpenAI')
  const [demoAvatar, setDemoAvatar] = useState<string | null>(null)
  const [demoNotes, setDemoNotes] = useState<string[]>(['Met at the AI founders dinner. Interested in private relationship mapping.'])
  const [newNoteText, setNewNoteText] = useState('')
  const [demoConnections, setDemoConnections] = useState<Array<{ id: string; label: string; url: string; service: 'linkedin' | 'telegram' | 'website' }>>(DEFAULT_DEMO_CONNECTIONS)
  const [demoConnectionInput, setDemoConnectionInput] = useState('')
  const [isFavorite, setIsFavorite] = useState(false)
  const [showDemoDropdown, setShowDemoDropdown] = useState(false)
  const [isAddingDemoNote, setIsAddingDemoNote] = useState(false)

  const handleHome = (e: MouseEvent) => {
    e.preventDefault()
    window.location.hash = ''
  }

  const handleLaunchApp = (e: MouseEvent) => {
    e.preventDefault()
    window.location.hash = '#board'
  }

  const handleDocs = (e: MouseEvent) => {
    e.preventDefault()
    window.location.hash = '#docs'
  }

  const handleContact = (e: MouseEvent) => {
    e.preventDefault()
    window.location.hash = '#contact'
  }

  const handlePrivacy = (e: MouseEvent) => {
    e.preventDefault()
    window.location.hash = '#privacy'
  }

  const handleAddDemoNote = (e: FormEvent) => {
    e.preventDefault()
    if (!newNoteText.trim()) return
    setDemoNotes([...demoNotes, newNoteText.trim()])
    setNewNoteText('')
    setIsAddingDemoNote(false)
  }

  const handleDemoAvatarUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => {
      setDemoAvatar(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  const handleAddDemoConnection = (e: FormEvent) => {
    e.preventDefault()
    if (!demoConnectionInput.trim()) return
    const input = demoConnectionInput.trim()
    let service: 'linkedin' | 'telegram' | 'website' = 'website'
    let label = input
    if (input.includes('linkedin.com') || input.includes('in/')) {
      service = 'linkedin'
      label = 'LinkedIn Profile'
    } else if (input.includes('t.me') || input.startsWith('@')) {
      service = 'telegram'
      label = 'Telegram Chat'
    } else {
      label = 'Personal Link'
    }
    setDemoConnections([
      ...demoConnections,
      { id: Date.now().toString(), label, url: input, service }
    ])
    setDemoConnectionInput('')
  }

  const handleDeleteDemoConnection = (id: string) => {
    setDemoConnections(demoConnections.filter((c) => c.id !== id))
  }

  const handleResetDemo = () => {
    setDemoName('Maya Chen')
    setDemoZone('OpenAI')
    setDemoAvatar('initials')
    setDemoNotes(['Met at the AI founders dinner. Interested in private relationship mapping.'])
    setDemoConnections(DEFAULT_DEMO_CONNECTIONS)
    setIsFavorite(false)
    setShowDemoDropdown(false)
    setIsAddingDemoNote(false)
    setDemoConnectionInput('')
  }

  return (
    <div className="landing-container">
      {/* Header & Sticky Glass Navigation */}
      <header className="landing-header">
        <nav className="landing-nav">
          <a href="#" className="landing-logo" onClick={handleHome}>
            <img className="landing-logo-mark" src={sdnLogo} alt="" aria-hidden="true" />
            <span className="landing-logo-text">Social Datanode</span>
          </a>

          <div className="landing-nav-right">
            <div className="landing-nav-links">
              <a href="#docs" className="landing-nav-link" onClick={handleDocs}>
                Docs
              </a>
              <a href="#contact" className="landing-nav-link" onClick={handleContact}>
                Contact
              </a>
            </div>

            <div className="landing-nav-actions">
            {isAuthenticated ? (
              <button className="lp-btn lp-btn-filled" onClick={handleLaunchApp}>
                Launch App
              </button>
            ) : (
              <>
                <button className="lp-btn lp-btn-text" onClick={onLogin}>
                  Log in
                </button>
                <button className="lp-btn lp-btn-filled" onClick={onSignUp}>
                  Sign up
                </button>
              </>
            )}
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="landing-main">

        <section id="board-preview" className="landing-section landing-hero-section">
          <div className="board-preview-layout">
            <div className="board-preview-copy">
              <span className="demo-eyebrow">Private relationship board</span>
              <h1 className="demo-title">Stop managing people from memory and spreadsheets</h1>
              <p className="section-lead">
                Social Datanode gives every person, note, group, and link a visible place on one board, so your network becomes something you can inspect, organize, and use.
              </p>
              <div className="lp-deck lp-deck--compact">
                {HERO_CARDS.map((card, index) => (
                  <div key={card} className={`lp-deck-card lp-deck-card--tilt-${(index % 3) + 1}`}>
                    {card}
                  </div>
                ))}
              </div>
              <div className="landing-hero-actions">
                <button type="button" className="lp-btn lp-btn-filled landing-hero-cta" onClick={handleLaunchApp}>
                  Open board
                </button>
                <p className="landing-hero-note">Try it now. Sign in later only if you want private sync.</p>
              </div>
              <div className="landing-hero-proof" aria-label="Product trust facts">
                {HERO_TRUST_ITEMS.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
            <figure className="board-preview-frame" aria-label="Product preview">
              <img
                src={productBoardInspector}
                alt="Social Datanode board preview with the person inspector open"
                className="board-preview-image"
              />
            </figure>
          </div>
        </section>

        <section className="landing-section problem-solution-section" aria-labelledby="problem-solution-title">
          <div className="section-header problem-solution-header">
            <span className="demo-eyebrow">Problem and answer</span>
            <h2 id="problem-solution-title" className="section-title">Relationships are not a table</h2>
          </div>
          <div className="problem-solution-grid">
            {PROBLEM_SOLUTION_CARDS.map((card, index) => (
              <article
                key={card.label}
                className={`problem-solution-card lp-deck-card lp-deck-card--tilt-${index + 1}`}
              >
                <span className="problem-solution-card__label">{card.label}</span>
                <h3 className="problem-solution-card__title">{card.title}</h3>
                <p className="problem-solution-card__body">{card.body}</p>
              </article>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="landing-section how-it-works-section">
          <div className="section-header">
            <span className="demo-eyebrow">How it works</span>
            <h2 className="section-title">Build a useful map in minutes</h2>
          </div>
          <div className="how-it-works-grid">
            {HOW_IT_WORKS_STEPS.map((step, index) => (
              <div key={step.title} className={`how-step lp-deck-card lp-deck-card--tilt-${(index % 3) + 1}`}>
                <span className="how-step-number">{index + 1}</span>
                <h3 className="how-step-title">{step.title}</h3>
                <p className="how-step-body">{step.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Trust strip */}
        <section className="trust-strip-section" aria-label="Privacy and data ownership">
          <div className="trust-strip">
            {TRUST_ITEMS.map((item, index) => (
              <div
                key={item.title}
                className={`trust-strip-card lp-deck-card lp-deck-card--tilt-${(index % 3) + 1}`}
              >
                <span className="trust-strip-card__title">{item.title}</span>
                <span className="trust-strip-card__body">{item.body}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Interactive Demo Section */}
        <section id="product-demo" className="landing-section interactive-demo-section">
          <div className="demo-container">
            <div className="demo-info-col">
              <span className="demo-eyebrow">Interactive demo</span>
              <h2 className="demo-title">Try the inspector before opening the board</h2>
              <p className="section-lead">
                This is the smallest unit of the product: one person, one circle, one memory worth keeping.
              </p>
              <div className="demo-notes-deck">
                {DEMO_CARDS.map((card) => (
                  <div key={card} className="demo-deck-card">{card}</div>
                ))}
              </div>
            </div>

            {/* Simulated Inspector Card */}
            <div className="demo-inspector-card">
              <div className="demo-inspector-kicker">
                <span>Demo inspector</span>
                <span>Local state only</span>
              </div>
              <div className="demo-inspector-header">
                <input
                  type="text"
                  className="demo-inspector-name-input"
                  value={demoName}
                  onChange={(e) => setDemoName(e.target.value)}
                  placeholder="New person 1"
                />
                <button
                  type="button"
                  className={`demo-inspector-star-btn ${isFavorite ? 'is-active' : ''}`}
                  onClick={() => setIsFavorite(!isFavorite)}
                  title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                    />
                  </svg>
                </button>
              </div>

              <div className="demo-dropdown-avatar-row">
                {/* Custom Select Dropdown */}
                <div className="demo-dropdown-wrapper">
                  <button
                    type="button"
                    className="demo-dropdown-trigger"
                    onClick={() => setShowDemoDropdown(!showDemoDropdown)}
                  >
                    <span
                      className="demo-dropdown-dot"
                      style={{
                        backgroundColor:
                          demoZone === 'Anthropic'
                            ? '#00629d'
                            : demoZone === 'Google'
                            ? '#d87a00'
                            : demoZone === 'OpenAI'
                            ? '#1e824a'
                            : '#b0b8c4'
                      }}
                    />
                    <span className="demo-dropdown-text">
                      {demoZone || 'Select circle'}
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      className="demo-dropdown-chevron"
                      style={{
                        transform: showDemoDropdown ? 'rotate(180deg)' : 'none'
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {showDemoDropdown && (
                    <div className="demo-dropdown-menu">
                      <button
                        type="button"
                        className="demo-dropdown-option"
                        onClick={() => {
                          setDemoZone(null)
                          setShowDemoDropdown(false)
                        }}
                      >
                        <span className="demo-dropdown-dot" style={{ backgroundColor: '#b0b8c4' }} />
                        <span>Select circle</span>
                      </button>
                      <button
                        type="button"
                        className="demo-dropdown-option"
                        onClick={() => {
                          setDemoZone('Anthropic')
                          setShowDemoDropdown(false)
                        }}
                      >
                        <span className="demo-dropdown-dot" style={{ backgroundColor: '#00629d' }} />
                        <span>Anthropic</span>
                      </button>
                      <button
                        type="button"
                        className="demo-dropdown-option"
                        onClick={() => {
                          setDemoZone('Google')
                          setShowDemoDropdown(false)
                        }}
                      >
                        <span className="demo-dropdown-dot" style={{ backgroundColor: '#d87a00' }} />
                        <span>Google</span>
                      </button>
                      <button
                        type="button"
                        className="demo-dropdown-option"
                        onClick={() => {
                          setDemoZone('OpenAI')
                          setShowDemoDropdown(false)
                        }}
                      >
                        <span className="demo-dropdown-dot" style={{ backgroundColor: '#1e824a' }} />
                        <span>OpenAI</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Avatar Picker */}
                <label
                  className="demo-avatar-btn"
                  title="Upload avatar image from computer"
                >
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleDemoAvatarUpload}
                  />
                  {demoAvatar ? (
                    <img src={demoAvatar} alt="Avatar" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="demo-avatar-icon">
                      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                      <circle cx="12" cy="7" r="4" />
                    </svg>
                  )}
                </label>
              </div>

              {/* Notes Box */}
              <div className="demo-box">
                <h4 className="demo-box-title">Notes</h4>

                {demoNotes.length > 0 && (
                  <div className="demo-notes-list">
                    {demoNotes.map((note, index) => (
                      <div key={index} className="demo-note-item">
                        <p className="demo-note-text">{note}</p>
                        <button
                          type="button"
                          className="demo-note-delete"
                          onClick={() => setDemoNotes(demoNotes.filter((_, i) => i !== index))}
                          title="Delete note"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {isAddingDemoNote ? (
                  <form onSubmit={handleAddDemoNote} className="demo-note-composer">
                    <textarea
                      className="demo-note-textarea"
                      value={newNoteText}
                      onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setNewNoteText(e.target.value)}
                      placeholder="Write a note..."
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          if (newNoteText.trim()) {
                            setDemoNotes([...demoNotes, newNoteText.trim()])
                            setNewNoteText('')
                          }
                        } else if (e.key === 'Escape') {
                          setIsAddingDemoNote(false)
                          setNewNoteText('')
                        }
                      }}
                    />
                    <div className="demo-note-composer-actions">
                      <button
                        type="button"
                        className="demo-note-save-btn"
                        onClick={() => {
                          if (newNoteText.trim()) {
                            setDemoNotes([...demoNotes, newNoteText.trim()])
                            setNewNoteText('')
                            setIsAddingDemoNote(false)
                          }
                        }}
                      >
                        Save note
                      </button>
                      <button
                        type="button"
                        className="demo-note-cancel-btn"
                        onClick={() => {
                          setIsAddingDemoNote(false)
                          setNewNoteText('')
                        }}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="demo-note-add-btn"
                    onClick={() => setIsAddingDemoNote(true)}
                  >
                    <span className="demo-note-add-plus">+</span> Add note
                  </button>
                )}
              </div>

              {/* Connections Box */}
              <div className="demo-box">
                <h4 className="demo-box-title">Connections</h4>

                {demoConnections.length > 0 && (
                  <div className="demo-connections-list">
                    {demoConnections.map((c) => (
                      <div key={c.id} className="demo-connection-item">
                        <span className="demo-connection-label">{c.label}</span>
                        <button
                          type="button"
                          className="demo-connection-delete"
                          onClick={() => handleDeleteDemoConnection(c.id)}
                          title="Delete connection"
                        >
                          &times;
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleAddDemoConnection} className="demo-connection-input-row">
                  <input
                    type="text"
                    className="demo-connection-input"
                    value={demoConnectionInput}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setDemoConnectionInput(e.target.value)}
                    placeholder="Add link, @handle, or phone"
                  />
                  <button type="submit" className="demo-connection-save-btn">
                    Save
                  </button>
                </form>
              </div>

              {/* Delete Person Button */}
              <button
                type="button"
                className="demo-delete-person-btn"
                onClick={handleResetDemo}
              >
                Reset demo
              </button>
            </div>
          </div>
        </section>

        {/* Core Capabilities */}
        <section className="landing-section features-section" style={{ overflow: 'visible' }}>
          <div className="section-header">
            <span className="demo-eyebrow">Core capabilities</span>
            <h2 className="section-title">What the board lets you do</h2>
          </div>

          <div className="capabilities-scatter-board">
            {CORE_CAPABILITIES.map((capability, index) => {
              const card = (
                <>
                  <span className="demo-field-label">{capability.label}</span>
                  <p className="feature-card-description">{capability.description}</p>
                </>
              )

              if ('docsLink' in capability && capability.docsLink) {
                return (
                  <button
                    key={capability.label}
                    type="button"
                    className={`capabilities-scatter-card scatter-card--${index + 1} capabilities-scatter-card--link`}
                    onClick={handleDocs}
                  >
                    {card}
                  </button>
                )
              }

              return (
                <div key={capability.label} className={`capabilities-scatter-card scatter-card--${index + 1}`}>
                  {card}
                </div>
              )
            })}
          </div>
        </section>

        {/* LinkedIn Import */}
        <section className="landing-section linkedin-section">
          <div className="linkedin-layout">
            <div className="linkedin-copy">
              <span className="demo-eyebrow">LinkedIn import</span>
              <h2 className="demo-title">Start with the contacts you already have</h2>
              <p className="section-lead">
                A flat export is enough to get momentum. Import the list, then use the board to decide what deserves real context.
              </p>
            </div>
            <div className="lp-deck">
              {LINKEDIN_POINTS.map((point, index) => (
                <div key={point} className={`lp-deck-card lp-deck-card--tilt-${(index % 3) + 1}`}>
                  {point}
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <a href="#" className="footer-logo" onClick={handleHome}>
            <img className="footer-logo-mark" src={sdnLogo} alt="" aria-hidden="true" />
            <span className="footer-logo-text">Social Datanode</span>
          </a>
          <div className="footer-legal">
            <a href="#privacy" className="footer-legal-link" onClick={handlePrivacy}>
              Privacy Policy
            </a>
            <span className="footer-copyright">
              &copy; {new Date().getFullYear()} Social Datanode. All rights reserved.
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
