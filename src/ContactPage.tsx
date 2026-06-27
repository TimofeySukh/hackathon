import type { MouseEvent } from 'react'
import sdnLogo from './assets/sdn-logo.svg'
import linkedinBrand from './assets/brands/linkedin.svg'

type TeamContact = {
  name: string
  role: string
  avatarUrl: string
  linkedinUrl: string
  email?: string
}

const TEAM_CONTACTS: TeamContact[] = [
  {
    name: 'Timofey Sukhov',
    role: 'CEO',
    avatarUrl: '/timofey_avatar.jpeg',
    linkedinUrl: 'https://www.linkedin.com/in/timofey-sukhov-775b38404/',
    email: 'timasukhovm@gmail.com',
  },
  {
    name: 'Velizar Seleznev',
    role: 'CTO',
    avatarUrl: '/velizar_avatar.jpeg',
    linkedinUrl: 'https://www.linkedin.com/in/velizar-seleznev/',
    email: 'velizar.seleznev@gmail.com',
  },
]

interface ContactPageProps {
  onLogin: () => void
  onSignUp: () => void
  isAuthenticated: boolean
}

export default function ContactPage({ onLogin, onSignUp, isAuthenticated }: ContactPageProps) {
  const handleLaunchApp = (e: MouseEvent) => {
    e.preventDefault()
    window.location.hash = '#board'
  }

  const handleLanding = (e: MouseEvent) => {
    e.preventDefault()
    window.location.hash = ''
  }

  const handleDocs = (e: MouseEvent) => {
    e.preventDefault()
    window.location.hash = '#docs'
  }

  const handlePrivacy = (e: MouseEvent) => {
    e.preventDefault()
    window.location.hash = '#privacy'
  }

  return (
    <div className="landing-container contact-page">
      <header className="landing-header">
        <nav className="landing-nav">
          <a href="#" className="landing-logo" onClick={handleLanding}>
            <img className="landing-logo-mark" src={sdnLogo} alt="" aria-hidden="true" />
            <span className="landing-logo-text">Social Datanode</span>
          </a>

          <div className="landing-nav-right">
            <div className="landing-nav-links">
              <a href="#docs" className="landing-nav-link" onClick={handleDocs}>
                Docs
              </a>
              <a href="#contact" className="landing-nav-link landing-nav-link--active" aria-current="page">
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

      <main className="contact-page-main">
        <section className="contact-section" aria-labelledby="contact-title">
          <div className="section-header">
            <span className="demo-eyebrow">Contact</span>
            <h1 id="contact-title" className="section-title">
              Talk to the team
            </h1>
            <p className="contact-page-lead">
              Questions about the product, partnerships, or feedback — reach out directly.
            </p>
          </div>
          <div className="contact-team-grid">
            {TEAM_CONTACTS.map((person, index) => (
              <article
                key={person.name}
                className={`contact-card lp-deck-card lp-deck-card--tilt-${(index % 3) + 1}`}
              >
                <img className="contact-avatar" src={person.avatarUrl} alt="" />
                <div className="contact-card-body">
                  <h2 className="contact-name">{person.name}</h2>
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

      <footer className="landing-footer">
        <div className="footer-content">
          <a href="#" className="footer-logo" onClick={handleLanding}>
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
