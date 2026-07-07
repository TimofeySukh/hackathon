import type { MouseEvent } from 'react'
import sdnLogo from './assets/sdn-logo.svg'

const EFFECTIVE_DATE = 'June 27, 2026'
const CONTACT_EMAIL = 'timasukhovm@gmail.com'

interface PrivacyPageProps {
  onLogin: () => void
  onSignUp: () => void
  isAuthenticated: boolean
}

export default function PrivacyPage({ onLogin, onSignUp, isAuthenticated }: PrivacyPageProps) {
  const siteOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://social.datanode.live'

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

  const handleContact = (e: MouseEvent) => {
    e.preventDefault()
    window.location.hash = '#contact'
  }

  return (
    <div className="landing-container legal-page">
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

      <main className="legal-page-main">
        <article className="legal-document">
          <header className="legal-document-header">
            <span className="demo-eyebrow">Legal</span>
            <h1>Privacy Policy</h1>
            <p className="legal-meta">
              Effective date: {EFFECTIVE_DATE}
              <br />
              Website: <a href={siteOrigin}>{siteOrigin.replace(/^https?:\/\//, '')}</a>
            </p>
          </header>

          <section className="legal-section">
            <h2>1. Who we are</h2>
            <p>
              Social Datanode (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;) operates a visual relationship board
              where you can map people, circles, notes, and links. This Privacy Policy explains how we
              collect, use, store, share, and delete personal data when you use our website and product.
            </p>
          </section>

          <section className="legal-section">
            <h2>2. What data we collect</h2>
            <p>We collect only the data needed to run the product. Depending on how you use Social Datanode, this may include:</p>
            <ul>
              <li>
                <strong>Account data (optional).</strong> If you create an account, we store your email address
                and authentication credentials through Supabase Auth. If you sign in with Google, we may receive
                your name and profile picture URL from Google to label your personal &quot;You&quot; circle.
              </li>
              <li>
                <strong>Board graph data.</strong> Your board content — circle names, people names, notes, links,
                favorites, avatars you upload, and layout positions — is stored as one JSON graph. When you are
                signed in, this graph is saved to our database. When you are not signed in, it stays in your browser
                only (see Section 5).
              </li>
              <li>
                <strong>LinkedIn import data.</strong> If you import a LinkedIn Connections export ZIP, the file is
                parsed in your browser. We do not upload the ZIP file itself to our servers. Parsed fields such as
                names, companies, job titles, profile URLs, connection dates, and any email addresses present in
                your export may become part of your board graph and, if you are signed in, are stored in your
                private graph record.
              </li>
              <li>
                <strong>LinkedIn profile enrichment.</strong> When you explicitly request enrichment for a LinkedIn
                profile URL, we send that URL to our Supabase Edge Function, which calls a third-party data provider
                (Bright Data) to fetch public profile details such as name, headline, company, about text, and avatar URL.
                Results may be cached in your browser for up to 30 days to reduce repeat requests.
              </li>
              <li>
                <strong>LinkedIn archive AI context.</strong> If you are signed in and import a LinkedIn archive ZIP,
                the browser sends relevant message, invitation, and post excerpts to our Supabase Edge Function so it
                can generate relationship context notes. We store only the generated notes in your private graph, not
                the raw archive text.
              </li>
              <li>
                <strong>Agent access tokens (optional).</strong> If you create API or MCP tokens in Settings, we store
                a hashed token, a short prefix, a label you choose, scopes, and usage timestamps. The full token is
                shown only once at creation.
              </li>
              <li>
                <strong>Technical and preference data.</strong> We store a signed-in session token in your browser
                through Supabase. We also store small local preferences such as whether you have seen first-run
                in-app hints. We do not run advertising analytics or third-party marketing trackers on the site today.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>3. How we use your data</h2>
            <p>We use personal data to:</p>
            <ul>
              <li>Provide, maintain, and sync your private board when you sign in.</li>
              <li>Authenticate you and protect your account.</li>
              <li>Save anonymous board edits locally when you choose not to sign in.</li>
              <li>Import and organize connection data you choose to add to the board.</li>
              <li>Enrich LinkedIn profiles when you request it and add LinkedIn archive context after signed-in ZIP imports.</li>
              <li>Let you connect approved AI tools or scripts through scoped agent tokens you create.</li>
              <li>Prevent data loss from concurrent edits through revision checks.</li>
              <li>Respond to support or privacy requests.</li>
            </ul>
            <p>We do not sell your personal data.</p>
          </section>

          <section className="legal-section">
            <h2>4. Legal bases (EEA/UK users)</h2>
            <p>If you are in the European Economic Area or the United Kingdom, we rely on:</p>
            <ul>
              <li><strong>Contract</strong> — to provide the service you sign up for.</li>
              <li><strong>Legitimate interests</strong> — to secure the product, prevent abuse, and improve reliability, balanced against your rights.</li>
              <li><strong>Consent</strong> — where required, for optional actions such as Google sign-in or LinkedIn enrichment you initiate.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>5. Where data is stored</h2>
            <ul>
              <li>
                <strong>Signed-in users:</strong> account and graph data are stored in Supabase (PostgreSQL) with
                row-level security so each user can access only their own records.
              </li>
              <li>
                <strong>Signed-out users:</strong> board data is stored in your browser&apos;s <code>localStorage</code>{' '}
                under the key <code>hackathon-board:local-graph</code>. It is not sent to our database until you sign in
                and your edits are saved to your account graph.
              </li>
              <li>
                <strong>Browser cache:</strong> LinkedIn enrichment responses may be cached locally under{' '}
                <code>hackathon-board:linkedin-profile-enrichment-cache:v1</code>.
              </li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>6. Third-party service providers</h2>
            <p>We use trusted processors to operate the product:</p>
            <ul>
              <li><strong>Supabase</strong> — authentication, database hosting, and Edge Functions.</li>
              <li><strong>Google</strong> — optional OAuth sign-in (only if you choose it).</li>
              <li><strong>Bright Data</strong> — LinkedIn profile enrichment when you request it.</li>
            </ul>
            <p>
              These providers process data on our behalf under their own terms and privacy policies. Provider API keys
              stay on our servers and are not exposed in the browser.
            </p>
          </section>

          <section className="legal-section">
            <h2>7. Sharing and collaboration</h2>
            <p>
              Your board is private to your account. We do not offer shared boards, public profiles, or real-time
              collaboration today. Other users cannot browse your graph unless you separately export data and share it
              yourself.
            </p>
          </section>

          <section className="legal-section">
            <h2>8. Retention</h2>
            <ul>
              <li>We keep your account and graph data while your account is active.</li>
              <li>Revoked agent tokens remain in our records as revoked metadata; the secret itself is stored only as a hash.</li>
              <li>Local browser data remains until you clear site data or we change the storage keys in a future release.</li>
              <li>When you ask us to delete your account, we delete associated account and graph records subject to legal retention requirements.</li>
            </ul>
          </section>

          <section className="legal-section">
            <h2>9. Your choices and rights</h2>
            <p>Depending on where you live, you may have the right to:</p>
            <ul>
              <li>Access the personal data we hold about you.</li>
              <li>Correct inaccurate account or board data inside the product.</li>
              <li>Export your board as JSON from Settings → Export graph.</li>
              <li>Delete local anonymous data by clearing your browser storage for this site.</li>
              <li>Request account and cloud graph deletion.</li>
              <li>Object to or restrict certain processing, or withdraw consent where processing is consent-based.</li>
            </ul>
            <p>
              To exercise these rights, email us at{' '}
              <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or use the{' '}
              <a href="#contact" onClick={handleContact}>Contact</a> page. We may need to verify your identity before
              processing deletion requests.
            </p>
          </section>

          <section className="legal-section">
            <h2>10. Security</h2>
            <p>
              We use industry-standard measures including encrypted transport (HTTPS), Supabase row-level security,
              hashed agent tokens, and scoped API access. No method of transmission or storage is 100% secure, but we
              work to protect your data and limit access to what the product requires.
            </p>
          </section>

          <section className="legal-section">
            <h2>11. International transfers</h2>
            <p>
              Our infrastructure providers may process data in the United States and other countries. Where required,
              we rely on appropriate safeguards such as standard contractual clauses offered by our providers.
            </p>
          </section>

          <section className="legal-section">
            <h2>12. Changes to this policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will post the new version on this page and update
              the effective date above. Continued use after changes means you accept the updated policy.
            </p>
          </section>

          <section className="legal-section">
            <h2>13. Contact us</h2>
            <p>
              Questions about privacy or data deletion requests:
              <br />
              Email: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
              <br />
              Contact page: <a href="#contact" onClick={handleContact}>social.datanode.live/#contact</a>
            </p>
          </section>
        </article>
      </main>

      <footer className="landing-footer">
        <div className="footer-content">
          <a href="#" className="footer-logo" onClick={handleLanding}>
            <img className="footer-logo-mark" src={sdnLogo} alt="" aria-hidden="true" />
            <span className="footer-logo-text">Social Datanode</span>
          </a>
          <div className="footer-legal">
            <a href="#privacy" className="footer-legal-link footer-legal-link--active" aria-current="page">
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
