import sdnLogo from './assets/sdn-logo.svg'

export default function LandingPage() {
  const openProduct = () => {
    window.location.hash = '#board'
  }

  return (
    <main className="landing-page" aria-label="Social Datanode landing">
      <a className="landing-brand" href="#landing" aria-label="Social Datanode">
        <img src={sdnLogo} alt="" aria-hidden="true" />
        <span>Social Datanode</span>
      </a>

      <div className="landing-stairs" aria-hidden="true">
        <span className="landing-step landing-step-1" />
        <span className="landing-step landing-step-2" />
        <span className="landing-step landing-step-3" />
        <span className="landing-step landing-step-4" />
        <span className="landing-step landing-step-5" />
      </div>

      <section className="landing-idea" aria-label="Project idea">
        <article className="trello-list trello-list-idea">
          <header className="trello-list-header">
            <h1>Project idea</h1>
            <span>3</span>
            <button type="button" aria-label="More options">...</button>
          </header>
          <div className="landing-note-stack">
            <div className="trello-card landing-note landing-note-a">Structurise your network</div>
            <div className="trello-card landing-note landing-note-b">Brainstorm while looking at the graph</div>
            <div className="trello-card landing-note landing-note-c">Keep people, notes, and context in one place</div>
          </div>
          <div className="trello-add-row" aria-hidden="true">
            <span>+</span>
            <span>Add a card</span>
          </div>
        </article>
      </section>

      <section className="landing-try" aria-label="Try the product">
        <article className="trello-list trello-list-cta">
          <header className="trello-list-header">
            <h2>Try our product</h2>
            <span>1</span>
            <button type="button" aria-label="More options">...</button>
          </header>
          <div className="trello-card cta-card">
            Open the workspace and start mapping your own relationship graph.
          </div>
          <button className="landing-product-button" type="button" onClick={openProduct}>
            Open product
          </button>
        </article>
      </section>
    </main>
  )
}
