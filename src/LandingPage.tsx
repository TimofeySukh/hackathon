import { Fragment, type MouseEvent } from 'react'
import sdnLogo from './assets/sdn-logo.svg'
import productBoardInspector from './assets/landing/product-board-inspector.png'

const BOARD_ONBOARDING_FORCE_KEY = 'social-board-onboarding-open-v3'

const HOW_IT_WORKS_STEPS = [
  {
    title: 'Learn the controls first',
    body: 'Open the board with a short guide for zooming, moving, creating circles, and selecting an area.',
  },
  {
    title: 'Start with one person',
    body: 'Keep yourself at the center, add the first person, then place them inside the circle that gives the relationship context.',
  },
  {
    title: 'Let the map grow with you',
    body: 'Pan, zoom, resize, select, and connect circles as your network turns into a working memory system.',
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

interface LandingPageProps {
  onLogin: () => void
  onSignUp: () => void
  isAuthenticated: boolean
}

export default function LandingPage({ onLogin, onSignUp, isAuthenticated }: LandingPageProps) {
  const handleHome = (e: MouseEvent) => {
    e.preventDefault()
    window.location.hash = ''
  }

  const handleLaunchApp = (e: MouseEvent) => {
    e.preventDefault()
    try {
      window.sessionStorage.setItem(BOARD_ONBOARDING_FORCE_KEY, '1')
    } catch {
      // ignore
    }
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

  return (
    <div className="landing-container">
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

      <main className="landing-main">
        <section id="board-preview" className="landing-section landing-hero-section">
          <div className="board-preview-layout">
            <div className="board-preview-copy">
              <div className="hero-copy-stack">
                <span className="demo-eyebrow">Private relationship board</span>
                <h1 className="demo-title">Stop managing people from memory and spreadsheets</h1>
                <p className="hero-copy">
                  Social Datanode gives every person, note, group, and link a visible place on one board, so your network becomes something you can inspect, organize, and use.
                </p>
                <ul className="hero-points">
                  {HERO_CARDS.map((card) => (
                    <li key={card} className="hero-points__item">
                      {card}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="landing-hero-actions">
                <button type="button" className="lp-btn lp-btn-filled landing-hero-cta" onClick={handleLaunchApp}>
                  Open guided board
                </button>
                <p className="landing-hero-note">The first board opens with a short control guide. Sign in later only if you want private sync.</p>
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
          <div className="problem-solution-stack">
            {PROBLEM_SOLUTION_CARDS.map((card, index) => (
              <Fragment key={card.label}>
                {index > 0 && (
                  <div className="problem-solution-bridge" aria-hidden="true">
                    <span className="problem-solution-bridge__line" />
                    <span className="problem-solution-bridge__badge">With Social Datanode</span>
                    <span className="problem-solution-bridge__line" />
                  </div>
                )}
                <article
                  className={`problem-solution-card lp-deck-card problem-solution-card--${card.label.toLowerCase()}`}
                >
                  <span className="problem-solution-card__label">{card.label}</span>
                  <h3 className="problem-solution-card__title">{card.title}</h3>
                  <p className="problem-solution-card__body">{card.body}</p>
                </article>
              </Fragment>
            ))}
          </div>
        </section>

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

        <section className="landing-section features-section">
          <div className="section-header">
            <span className="demo-eyebrow">Core capabilities</span>
            <h2 className="section-title">What the board lets you do</h2>
          </div>

          <div className="capabilities-table-wrap">
            <table className="capabilities-table">
              <thead>
                <tr>
                  <th scope="col">Capability</th>
                  <th scope="col">What you get</th>
                </tr>
              </thead>
              <tbody>
                {CORE_CAPABILITIES.map((capability) => (
                  <tr key={capability.label} className="capabilities-table-row">
                    <th scope="row">{capability.label}</th>
                    <td>{capability.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

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

        <section className="landing-section final-cta-section" aria-labelledby="final-cta-title">
          <span className="demo-eyebrow">Ready when you are</span>
          <h2 id="final-cta-title" className="section-title">Open the board and place the first person</h2>
          <p className="section-lead">
            Start anonymously in this browser with the guide on screen. Sign in later if the map becomes something you want to keep in sync.
          </p>
          <button type="button" className="lp-btn lp-btn-filled final-cta-button" onClick={handleLaunchApp}>
            Open guided board
          </button>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="footer-content">
          <a href="#" className="footer-logo" onClick={handleHome}>
            <img className="footer-logo-mark" src={sdnLogo} alt="" aria-hidden="true" />
            <span className="footer-logo-text">Social Datanode</span>
          </a>
          <div className="footer-legal">
            <span className="footer-copyright">
              &copy; {new Date().getFullYear()} Social Datanode. All rights reserved.
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
