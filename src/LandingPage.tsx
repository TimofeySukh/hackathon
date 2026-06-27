import { useState, type MouseEvent, type ChangeEvent, type FormEvent } from 'react'
import sdnLogo from './assets/sdn-logo.svg'
import linkedinBrand from './assets/brands/linkedin.svg'
import productBoardInspector from './assets/landing/product-board-inspector.png'

type TeamContact = {
  name: string
  role: string
  avatarUrl: string
  linkedinUrl: string
  email?: string
}

const TEAM_CONTACTS: TeamContact[] = [
  {
    name: 'Velizar Seleznev',
    role: 'Co-founder',
    avatarUrl: '/velizar_avatar.jpeg',
    linkedinUrl: 'https://www.linkedin.com/in/velizar-seleznev/',
    email: 'velizar.seleznev@gmail.com',
  },
  {
    name: 'Timofey Sukhov',
    role: 'Co-founder',
    avatarUrl: '/timofey_avatar.jpeg',
    linkedinUrl: 'https://www.linkedin.com/in/timofey-sukhov-775b38404/',
    email: 'timasukhovm@gmail.com',
  },
]

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

const CORE_CAPABILITIES = [
  {
    label: 'Visual graph',
    description: 'Map people and circles on an infinite board you can pan and zoom.',
  },
  {
    label: 'Rich contacts',
    description: 'Keep notes, links, and photos on each person without leaving the graph.',
  },
  {
    label: 'LinkedIn import',
    description: 'Bring exported connections onto the board in organized circle zones.',
  },
  {
    label: 'Private workspace',
    description: 'Try anonymously in your browser or sign in to sync your own graph.',
  },
  {
    label: 'Agent access',
    description: 'Connect AI tools and scripts when you need them. Details are in Docs.',
    docsLink: true,
  },
] as const

const LINKEDIN_POINTS = [
  'Import a LinkedIn Connections.csv ZIP to the board',
  'Contacts pack into circle zones automatically',
  'Enrich one profile at a time when you need more detail',
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

  const handleScrollToContact = (e: MouseEvent) => {
    e.preventDefault()
    document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })
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

          <div className="landing-nav-right">
            <div className="landing-nav-links">
              <a href="#docs" className="landing-nav-link" onClick={handleDocs}>
                Docs
              </a>
              <a href="#contact" className="landing-nav-link" onClick={handleScrollToContact}>
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
              <span className="demo-eyebrow">Social Datanode</span>
              <h1 className="demo-title">See your network as a graph</h1>
              <p className="section-lead">
                Circles, people, and links on one infinite canvas — pan, zoom, and grow without leaving the visual surface.
              </p>
              <div className="lp-deck lp-deck--compact">
                <div className="lp-deck-card lp-deck-card--tilt-1">Structure your network</div>
                <div className="lp-deck-card lp-deck-card--tilt-2">Brainstorm while looking at the graph</div>
                <div className="lp-deck-card lp-deck-card--tilt-3">Keep people, notes, and context in one visual workspace</div>
              </div>
              <button type="button" className="lp-btn lp-btn-filled landing-hero-cta" onClick={handleLaunchApp}>
                Open board
              </button>
            </div>
            <button
              type="button"
              className="board-preview-frame board-preview-shot-btn"
              onClick={handleLaunchApp}
              aria-label="Open board"
            >
              <img
                src={productBoardInspector}
                alt=""
                className="board-preview-image"
              />
            </button>
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

        {/* Core Capabilities */}
        <section className="landing-section features-section" style={{ overflow: 'visible' }}>
          <div className="section-header">
            <span className="demo-eyebrow">Core Capabilities</span>
            <h2 className="section-title">Built for your network first</h2>
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
              <h2 className="demo-title">Bring contacts onto the board</h2>
              <p className="section-lead">
                Upload your exported connections and let the board pack them into readable circle zones.
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

        {/* CTA Banner Section */}
        <section className="landing-section banner-section">
          <div className="banner-card">
            <h2 className="banner-title">Ready to map your network?</h2>
            <p className="banner-desc">
              Start from a blank board, map your circles, and keep the people who matter in one place.
            </p>
          </div>
        </section>

        <section id="contact" className="landing-section contact-section">
          <div className="section-header">
            <span className="demo-eyebrow">Contact</span>
            <h2 className="section-title">Talk to the team</h2>
          </div>
          <div className="contact-team-grid">
            {TEAM_CONTACTS.map((person, index) => (
              <article
                key={person.name}
                className={`contact-card lp-deck-card lp-deck-card--tilt-${(index % 3) + 1}`}
              >
                <img className="contact-avatar" src={person.avatarUrl} alt="" />
                <div className="contact-card-body">
                  <h3 className="contact-name">{person.name}</h3>
                  <p className="contact-role">{person.role}</p>
                  <div className="contact-links">
                    {person.email ? (
                      <a className="contact-link" href={`mailto:${person.email}`}>
                        {person.email}
                      </a>
                    ) : null}
                    <a
                      className="contact-link contact-link--linkedin"
                      href={person.linkedinUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img src={linkedinBrand} alt="" aria-hidden="true" />
                      LinkedIn
                    </a>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
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
