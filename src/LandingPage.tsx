import { useState, type MouseEvent, type ChangeEvent, type FormEvent } from 'react'
import sdnLogo from './assets/sdn-logo.svg'
import productBoardInspector from './assets/landing/product-board-inspector.png'

const HOW_IT_WORKS_STEPS = [
  {
    title: 'Start from You',
    body: 'Open the board with a single central circle and grow outward from there.',
  },
  {
    title: 'Drag to create',
    body: 'Double-tap to add people or drag from a circle center to connect new zones.',
  },
  {
    title: 'Organize in place',
    body: 'Add notes, links, and circle groups while the graph stays visual and readable.',
  },
] as const

const TRUST_ITEMS = [
  'Try without signing in',
  'Anonymous edits stay in your browser',
  'Sign in to sync a private graph',
  'No collaboration or shared boards yet',
] as const

const LINKEDIN_POINTS = [
  'Import a LinkedIn Connections.csv ZIP from the board',
  'Contacts pack into circle zones automatically',
  'Enrich one profile at a time when you need more detail',
] as const

const FAQ_ITEMS = [
  {
    question: 'Do I need an account to try it?',
    answer: 'No. Open the board anonymously and your graph is saved locally in the browser.',
  },
  {
    question: 'Does the landing demo save my edits?',
    answer: 'No. The interactive inspector on this page is a local preview only.',
  },
  {
    question: 'Where does my graph go after sign-in?',
    answer: 'Your personal graph syncs to your private Supabase record, not a shared workspace.',
  },
  {
    question: 'Can agents access my board?',
    answer: 'Only if you create a token in Settings. See Docs for MCP, CLI, and API setup.',
  },
  {
    question: 'How does LinkedIn import work?',
    answer: 'Upload a Connections.csv ZIP from the board. Bulk import stays local; single-profile enrichment runs server-side.',
  },
] as const

interface LandingPageProps {
  onLogin: () => void
  onSignUp: () => void
  isAuthenticated: boolean
}

export default function LandingPage({ onLogin, onSignUp, isAuthenticated }: LandingPageProps) {
  // Interactive Inspector Simulator local state
  const [demoName, setDemoName] = useState('New person 1')
  const [demoZone, setDemoZone] = useState<'Anthropic' | 'Google' | 'OpenAI' | null>(null)
  const [demoAvatar, setDemoAvatar] = useState<string | null>(null)
  const [demoNotes, setDemoNotes] = useState<string[]>([])
  const [newNoteText, setNewNoteText] = useState('')
  const [demoConnections, setDemoConnections] = useState<Array<{ id: string; label: string; url: string; service: 'linkedin' | 'telegram' | 'website' }>>([])
  const [demoConnectionInput, setDemoConnectionInput] = useState('')
  const [isFavorite, setIsFavorite] = useState(false)
  const [showDemoDropdown, setShowDemoDropdown] = useState(false)
  const [isAddingDemoNote, setIsAddingDemoNote] = useState(false)

  const handleLaunchApp = (e: MouseEvent) => {
    e.preventDefault()
    window.location.hash = '#board'
  }

  const handleDocs = (e: MouseEvent) => {
    e.preventDefault()
    window.location.hash = '#docs'
  }

  const handleScrollToProduct = (e: MouseEvent) => {
    e.preventDefault()
    const element = document.getElementById('product-demo')
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' })
    }
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
    setDemoName('New person 1')
    setDemoZone(null)
    setDemoAvatar('initials')
    setDemoNotes([])
    setDemoConnections([])
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
          <a href="#" className="landing-logo" onClick={handleLaunchApp}>
            <img className="landing-logo-mark" src={sdnLogo} alt="" aria-hidden="true" />
            <span className="landing-logo-text">Social Datanode</span>
          </a>

          {/* Central Navigation Links */}
          <div className="landing-nav-links">
            <a href="#product" className="landing-nav-link" onClick={handleScrollToProduct}>
              Product
            </a>
            <a href="#docs" className="landing-nav-link" onClick={handleDocs}>
              Docs
            </a>
            <a href="#contact" className="landing-nav-link" onClick={(e) => e.preventDefault()}>
              Contact
            </a>
          </div>

          {/* Right actions: Auth */}
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
        </nav>
      </header>

      {/* Main Content */}
      <main className="landing-main">
        
        <section className="landing-section hero-section" style={{ padding: '0 24px', position: 'relative', overflow: 'hidden', minHeight: '650px' }}>
          <div
            className="hero-stepped-path-container"
            style={{
              position: 'absolute',
              top: '-40px',
              bottom: '-40px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '100%',
              maxWidth: '1200px',
              zIndex: 1,
              pointerEvents: 'none',
            }}
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 1200 650"
              fill="none"
              preserveAspectRatio="none"
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                overflow: 'visible',
                objectFit: 'fill',
              }}
            >
              <path
                d="M 40,0 L 40,60 C 40,140 110,140 180,140 C 250,140 250,260 320,260 L 460,260 C 530,260 530,420 600,420 L 720,420 C 790,420 790,540 860,540 L 1080,540 C 1120,540 1160,580 1160,620 L 1160,650"
                stroke="#00629d"
                strokeWidth="84"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ vectorEffect: 'non-scaling-stroke' }}
              />
              <path
                d="M 40,0 L 40,60 C 40,140 110,140 180,140 C 250,140 250,260 320,260 L 460,260 C 530,260 530,420 600,420 L 720,420 C 790,420 790,540 860,540 L 1080,540 C 1120,540 1160,580 1160,620 L 1160,650"
                stroke="#d2e4ff"
                strokeWidth="72"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ vectorEffect: 'non-scaling-stroke' }}
              />
            </svg>
          </div>

          <div className="hero-slogans-deck">
            <div className="hero-slogan-card">Structurise your network</div>
            <div className="hero-slogan-card">Brainstorm while looking at the graph</div>
            <div className="hero-slogan-card">Keep people, notes, and context in one visual workspace</div>
          </div>

          <a href="#board" className="hero-cta-note" onClick={handleLaunchApp}>
            <span className="hero-cta-note-title">Try our product</span>
            <span className="hero-cta-note-desc">
              Open the workspace and start mapping your own relationship graph.
            </span>
          </a>
        </section>

        {/* Board Preview */}
        <section id="board-preview" className="landing-section board-preview-section">
          <div className="board-preview-layout">
            <div className="board-preview-copy">
              <span className="demo-eyebrow">The board</span>
              <h2 className="demo-title">See your network as a graph</h2>
              <p className="section-lead">
                Circles, people, and links on one infinite canvas — pan, zoom, and grow without leaving the visual surface.
              </p>
              <div className="lp-deck lp-deck--compact">
                <div className="lp-deck-card lp-deck-card--tilt-1">Central You circle with company zones like OpenAI, Anthropic, and Google</div>
                <div className="lp-deck-card lp-deck-card--tilt-2">People packed inside circles with names, notes, and connection links</div>
                <div className="lp-deck-card lp-deck-card--tilt-3">Inspector panel on the side for the person you select on the board</div>
              </div>
            </div>
            <figure className="board-preview-frame">
              <img
                src={productBoardInspector}
                alt="Social Datanode board with circle zones and the person inspector open"
                className="board-preview-image"
              />
            </figure>
          </div>
        </section>

        {/* How it works */}
        <section className="landing-section how-it-works-section">
          <div className="section-header">
            <span className="demo-eyebrow">How it works</span>
            <h2 className="section-title">Three gestures to get started</h2>
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
                key={item}
                className={`trust-strip-card lp-deck-card lp-deck-card--tilt-${(index % 3) + 1}`}
              >
                {item}
              </div>
            ))}
          </div>
        </section>

        {/* Interactive Demo Section */}
        <section id="product-demo" className="landing-section interactive-demo-section">
          <div className="demo-container">
            <div className="demo-info-col">
              <span className="demo-eyebrow">Interactive Demo</span>
              <h2 className="demo-title">Organize your connections</h2>
              <div className="demo-notes-deck">
                <div className="demo-deck-card">Make notes on people to remember who they are and where you met them</div>
                <div className="demo-deck-card">Group people into circle zones to make sorting easier later</div>
                <div className="demo-deck-card">Add people to favorites so you never lose them in the crowd</div>
              </div>
            </div>

            {/* Simulated Inspector Card */}
            <div className="demo-inspector-card">
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
                  className="demo-inspector-star-btn"
                  onClick={() => setIsFavorite(!isFavorite)}
                  title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  <svg viewBox="0 0 24 24">
                    <path
                      d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                      fill={isFavorite ? '#ffd600' : 'none'}
                      stroke={isFavorite ? '#d97706' : '#73777f'}
                      strokeWidth={2}
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
                Delete person
              </button>
            </div>
          </div>
        </section>

        {/* Feature Grid Section */}
        <section className="landing-section features-section" style={{ overflow: 'visible' }}>
          <div className="section-header">
            <span className="demo-eyebrow">Core Capabilities</span>
            <h2 className="section-title">Designed for agents and humans</h2>
          </div>

          <div className="capabilities-scatter-board">
            <div className="capabilities-scatter-card scatter-card--1">
              <span className="demo-field-label">AI-Native</span>
              <p className="feature-card-description">AI-Native mutations: Scoped keys and structured JSON envelope mutations designed for AI agent integration.</p>
            </div>
            <div className="capabilities-scatter-card scatter-card--2">
              <span className="demo-field-label">MCP Protocol</span>
              <p className="feature-card-description">Stdio MCP server: Standard Model Context Protocol server exposing graph tools to AI clients like Claude.</p>
            </div>
            <div className="capabilities-scatter-card scatter-card--3">
              <span className="demo-field-label">Remote API</span>
              <p className="feature-card-description">Remote API access: Query and update relationship nodes remotely without exposing Supabase secrets.</p>
            </div>
            <div className="capabilities-scatter-card scatter-card--4">
              <span className="demo-field-label">CLI Tool</span>
              <p className="feature-card-description">datanode-cli tool: A local command-line interface helper for fast batch mutations and database scripts.</p>
            </div>
            <div className="capabilities-scatter-card scatter-card--5">
              <span className="demo-field-label">Concurrency</span>
              <p className="feature-card-description">Expected Revisions: Concurrency controls using expectedRevision parameters to prevent collision conflicts.</p>
            </div>
            <div className="capabilities-scatter-card scatter-card--6">
              <span className="demo-field-label">Security</span>
              <p className="feature-card-description">Vault-encrypted tokens: Revocable API keys hashed at rest and securely verified by Edge Functions.</p>
            </div>
            <div className="capabilities-scatter-card scatter-card--7">
              <span className="demo-field-label">Visual Layout</span>
              <p className="feature-card-description">Sunflower packaging: Contacts clustered into neat sunflower spiral layouts inside boundaries without lag.</p>
            </div>
            <div className="capabilities-scatter-card scatter-card--8">
              <span className="demo-field-label">2D Canvas</span>
              <p className="feature-card-description">Lightweight canvas: High performance 2D drawing pipeline with lightweight spatial grid hit testing.</p>
            </div>
            <div className="capabilities-scatter-card scatter-card--9">
              <span className="demo-field-label">Physics Engine</span>
              <p className="feature-card-description">Collision repulsion: Layout collision physics engine that repels adjacent nodes to keep labels visible.</p>
            </div>
            <div className="capabilities-scatter-card scatter-card--10">
              <span className="demo-field-label">Enrichment</span>
              <p className="feature-card-description">LinkedIn enrichment: Supabase Edge Function that resolves and imports manual LinkedIn profile details.</p>
            </div>
            <div className="capabilities-scatter-card scatter-card--11">
              <span className="demo-field-label">Containment</span>
              <p className="feature-card-description">Auto-containment: Automatic sizing and subset fitting when circles are drag-resized.</p>
            </div>
            <div className="capabilities-scatter-card scatter-card--12">
              <span className="demo-field-label">Database</span>
              <p className="feature-card-description">Privacy first RLS: Safe database access and Google authentication protected by Row-Level Security.</p>
            </div>
          </div>
        </section>

        {/* LinkedIn Import */}
        <section className="landing-section linkedin-section">
          <div className="linkedin-layout">
            <div className="linkedin-copy">
              <span className="demo-eyebrow">LinkedIn import</span>
              <h2 className="demo-title">Bring contacts onto the board</h2>
              <p className="section-lead">
                Upload your exported connections and let the board pack them into readable circle zones.
              </p>
              <button className="lp-btn lp-btn-filled linkedin-cta" type="button" onClick={handleLaunchApp}>
                Open board to import
              </button>
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

        {/* FAQ */}
        <section className="landing-section faq-section">
          <div className="section-header">
            <span className="demo-eyebrow">FAQ</span>
            <h2 className="section-title">Common questions</h2>
          </div>
          <div className="faq-list">
            {FAQ_ITEMS.map((item, index) => (
              <div key={item.question} className="faq-row">
                <div className={`faq-question lp-deck-card lp-deck-card--faq-q lp-deck-card--tilt-${(index % 3) + 1}`}>
                  {item.question}
                </div>
                <div className={`faq-answer lp-deck-card lp-deck-card--faq-a lp-deck-card--tilt-${((index + 1) % 3) + 1}`}>
                  {item.answer}
                  {index === 3 && (
                    <>
                      {' '}
                      <button type="button" className="faq-inline-link" onClick={handleDocs}>
                        Open docs
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Banner Section */}
        <section className="landing-section banner-section">
          <div className="banner-card">
            <h2 className="banner-title">Ready to map your network?</h2>
            <p className="banner-desc">
              Organize your workspace, visualize connections, and gain insights with Social Datanode today. Free, open, and secure.
            </p>
            <button className="lp-btn lp-btn-filled" style={{ height: '48px', padding: '0 32px' }} onClick={handleLaunchApp}>
              Launch Board
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer id="contact" className="landing-footer">
        <div className="footer-content">
          <a href="#" className="footer-logo" onClick={handleLaunchApp}>
            <img className="footer-logo-mark" src={sdnLogo} alt="" aria-hidden="true" />
            <span className="footer-logo-text">Social Datanode</span>
          </a>
          <span className="footer-copyright">
            &copy; {new Date().getFullYear()} Social Datanode. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  )
}
