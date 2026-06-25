import { useState, useEffect, useRef, type MouseEvent } from 'react'
import sdnLogo from './assets/sdn-logo.svg'
import TiltContainer from './components/TiltContainer'

export default function LandingPage() {
  const [activeStep, setActiveStep] = useState(0)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success'>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)

  const handleLaunchApp = (e: MouseEvent) => {
    e.preventDefault()
    window.location.hash = '#board'
  }

  const handleDocs = (e: MouseEvent) => {
    e.preventDefault()
    window.location.hash = '#docs'
  }

  // Setup scroll observer for scrollytelling steps
  useEffect(() => {
    const steps = document.querySelectorAll('.scrolly-step')
    const observerOptions = {
      root: null, // viewport
      rootMargin: '-30% 0px -40% 0px', // center third of viewport
      threshold: 0.1,
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const index = Number(entry.target.getAttribute('data-step-idx'))
          if (!isNaN(index)) {
            setActiveStep(index)
          }
        }
      })
    }, observerOptions)

    steps.forEach((step) => observer.observe(step))

    return () => {
      steps.forEach((step) => observer.unobserve(step))
    }
  }, [])

  // Simulate file upload progress
  useEffect(() => {
    if (uploadStatus !== 'uploading') return

    const timer = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer)
          setUploadStatus('success')
          return 100
        }
        return prev + 5
      })
    }, 60)

    return () => clearInterval(timer)
  }, [uploadStatus])

  const triggerUploadDemo = () => {
    if (uploadStatus !== 'idle') return
    setUploadProgress(0)
    setUploadStatus('uploading')
  }

  const resetUploadDemo = (e: MouseEvent) => {
    e.stopPropagation()
    setUploadStatus('idle')
    setUploadProgress(0)
  }

  // Handle magnetic grid glow on mouse movement for feature cards
  const featureGridRef = useRef<HTMLDivElement | null>(null)
  
  const handleFeatureMouseMove = (e: React.MouseEvent) => {
    if (!featureGridRef.current) return
    const cards = featureGridRef.current.getElementsByClassName('feature-card')
    for (let i = 0; i < cards.length; i++) {
      const card = cards[i] as HTMLDivElement
      const rect = card.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      card.style.setProperty('--mouse-x', `${x}px`)
      card.style.setProperty('--mouse-y', `${y}px`)
    }
  }

  return (
    <div className="landing-container">
      {/* Background Radial Glow Orbs */}
      <div className="landing-bg-glows" aria-hidden="true">
        <div className="bg-glow-orb orb-top-right" />
        <div className="bg-glow-orb orb-bottom-left" />
        <div className="bg-glow-orb orb-center-right" />
      </div>

      {/* Header & Sticky Glass Navigation */}
      <header className="landing-header">
        <nav className="landing-nav">
          <a href="#" className="landing-logo" onClick={(e) => e.preventDefault()}>
            <img className="landing-logo-mark" src={sdnLogo} alt="" aria-hidden="true" />
            <span className="landing-logo-text">Social Datanode</span>
          </a>
          <div className="landing-nav-actions">
            <button className="lp-btn lp-btn-outlined" onClick={handleDocs}>
              Docs
            </button>
            <button className="lp-btn lp-btn-filled" onClick={handleLaunchApp}>
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
              Visualize, cluster, and explore your personal and professional networks on an interactive, infinite canvas. Build your private, AI-enriched social graph.
            </p>
            <div className="hero-ctas">
              <button className="lp-btn lp-btn-filled" style={{ height: '48px', padding: '0 32px', fontSize: '15px' }} onClick={handleLaunchApp}>
                Launch App
              </button>
              <button className="lp-btn lp-btn-outlined" style={{ height: '48px', padding: '0 32px', fontSize: '15px' }} onClick={handleDocs}>
                Read Docs
              </button>
            </div>
          </div>

          <div className="hero-visual">
            <TiltContainer>
              <div className="stage-wrapper stage-step-2">
                <svg className="stage-svg" viewBox="0 0 480 480">
                  {/* Subtle ambient connections */}
                  <line x1="240" y1="240" x2="160" y2="150" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
                  <line x1="240" y1="240" x2="340" y2="160" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
                  <line x1="240" y1="240" x2="360" y2="320" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
                  <line x1="240" y1="240" x2="140" y2="340" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />

                  {/* Circle clusters */}
                  <circle cx="160" cy="150" r="70" fill="rgba(139, 92, 246, 0.04)" stroke="rgba(139, 92, 246, 0.25)" strokeWidth="1.5" />
                  <circle cx="340" cy="160" r="65" fill="rgba(99, 102, 241, 0.04)" stroke="rgba(99, 102, 241, 0.25)" strokeWidth="1.5" />
                  <circle cx="360" cy="320" r="60" fill="rgba(0, 242, 254, 0.03)" stroke="rgba(0, 242, 254, 0.2)" strokeWidth="1.5" />
                  
                  {/* Outer nodes */}
                  <circle cx="130" cy="120" r="16" fill="rgba(139, 92, 246, 0.15)" stroke="#8b5cf6" strokeWidth="2" />
                  <circle cx="190" cy="170" r="16" fill="rgba(139, 92, 246, 0.15)" stroke="#8b5cf6" strokeWidth="2" />
                  <circle cx="320" cy="130" r="14" fill="rgba(99, 102, 241, 0.15)" stroke="#6366f1" strokeWidth="2" />
                  <circle cx="370" cy="180" r="14" fill="rgba(99, 102, 241, 0.15)" stroke="#6366f1" strokeWidth="2" />
                  <circle cx="380" cy="300" r="12" fill="rgba(0, 242, 254, 0.12)" stroke="#00f2fe" strokeWidth="2" />
                  <circle cx="330" cy="340" r="12" fill="rgba(0, 242, 254, 0.12)" stroke="#00f2fe" strokeWidth="2" />

                  {/* Main Node */}
                  <circle cx="240" cy="240" r="28" fill="rgba(139, 92, 246, 0.25)" stroke="#8b5cf6" strokeWidth="2" />
                  <text x="240" y="244" fill="#ffffff" fontSize="10" fontWeight="700" textAnchor="middle">You</text>
                </svg>
              </div>
            </TiltContainer>
          </div>
        </section>

        {/* Split-Screen Scrollytelling Section */}
        <section className="landing-section scrollytelling-section">
          <div className="scrollytelling-container">
            
            {/* Left side: scrolling info text */}
            <div className="scrolly-text-col">
              
              <div className="scrolly-step" data-step-idx="0">
                <span className="scrolly-step-number">Phase 01</span>
                <h2 className="scrolly-step-title">The Central Anchor</h2>
                <p className="scrolly-step-desc">
                  Every relationship map begins with you. A clean, central anchor node acts as the origin point of your social universe, ready to expand fluidly in any direction.
                </p>
              </div>

              <div className="scrolly-step" data-step-idx="1">
                <span className="scrolly-step-number">Phase 02</span>
                <h2 className="scrolly-step-title">Frictionless Connection</h2>
                <p className="scrolly-step-desc">
                  Grow your graph with natural, fluid gestures. Simply drag out a link from any circle and release the cursor to instantly spawn a new connected person, keeping workflow uninterrupted by buttons or menus.
                </p>
              </div>

              <div className="scrolly-step" data-step-idx="2">
                <span className="scrolly-step-number">Phase 03</span>
                <h2 className="scrolly-step-title">Automatic LinkedIn Sync</h2>
                <p className="scrolly-step-desc">
                  Don't map manually. Import your LinkedIn connections ZIP file, and let Datanode automatically analyze, cluster, and pack contacts into elegant sunflower spirals nested inside boundary circles.
                </p>
              </div>

              <div className="scrolly-step" data-step-idx="3">
                <span className="scrolly-step-number">Phase 04</span>
                <h2 className="scrolly-step-title">AI Enrichment & Insights</h2>
                <p className="scrolly-step-desc">
                  Add custom tags and private notes to any contact. Use semantic smart searches to query and filter through your entire board, or let the built-in AI summarize interactions.
                </p>
              </div>

            </div>

            {/* Right side: sticky visual stage */}
            <div className="scrolly-visual-col">
              <div className={`stage-wrapper stage-step-${activeStep}`}>
                <svg className="stage-svg" viewBox="0 0 480 480">
                  
                  {/* --- Connection Lines --- */}
                  {/* Center to Top-Left */}
                  <line x1="240" y1="240" x2="160" y2="150" className="scrolly-link link-branch link-cluster" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
                  {/* Center to Top-Right */}
                  <line x1="240" y1="240" x2="340" y2="160" className="scrolly-link link-branch link-cluster" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
                  {/* Center to Bottom-Right */}
                  <line x1="240" y1="240" x2="360" y2="320" className="scrolly-link link-branch link-cluster" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
                  {/* Center to Bottom-Left (Drag simulate line) */}
                  <line x1="240" y1="240" x2="110" y2="350" className="scrolly-link link-drag-target" stroke="#8b5cf6" strokeWidth="2" />
                  
                  {/* --- Clusters Circles (LinkedIn) --- */}
                  <circle cx="160" cy="150" r="72" className="scrolly-circle circle-violet" fill="rgba(139, 92, 246, 0.04)" stroke="rgba(139, 92, 246, 0.25)" strokeWidth="1.5" />
                  <circle cx="340" cy="160" r="68" className="scrolly-circle circle-indigo" fill="rgba(99, 102, 241, 0.04)" stroke="rgba(99, 102, 241, 0.25)" strokeWidth="1.5" />
                  <circle cx="360" cy="320" r="62" className="scrolly-circle circle-cyan" fill="rgba(0, 242, 254, 0.03)" stroke="rgba(0, 242, 254, 0.2)" strokeWidth="1.5" />
                  
                  {/* --- Nodes --- */}
                  {/* Top-Left Cluster Nodes */}
                  <circle cx="130" cy="120" r="16" className="scrolly-node node-cluster" fill="rgba(139, 92, 246, 0.15)" stroke="#8b5cf6" strokeWidth="2" />
                  <circle cx="190" cy="170" r="16" className="scrolly-node node-cluster node-ai-highlight" fill="rgba(139, 92, 246, 0.15)" stroke="#8b5cf6" strokeWidth="2" />
                  
                  {/* Top-Right Cluster Nodes */}
                  <circle cx="320" cy="130" r="14" className="scrolly-node node-cluster" fill="rgba(99, 102, 241, 0.15)" stroke="#6366f1" strokeWidth="2" />
                  <circle cx="370" cy="180" r="14" className="scrolly-node node-cluster" fill="rgba(99, 102, 241, 0.15)" stroke="#6366f1" strokeWidth="2" />

                  {/* Bottom-Right Cluster Nodes */}
                  <circle cx="380" cy="300" r="12" className="scrolly-node node-cluster" fill="rgba(0, 242, 254, 0.12)" stroke="#00f2fe" strokeWidth="2" />
                  <circle cx="330" cy="340" r="12" className="scrolly-node node-cluster" fill="rgba(0, 242, 254, 0.12)" stroke="#00f2fe" strokeWidth="2" />

                  {/* Static Branching Nodes (Step 1) */}
                  <circle cx="160" cy="150" r="18" className="scrolly-node node-branch" fill="rgba(99, 102, 241, 0.18)" stroke="#6366f1" strokeWidth="2" />
                  <circle cx="340" cy="160" r="18" className="scrolly-node node-branch" fill="rgba(99, 102, 241, 0.18)" stroke="#6366f1" strokeWidth="2" />
                  <circle cx="360" cy="320" r="18" className="scrolly-node node-branch" fill="rgba(99, 102, 241, 0.18)" stroke="#6366f1" strokeWidth="2" />

                  {/* Drag target Node (Step 1) */}
                  <circle cx="110" cy="350" r="18" className="scrolly-node node-drag-target" fill="rgba(139, 92, 246, 0.25)" stroke="#8b5cf6" strokeWidth="2" />

                  {/* Central Node (Always Visible) */}
                  <circle cx="240" cy="240" r="28" className="scrolly-node node-you" fill="rgba(139, 92, 246, 0.25)" stroke="#8b5cf6" strokeWidth="2" />
                  <text x="240" y="244" className="scrolly-node node-you" fill="#ffffff" fontSize="10" fontWeight="700" textAnchor="middle">You</text>

                  {/* Cursor Indicator (Step 1 connection drag) */}
                  <g className="scrolly-cursor">
                    <polygon points="0,0 6,18 10,13 18,17" fill="#ffffff" stroke="#000000" strokeWidth="1.5" />
                  </g>
                </svg>

                {/* Floating AI Details Tooltip (Step 3) */}
                <div className="scrolly-tooltip-ai" style={{ position: 'absolute', top: '240px', left: '20px' }}>
                  <div className="ai-tooltip-box">
                    <div className="ai-tooltip-header">Alice Chen</div>
                    <div className="ai-tooltip-note">"Met at WebConf, discussed Supabase integrations. Follow up next month."</div>
                    <div className="tooltip-tags" style={{ marginTop: '6px' }}>
                      <span className="tooltip-tag tooltip-tag-accent" style={{ fontSize: '9px', padding: '1px 5px' }}>Partner</span>
                      <span className="tooltip-tag" style={{ fontSize: '9px', padding: '1px 5px' }}>FollowUp</span>
                    </div>
                  </div>
                </div>

              </div>
            </div>

          </div>
        </section>

        {/* Interactive LinkedIn Upload Simulator Showcase */}
        <section className="landing-section import-showcase-section">
          <div className="import-showcase-container">
            <div className="import-showcase-text">
              <h2 className="section-title" style={{ textAlign: 'left' }}>
                Instant LinkedIn Sync
              </h2>
              <p className="hero-description">
                Don't start from scratch. Export your network details from LinkedIn, drop them in, and see your entire flat contact history convert into a gorgeous visual dashboard instantly.
              </p>
              <button className="lp-btn lp-btn-outlined" onClick={handleLaunchApp}>
                Try Live Sync
              </button>
            </div>

            <div className="import-showcase-visual">
              <div className="import-widget-card">
                {uploadStatus === 'idle' && (
                  <div className="import-dropzone" onClick={triggerUploadDemo}>
                    <div className="dropzone-icon">
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                      </svg>
                    </div>
                    <div className="dropzone-text-primary">Simulate importing connections</div>
                    <div className="dropzone-text-secondary">Click here to test the upload animation</div>
                  </div>
                )}

                {uploadStatus === 'uploading' && (
                  <div className="upload-progress-card">
                    <div className="upload-progress-container">
                      <div className="progress-header">
                        <span className="progress-filename">linkedin_connections.zip</span>
                        <span className="progress-pct">{uploadProgress}%</span>
                      </div>
                      <div className="progress-bar-bg">
                        <div className="progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
                      </div>
                      <div className="dropzone-text-secondary" style={{ marginTop: '4px' }}>
                        Parsing profile records, clustering companies...
                      </div>
                    </div>
                  </div>
                )}

                {uploadStatus === 'success' && (
                  <div className="upload-success-card" style={{ textAlign: 'center' }}>
                    <div className="dropzone-icon" style={{ background: 'rgba(0, 242, 254, 0.12)', color: '#00f2fe', margin: '0 auto 16px' }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div className="dropzone-text-primary">Import simulation complete!</div>
                    <div className="progress-success-msg">
                      Imported 2,418 connections across 54 companies.
                    </div>
                    <button className="lp-btn lp-btn-text" style={{ marginTop: '16px', height: '32px', padding: '0 16px', fontSize: '12px' }} onClick={resetUploadDemo}>
                      Reset Demo
                    </button>
                  </div>
                )}
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

          <div className="features-grid" ref={featureGridRef} onMouseMove={handleFeatureMouseMove}>
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
            <button className="lp-btn lp-btn-filled" style={{ height: '52px', padding: '0 36px', fontSize: '15px' }} onClick={handleLaunchApp}>
              Launch Board
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <a href="#" className="footer-logo" onClick={(e) => e.preventDefault()}>
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
