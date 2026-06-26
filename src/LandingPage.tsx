export default function LandingPage() {
  const openProduct = () => {
    window.location.hash = '#board'
  }

  return (
    <main className="landing-page" aria-label="Social Datanode landing">
      <svg className="landing-stairs" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
        <path
          className="landing-stairs-outline"
          d="M-46 150 H296 C333 150 352 169 352 206 V226 C352 263 371 282 408 282 H474 C511 282 530 301 530 338 V360 C530 397 549 416 586 416 H682 C719 416 738 435 738 472 V484 C738 521 757 540 794 540 H902 C939 540 958 559 958 596 V618 C958 655 977 674 1014 674 H1098 C1135 674 1154 693 1154 730 V738 C1154 775 1173 794 1210 794 H1486"
        />
        <path
          className="landing-stairs-fill"
          d="M-46 150 H296 C333 150 352 169 352 206 V226 C352 263 371 282 408 282 H474 C511 282 530 301 530 338 V360 C530 397 549 416 586 416 H682 C719 416 738 435 738 472 V484 C738 521 757 540 794 540 H902 C939 540 958 559 958 596 V618 C958 655 977 674 1014 674 H1098 C1135 674 1154 693 1154 730 V738 C1154 775 1173 794 1210 794 H1486"
        />
      </svg>

      <section className="landing-idea" aria-label="Project idea">
        <div className="landing-note-stack">
          <div className="landing-card landing-note landing-note-a">
            <span>Import people</span>
            <strong>LinkedIn contacts land on one board.</strong>
          </div>
          <div className="landing-card landing-note landing-note-b">
            <span>Think visually</span>
            <strong>Cluster relationships by dragging circles.</strong>
          </div>
          <div className="landing-card landing-note landing-note-c">
            <span>Use AI memory</span>
            <strong>Find who to ask or reconnect with.</strong>
          </div>
        </div>
      </section>

      <section className="landing-try" aria-label="Try the product">
        <article className="landing-card landing-cta-note">
          <span className="landing-kicker">Social Datanode</span>
          <h1>Your network, laid out like a thinking board</h1>
          <p>Turn scattered contacts into a visual workspace for people, context, and next moves.</p>
          <div className="landing-proof-row" aria-label="Product highlights">
            <span>Private workspace</span>
            <span>LinkedIn import</span>
            <span>AI notes</span>
          </div>
          <div className="landing-action-row">
            <button className="landing-product-button" type="button" aria-label="Open workspace" onClick={openProduct}>
              <span>Open workspace</span>
              <span aria-hidden="true">-&gt;</span>
            </button>
            <small>Starts with a blank board</small>
          </div>
        </article>
      </section>
    </main>
  )
}
