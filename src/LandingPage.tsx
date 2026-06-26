export default function LandingPage() {
  const openProduct = () => {
    window.location.hash = '#board'
  }

  return (
    <main className="landing-page" aria-label="Social Datanode landing">
      <svg className="landing-stairs" viewBox="0 0 1440 900" preserveAspectRatio="none" aria-hidden="true">
        <path d="M120 92 H355 V188 H510 V326 H705 V410 H872 V560 H1078 V722 H1320" />
      </svg>

      <section className="landing-idea" aria-label="Project idea">
        <div className="landing-note-stack">
          <div className="landing-card landing-note landing-note-a">Structurise your network</div>
          <div className="landing-card landing-note landing-note-b">Brainstorm while looking at the graph</div>
          <div className="landing-card landing-note landing-note-c">Keep people, notes, and context in one place</div>
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
