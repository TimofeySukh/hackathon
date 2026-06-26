export default function LandingPage() {
  const openProduct = () => {
    window.location.hash = '#board'
  }

  return (
    <main className="landing-page" aria-label="Social Datanode landing">
      <svg className="landing-stairs" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
        <path d="M0 150 H338 V268 H526 V402 H735 V526 H946 V660 H1144 V780 H1440" />
      </svg>

      <section className="landing-idea" aria-label="Project idea">
        <div className="landing-note-stack">
          <div className="landing-card landing-note landing-note-a">Structurise your network</div>
          <div className="landing-card landing-note landing-note-b">Brainstorm while looking at the graph</div>
          <div className="landing-card landing-note landing-note-c">Keep people, notes, and context in one visual workspace</div>
        </div>
      </section>

      <section className="landing-try" aria-label="Try the product">
        <article className="landing-card landing-cta-note">
          <h2>Try our product</h2>
          <p>Open the workspace and start mapping your own relationship graph.</p>
          <button className="landing-product-button" type="button" onClick={openProduct}>
            Open product
          </button>
        </article>
      </section>
    </main>
  )
}
