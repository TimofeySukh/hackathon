import { type MouseEvent } from 'react'

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
      {/* Background Blobs */}
      <div className="landing-bg-blobs" aria-hidden="true">
        <div className="landing-blob landing-blob-1" />
        <div className="landing-blob landing-blob-2" />
        <div className="landing-blob landing-blob-3" />
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
        <section className="landing-section hero-section">
          <div className="hero-content">
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

          <div className="hero-illustration">
            {/* Custom Interactive SVG Social Graph */}
            <svg className="social-graph-svg" viewBox="0 0 500 500" width="500" height="500">
              {/* Orbits */}
              <circle className="orbit-line orbit-1" cx="250" cy="250" r="80" />
              <circle className="orbit-line orbit-2" cx="250" cy="250" r="150" />
              <circle className="orbit-line orbit-3" cx="250" cy="250" r="210" />

              {/* Orbiting Groups/Nodes - Grouped in rotating SVG elements */}
              
              {/* Inner Orbit (80px radius) */}
              <g className="orbit-1" style={{ transformOrigin: '250px 250px' }}>
                {/* Node 1: Blue */}
                <line className="connection-line" x1="250" y1="250" x2="250" y2="170" stroke="var(--md-tone-blue)" />
                <g className="social-node" style={{ transform: 'translate(250px, 170px)' }}>
                  <circle className="social-node-pulse" r="22" fill="var(--md-primary-container)" opacity="0.4" />
                  <circle r="16" fill="var(--md-primary-container)" stroke="var(--md-primary)" strokeWidth="1.5" />
                  <text className="social-node-label" y="4" fontSize="10">ME</text>
                </g>

                {/* Node 2: Green */}
                <line className="connection-line" x1="250" y1="250" x2="330" y2="250" stroke="var(--md-tone-green)" />
                <g className="social-node" style={{ transform: 'translate(330px, 250px)' }}>
                  <circle r="14" fill="#d1e8d2" stroke="var(--md-tone-green)" strokeWidth="1.5" />
                  <text className="social-node-label" y="4" fontSize="10">Dev</text>
                </g>
              </g>

              {/* Middle Orbit (150px radius) */}
              <g className="orbit-2" style={{ transformOrigin: '250px 250px' }}>
                {/* Node 3: Amber */}
                <line className="connection-line" x1="250" y1="250" x2="144" y2="144" stroke="var(--md-tone-amber)" />
                <g className="social-node" style={{ transform: 'translate(144px, 144px)' }}>
                  <circle r="16" fill="#ffe082" stroke="var(--md-tone-amber)" strokeWidth="1.5" />
                  <text className="social-node-label" y="4" fontSize="10">PM</text>
                </g>

                {/* Node 4: Violet */}
                <line className="connection-line" x1="250" y1="250" x2="356" y2="356" stroke="var(--md-tone-violet)" />
                <g className="social-node" style={{ transform: 'translate(356px, 356px)' }}>
                  <circle r="18" fill="#eaddff" stroke="var(--md-tone-violet)" strokeWidth="1.5" />
                  <text className="social-node-label" y="4" fontSize="10">Design</text>
                </g>

                {/* Node 5: Red */}
                <line className="connection-line" x1="250" y1="250" x2="100" y2="250" stroke="var(--md-tone-red)" />
                <g className="social-node" style={{ transform: 'translate(100px, 250px)' }}>
                  <circle r="14" fill="#ffdad6" stroke="var(--md-tone-red)" strokeWidth="1.5" />
                  <text className="social-node-label" y="4" fontSize="10">HR</text>
                </g>
              </g>

              {/* Outer Orbit (210px radius) */}
              <g className="orbit-3" style={{ transformOrigin: '250px 250px' }}>
                {/* Connections between nodes on outer and middle orbits to simulate a network */}
                <line className="connection-line" x1="250" y1="40" x2="250" y2="250" stroke="var(--md-outline-variant)" />
                <line className="connection-line" x1="432" y1="145" x2="330" y2="250" stroke="var(--md-outline-variant)" />
                <line className="connection-line" x1="68" y1="355" x2="100" y2="250" stroke="var(--md-outline-variant)" />

                {/* Node 6: Blue */}
                <g className="social-node" style={{ transform: 'translate(250px, 40px)' }}>
                  <circle className="social-node-glow" r="18" fill="var(--md-primary-container)" />
                  <circle r="16" fill="var(--md-primary-container)" stroke="var(--md-primary)" strokeWidth="1.5" />
                  <text className="social-node-label" y="4" fontSize="9">Partner</text>
                </g>

                {/* Node 7: Violet */}
                <g className="social-node" style={{ transform: 'translate(432px, 145px)' }}>
                  <circle r="15" fill="#eaddff" stroke="var(--md-tone-violet)" strokeWidth="1.5" />
                  <text className="social-node-label" y="4" fontSize="9">User</text>
                </g>

                {/* Node 8: Green */}
                <g className="social-node" style={{ transform: 'translate(68px, 355px)' }}>
                  <circle r="15" fill="#d1e8d2" stroke="var(--md-tone-green)" strokeWidth="1.5" />
                  <text className="social-node-label" y="4" fontSize="9">QA</text>
                </g>

                {/* Node 9: Amber */}
                <g className="social-node" style={{ transform: 'translate(398px, 398px)' }}>
                  <circle r="14" fill="#ffe082" stroke="var(--md-tone-amber)" strokeWidth="1.5" />
                  <text className="social-node-label" y="4" fontSize="9">Sales</text>
                </g>
              </g>

              {/* Central Active Node */}
              <g className="social-node" style={{ transform: 'translate(250px, 250px)' }}>
                <circle className="social-node-pulse" r="42" fill="var(--md-primary-container)" opacity="0.3" />
                <circle r="26" fill="var(--md-primary)" />
                <circle r="10" fill="var(--md-on-primary)" />
              </g>
            </svg>
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
