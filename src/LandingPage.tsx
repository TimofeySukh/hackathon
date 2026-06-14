import { type MouseEvent } from 'react'
import { getNodePath } from './lib/board/geometry'

interface LandingPageProps {
  onLaunchApp: () => void
}

export default function LandingPage({ onLaunchApp }: LandingPageProps) {
  const handleLiveDemo = (e: MouseEvent) => {
    e.preventDefault()
    window.open('https://social.datanode.live/', '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="landing-container">
      {/* Background Flowers peaking from edges */}
      <div className="landing-bg-flowers" aria-hidden="true">
        {/* Shape 1: Top Right - Rounded Octagon */}
        <div className="landing-flower-wrap flower-top-right">
          <svg viewBox="0 0 200 200" width="100%" height="100%">
            <defs>
              <linearGradient id="shape-grad-1" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--md-tone-violet)" />
                <stop offset="100%" stopColor="var(--md-primary)" />
              </linearGradient>
            </defs>
            <path
              d={getNodePath(100, 100, 80, 'polygon', 8, 14)}
              fill="url(#shape-grad-1)"
              opacity="0.25"
            />
          </svg>
        </div>

        {/* Shape 2: Bottom Left - Rounded Pentagon */}
        <div className="landing-flower-wrap flower-bottom-left">
          <svg viewBox="0 0 200 200" width="100%" height="100%">
            <defs>
              <linearGradient id="shape-grad-2" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--md-tone-green)" />
                <stop offset="100%" stopColor="var(--md-primary)" />
              </linearGradient>
            </defs>
            <path
              d={getNodePath(100, 100, 80, 'polygon', 5, 12)}
              fill="url(#shape-grad-2)"
              opacity="0.22"
            />
          </svg>
        </div>

        {/* Shape 3: Right Center - Rounded Hexagon */}
        <div className="landing-flower-wrap flower-right-center">
          <svg viewBox="0 0 200 200" width="100%" height="100%">
            <defs>
              <linearGradient id="shape-grad-3" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--md-tone-amber)" />
                <stop offset="100%" stopColor="var(--md-tone-red)" />
              </linearGradient>
            </defs>
            <path
              d={getNodePath(100, 100, 75, 'polygon', 6, 10)}
              fill="url(#shape-grad-3)"
              opacity="0.18"
            />
          </svg>
        </div>
      </div>

      {/* Header / Navigation */}
      <header className="landing-header">
        <nav className="landing-nav">
          <a href="#" className="landing-logo" onClick={(e) => e.preventDefault()}>
            <div className="landing-logo-mark" />
            <span className="landing-logo-text">Social Datanode</span>
          </a>
          <div className="landing-nav-actions">
            <button className="m3-btn m3-btn-text" onClick={handleLiveDemo}>
              Live Demo
            </button>
            <button className="m3-btn m3-btn-filled" onClick={onLaunchApp}>
              Launch App
            </button>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main className="landing-main">
        {/* Hero Section */}
        <section className="landing-section hero-section hero-section-centered">
          <div className="hero-content hero-content-centered">
            <span className="hero-tagline">Spatial Relationship Mapping</span>
            <h1 className="hero-title">
              Map your social universe.
            </h1>
            <p className="hero-description">
              Visualize, structure, and explore your personal and professional networks on an interactive, infinite canvas. Build your social graph, your way.
            </p>
            <div className="hero-ctas">
              <button className="m3-btn m3-btn-filled" style={{ height: '48px', padding: '0 32px' }} onClick={onLaunchApp}>
                Start Mapping — Free
              </button>
              <button className="m3-btn m3-btn-outlined" style={{ height: '48px', padding: '0 32px' }} onClick={handleLiveDemo}>
                View Live Demo
              </button>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="landing-section workflow-section">
          <div className="section-header">
            <h2 className="section-title">How Social Datanode Works</h2>
            <p className="section-subtitle">
              Map and manage your network in three simple, frictionless steps.
            </p>
          </div>

          <div className="workflow-steps">
            <div className="workflow-step">
              <div className="workflow-num">01</div>
              <h3 className="workflow-title">Create & Group</h3>
              <p className="workflow-desc">
                Start from your own node. Double-tap to create new people, right-click to build visual boundary circles, and drag people into subsets to organize them logically.
              </p>
            </div>
            <div className="workflow-step">
              <div className="workflow-num">02</div>
              <h3 className="workflow-title">Import LinkedIn</h3>
              <p className="workflow-desc">
                Upload your LinkedIn Connections ZIP archive. The system automatically extracts connections, clusters them, and supports Bright Data single-profile details enrichment.
              </p>
            </div>
            <div className="workflow-step">
              <div className="workflow-num">03</div>
              <h3 className="workflow-title">Enrich with AI</h3>
              <p className="workflow-desc">
                Add private tags and notes. Let the built-in AI summarize interactions, generate networking insights, and perform semantic searches across your board.
              </p>
            </div>
          </div>
        </section>

        {/* Feature Grid Section */}
        <section className="landing-section features-section">
          <div className="section-header">
            <h2 className="section-title">Core Features</h2>
            <p className="section-subtitle">
              Designed from the ground up for privacy, fluid movement, and intelligent networking.
            </p>
          </div>

          <div className="features-grid">
            {/* Feature 1 */}
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="4" />
                  <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                </svg>
              </div>
              <h3 className="feature-card-title">Infinite Spatial Canvas</h3>
              <p className="feature-card-description">
                Pan, zoom, and grow your graph seamlessly. The layout automatically expands and adjusts bounds to fit nested subsets and people.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <h3 className="feature-card-title">LinkedIn Connection Sync</h3>
              <p className="feature-card-description">
                Easily transition from flat tables to a spatial relationship dashboard. Import your networking history in seconds.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                  <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                  <line x1="12" y1="22.08" x2="12" y2="12" />
                </svg>
              </div>
              <h3 className="feature-card-title">Supabase Cloud Sync</h3>
              <p className="feature-card-description">
                Autosave details with debounced cloud persistence, backed by Google OAuth, or work locally via anonymous offline storage.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="feature-card">
              <div className="feature-icon-wrapper">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  <path d="M8 11h6M11 8v6" />
                </svg>
              </div>
              <h3 className="feature-card-title">AI note summarization</h3>
              <p className="feature-card-description">
                Let LLMs analyze tags and profile notes to create brief, actionable interaction summaries and execute semantic searches.
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
            <button className="m3-btn m3-btn-filled" style={{ height: '48px', padding: '0 32px' }} onClick={onLaunchApp}>
              Launch Social Datanode
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <a href="#" className="footer-logo" onClick={(e) => e.preventDefault()}>
            <div className="landing-logo-mark" style={{ width: '24px', height: '24px' }} />
            <span>Social Datanode</span>
          </a>
          <span className="footer-copyright">
            &copy; {new Date().getFullYear()} Social Datanode. All rights reserved.
          </span>
        </div>
      </footer>
    </div>
  )
}
