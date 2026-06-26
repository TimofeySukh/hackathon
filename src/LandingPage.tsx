import { useState, type MouseEvent, type ChangeEvent, type FormEvent } from 'react'
import sdnLogo from './assets/sdn-logo.svg'


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
          {/* Stepped background ribbon using double stroke technique for perfect border & thickness */}
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
              pointerEvents: 'none'
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
                objectFit: 'fill'
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

          {/* Slogans stacked deck (top-right) */}
          <div className="hero-slogans-deck">
            <div className="hero-slogan-card">Structurise your network</div>
            <div className="hero-slogan-card">Brainstorm while looking at the graph</div>
            <div className="hero-slogan-card">Keep people, notes, and context in one visual workspace</div>
          </div>

          {/* "Try our product" CTA clickable note (bottom-left) */}
          <a href="#board" className="hero-cta-note" onClick={handleLaunchApp}>
            <span className="hero-cta-note-title">Try our product</span>
            <span className="hero-cta-note-desc">
              Open the workspace and start mapping your own relationship graph.
            </span>
          </a>
        </section>

        {/* Interactive Demo Section */}
        <section id="product-demo" className="landing-section interactive-demo-section">
          <div className="demo-container">
            <div className="demo-info-col">
              <span className="demo-eyebrow">Interactive Demo</span>
              <h2 className="demo-title">Inspect & organize network nodes</h2>
              <p className="demo-desc">
                Social Datanode allows you to edit contact properties, organize profiles into company-wide provider zones, and add encrypted interaction notes. Experiment with this live simulator:
              </p>
              <button className="lp-btn lp-btn-filled" style={{ height: '44px' }} onClick={handleLaunchApp}>
                Try Live Board Workspace
              </button>
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
        <section className="landing-section features-section">
          <div className="section-header">
            <h2 className="section-title">Core Capabilities</h2>
            <p className="section-subtitle">
              Designed from the ground up for privacy, fluid movement, and intelligent networking.
            </p>
          </div>

          <div className="features-grid">
            {/* Feature 1 */}
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="4" />
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
              </div>
              <h3 className="feature-card-title">Infinite Spatial Canvas</h3>
              <p className="feature-card-description">
                Pan, zoom, and grow your graph seamlessly. The layout engine automatically repels sibling elements to maintain visual clarity without overlaps.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <h3 className="feature-card-title">Connections Clustering</h3>
              <p className="feature-card-description">
                Imported contacts are packed into neat sunflower spirals grouped inside boundary circles. No messy overlap clumps or lags, even at 3,000+ nodes.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                </svg>
              </div>
              <h3 className="feature-card-title">Privacy First Architecture</h3>
              <p className="feature-card-description">
                All data is processed directly inside your browser. Save local offline files or sync with your private, encrypted database.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <path d="M8 11h6M11 8v6" />
                </svg>
              </div>
              <h3 className="feature-card-title">Semantic Smart Search</h3>
              <p className="feature-card-description">
                Use built-in query processing to filter contacts by tags, notes, name, or company title. Find anyone instantly in your network.
              </p>
            </div>
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
