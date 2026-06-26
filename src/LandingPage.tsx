import { useState, type MouseEvent, type ChangeEvent, type FormEvent } from 'react'
import sdnLogo from './assets/sdn-logo.svg'
import linkedinIcon from './assets/brands/linkedin.svg'
import telegramIcon from './assets/brands/telegram.svg'
import websiteIcon from './assets/brands/website.svg'
import { SelectionIndicator } from './components/SelectionIndicator'

interface LandingPageProps {
  onLogin: () => void
  onSignUp: () => void
  isAuthenticated: boolean
}

export default function LandingPage({ onLogin, onSignUp, isAuthenticated }: LandingPageProps) {
  // Interactive Inspector Simulator local state
  const [demoName, setDemoName] = useState('Alice Chen')
  const [demoZone, setDemoZone] = useState<'Anthropic' | 'Google' | 'OpenAI'>('Anthropic')
  const [demoAvatar, setDemoAvatar] = useState<'initials' | 'timofey' | 'velizar'>('initials')
  const [demoNotes, setDemoNotes] = useState<string[]>([
    'Met at WebConf, discussed Supabase integrations.',
    'Follow up next month to sync on APIs.'
  ])
  const [newNoteText, setNewNoteText] = useState('')

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
  }

  const handleCycleDemoAvatar = () => {
    if (demoAvatar === 'initials') {
      setDemoAvatar('timofey')
    } else if (demoAvatar === 'timofey') {
      setDemoAvatar('velizar')
    } else {
      setDemoAvatar('initials')
    }
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
              <div className="demo-field-group">
                <span className="demo-field-label">Person Name</span>
                <input
                  type="text"
                  className="demo-name-input"
                  value={demoName}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setDemoName(e.target.value)}
                  placeholder="Enter name..."
                />
              </div>

              <div className="demo-field-group">
                <span className="demo-field-label">Zone Selector</span>
                <div className="demo-zone-selector">
                  {(['Anthropic', 'Google', 'OpenAI'] as const).map((z) => (
                    <button
                      key={z}
                      type="button"
                      className={`demo-zone-btn ${demoZone === z ? 'is-active' : ''}`}
                      data-ind-key={z}
                      onClick={() => setDemoZone(z)}
                    >
                      {z}
                    </button>
                  ))}
                  <SelectionIndicator activeKey={demoZone} variant="pill" />
                </div>
              </div>

              <div className="demo-field-group">
                <span className="demo-field-label">Photo/Avatar</span>
                <div className="demo-avatar-row">
                  <div className="demo-avatar-circle" onClick={handleCycleDemoAvatar} title="Click to cycle avatar">
                    {demoAvatar === 'timofey' ? (
                      <img src="/timofey_avatar.jpeg" alt="Avatar" />
                    ) : demoAvatar === 'velizar' ? (
                      <img src="/velizar_avatar.jpeg" alt="Avatar" />
                    ) : (
                      <span>{demoName ? demoName.charAt(0).toUpperCase() : 'A'}</span>
                    )}
                  </div>
                  <span className="demo-avatar-text" onClick={handleCycleDemoAvatar}>
                    Cycle mock picture
                  </span>
                </div>
              </div>

              <div className="demo-field-group">
                <span className="demo-field-label">Connections</span>
                <div className="demo-connections-chips">
                  <div className="demo-connection-chip">
                    <img className="demo-connection-chip-brand" src={linkedinIcon} alt="" />
                    <span>LinkedIn Profile</span>
                  </div>
                  <div className="demo-connection-chip">
                    <img className="demo-connection-chip-brand" src={telegramIcon} alt="" />
                    <span>Telegram Chat</span>
                  </div>
                  <div className="demo-connection-chip">
                    <img className="demo-connection-chip-brand" src={websiteIcon} alt="" />
                    <span>Personal Blog</span>
                  </div>
                </div>
              </div>

              <div className="demo-field-group">
                <span className="demo-field-label">Notes</span>
                <div className="demo-notes-container">
                  {demoNotes.map((note, index) => (
                    <div key={index} className="demo-note-item">
                      {note}
                    </div>
                  ))}
                  <form onSubmit={handleAddDemoNote} className="demo-note-input-row">
                    <input
                      type="text"
                      className="demo-note-input"
                      value={newNoteText}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => setNewNoteText(e.target.value)}
                      placeholder="Add a simulated note..."
                    />
                    <button type="submit" className="demo-note-btn" aria-label="Add note">
                      +
                    </button>
                  </form>
                </div>
              </div>
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
