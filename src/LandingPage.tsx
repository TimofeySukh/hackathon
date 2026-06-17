import { useState, useEffect, type MouseEvent, type CSSProperties } from 'react'



interface GraphNode {
  id: string
  name: string
  x: number
  y: number
  r: number
  fill: string
  stroke: string
  glow: string
  title: string
  desc: string
  tags: string[]
}

const NODES: GraphNode[] = [
  {
    id: 'you',
    name: 'You',
    x: 240,
    y: 240,
    r: 32,
    fill: 'var(--lp-primary)',
    stroke: '#00629d',
    glow: 'rgba(0, 98, 157, 0.2)',
    title: 'Your Central Node',
    desc: 'The anchor of your social graph. All your circles branch from here.',
    tags: ['Owner', 'Workspace'],
  },
  {
    id: 'team',
    name: 'Team',
    x: 110,
    y: 130,
    r: 25,
    fill: 'var(--md-tone-green)',
    stroke: '#1e824a',
    glow: 'rgba(30, 130, 74, 0.18)',
    title: 'Engineering Team',
    desc: 'Developers, designers, and product managers working on the core platform.',
    tags: ['Colleagues', 'Active'],
  },
  {
    id: 'vcs',
    name: 'VCs',
    x: 370,
    y: 110,
    r: 25,
    fill: 'var(--md-tone-blue)',
    stroke: '#00629d',
    glow: 'rgba(0, 98, 157, 0.18)',
    title: 'Investors & Advisors',
    desc: 'Venture partners, angel syndicates, and mentors providing funding and guidance.',
    tags: ['Advisors', 'High Value'],
  },
  {
    id: 'partners',
    name: 'Partners',
    x: 390,
    y: 350,
    r: 25,
    fill: 'var(--md-tone-violet)',
    stroke: '#7f67be',
    glow: 'rgba(127, 103, 190, 0.18)',
    title: 'Strategic Partners',
    desc: 'Integration, marketing, and channel alliance executives driving growth.',
    tags: ['Contracts', 'External'],
  },
  {
    id: 'leads',
    name: 'Leads',
    x: 110,
    y: 350,
    r: 25,
    fill: 'var(--md-tone-amber)',
    stroke: '#d87a00',
    glow: 'rgba(216, 122, 0, 0.18)',
    title: 'Sales Prospects',
    desc: 'Enterprise accounts and contacts currently in the sales pipeline.',
    tags: ['Outreach', 'Enriched'],
  },
]

const CONNECTIONS = [
  { from: 'you', to: 'team', color: 'var(--md-tone-green)' },
  { from: 'you', to: 'vcs', color: 'var(--md-tone-blue)' },
  { from: 'you', to: 'partners', color: 'var(--md-tone-violet)' },
  { from: 'you', to: 'leads', color: 'var(--md-tone-amber)' },
  { from: 'team', to: 'leads', color: 'rgba(0,0,0,0.05)' },
  { from: 'partners', to: 'vcs', color: 'rgba(0,0,0,0.05)' },
]

export default function LandingPage() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success'>('idle')
  const [uploadProgress, setUploadProgress] = useState(0)

  const handleLiveDemo = (e: MouseEvent) => {
    e.preventDefault()
    window.open('https://social.datanode.live/', '_blank', 'noopener,noreferrer')
  }

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

  const isConnectionActive = (fromId: string, toId: string) => {
    if (!hoveredNode) return false
    return fromId === hoveredNode || toId === hoveredNode
  }

  const activeNodeInfo = NODES.find((n) => n.id === hoveredNode) || NODES[0]

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
            <div className="landing-logo-mark" />
            <span className="landing-logo-text">Social Datanode</span>
          </a>
          <div className="landing-nav-actions">
            <button className="lp-btn lp-btn-filled" onClick={handleLiveDemo}>
              View Demo
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
              Visualize, cluster, and explore your personal and professional networks on an interactive, infinite canvas. Build your private social graph.
            </p>
            <div className="hero-ctas">
              <button className="lp-btn lp-btn-filled" style={{ height: '48px', padding: '0 32px', fontSize: '15px' }} onClick={handleLiveDemo}>
                View Demo
              </button>
            </div>
          </div>

          <div className="hero-visual">
            <div className="interactive-graph-container">
              <svg className="social-graph-svg" viewBox="0 0 480 480">
                {/* Connection Lines */}
                {CONNECTIONS.map((conn, idx) => {
                  const fromNode = NODES.find((n) => n.id === conn.from)!
                  const toNode = NODES.find((n) => n.id === conn.to)!
                  const isActive = isConnectionActive(conn.from, conn.to)
                  return (
                    <line
                      key={idx}
                      x1={fromNode.x}
                      y1={fromNode.y}
                      x2={toNode.x}
                      y2={toNode.y}
                      className={`connection-path ${isActive ? 'active' : ''}`}
                      style={{
                        '--active-stroke': hoveredNode
                          ? NODES.find((n) => n.id === hoveredNode)!.stroke
                          : '#a78bfa',
                      } as CSSProperties}
                    />
                  )
                })}

                {/* Nodes */}
                {NODES.map((node) => (
                  <g
                    key={node.id}
                    className="node-group"
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                    style={{
                      transformOrigin: `${node.x}px ${node.y}px`,
                    }}
                  >
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={node.r}
                      className="node-circle"
                      style={{
                        '--node-fill': node.fill,
                        '--node-stroke': node.stroke,
                        '--node-glow': node.glow,
                        '--node-glow-strong': node.glow.replace('0.4', '0.7').replace('0.35', '0.65'),
                      } as CSSProperties}
                    />
                    <text x={node.x} y={node.y} className="node-text">
                      {node.name}
                    </text>
                  </g>
                ))}
              </svg>

              {/* Hover Metadata Glassmorphic Card */}
              <div className={`graph-tooltip ${hoveredNode ? 'visible' : ''}`}>
                <div className="tooltip-title">{activeNodeInfo.title}</div>
                <div className="tooltip-desc">{activeNodeInfo.desc}</div>
                <div className="tooltip-tags">
                  {activeNodeInfo.tags.map((tag, i) => (
                    <span key={i} className={`tooltip-tag ${i === 0 ? 'tooltip-tag-accent' : ''}`}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="landing-section workflow-section">
          <div className="section-header">
            <h2 className="section-title">How It Works</h2>
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
                Upload your LinkedIn Connections ZIP archive. The system automatically extracts connections, clusters them, and builds company-based groups in seconds.
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
              <button className="lp-btn lp-btn-outlined" onClick={handleLiveDemo}>
                View Demo
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
                    <div className="dropzone-icon" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', margin: '0 auto 16px' }}>
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
            <button className="lp-btn lp-btn-filled" style={{ height: '52px', padding: '0 36px', fontSize: '15px' }} onClick={handleLiveDemo}>
              View Demo
            </button>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <a href="#" className="footer-logo" onClick={(e) => e.preventDefault()}>
            <div className="footer-logo-mark" />
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
