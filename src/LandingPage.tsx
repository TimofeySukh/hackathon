import { useMemo, useState } from 'react'

type LandingMode = 'fundraise' | 'hire' | 'reconnect'

const modes: Record<
  LandingMode,
  {
    label: string
    eyebrow: string
    headline: string
    note: string
    insight: string
    nodes: string[]
  }
> = {
  fundraise: {
    label: 'Fundraise',
    eyebrow: 'Warm paths',
    headline: 'Find the people who can move the round.',
    note: 'Cluster angels, operators, founders, and intros before you start sending cold asks.',
    insight: '12 warm intro paths',
    nodes: ['You', 'Ex-founder', 'Angel', 'Partner', 'Operator'],
  },
  hire: {
    label: 'Hire',
    eyebrow: 'Talent map',
    headline: 'Turn loose referrals into a hiring graph.',
    note: 'See who knows candidates, who worked together, and which communities are underused.',
    insight: '8 high-trust candidates',
    nodes: ['You', 'Design', 'Backend', 'Growth', 'Referral'],
  },
  reconnect: {
    label: 'Reconnect',
    eyebrow: 'AI memory',
    headline: 'Remember why every relationship matters.',
    note: 'Keep notes, follow-ups, and context attached to people instead of buried in chat history.',
    insight: '24 follow-ups found',
    nodes: ['You', 'Mentor', 'Customer', 'Alumni', 'Friend'],
  },
}

const workflow = [
  {
    title: 'Import the mess',
    body: 'Drop in LinkedIn connections, add people manually, or start with one important relationship.',
  },
  {
    title: 'Shape the board',
    body: 'Drag circles, make clusters, and arrange people the same way you actually think about them.',
  },
  {
    title: 'Ask the graph',
    body: 'Use notes and AI search to find intros, follow-ups, collaborators, and forgotten context.',
  },
]

const featureCards = [
  ['Visual CRM', 'A relationship graph instead of another table of names.'],
  ['Private by default', 'Your board starts as your own workspace, not a public network.'],
  ['AI notes', 'Summaries and search help you recover context when it matters.'],
  ['Live board canvas', 'Move fast with direct manipulation, zoom, selection, and nested circles.'],
]

const useCases = [
  ['Founders', 'Map investors, operators, customers, and warm paths before outreach.'],
  ['Communities', 'Understand who belongs where and which bridges are missing.'],
  ['Operators', 'Keep people, projects, and follow-ups in one repeatable workspace.'],
]

export default function LandingPage() {
  const [mode, setMode] = useState<LandingMode>('fundraise')
  const [activeStep, setActiveStep] = useState(1)
  const activeMode = modes[mode]
  const activeWorkflow = workflow[activeStep]

  const previewNodes = useMemo(
    () =>
      activeMode.nodes.map((name, index) => ({
        name,
        className: `landing-node landing-node-${index + 1}`,
      })),
    [activeMode],
  )

  const openProduct = () => {
    window.location.hash = '#board'
  }

  return (
    <main className="landing-page" aria-label="Social Datanode landing">
      <nav className="landing-nav" aria-label="Landing navigation">
        <a className="landing-brand" href="#top" aria-label="Social Datanode home">
          <span aria-hidden="true">SD</span>
          <strong>Social Datanode</strong>
        </a>
        <div className="landing-nav-links">
          <a href="#workflow">Workflow</a>
          <a href="#use-cases">Use cases</a>
          <a href="#features">Features</a>
        </div>
        <button className="landing-nav-cta" type="button" onClick={openProduct}>
          Open app
        </button>
      </nav>

      <section className="landing-hero" id="top">
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

        <div className="landing-hero-copy">
          <span className="landing-kicker">Social Datanode</span>
          <h1>Your network, laid out like a startup command board</h1>
          <p>
            Import contacts, cluster people visually, attach notes, and use AI search to find the next
            person you should talk to.
          </p>
          <div className="landing-mode-switch" aria-label="Choose a startup workflow">
            {(Object.keys(modes) as LandingMode[]).map((key) => (
              <button
                className={key === mode ? 'is-active' : ''}
                key={key}
                type="button"
                onClick={() => setMode(key)}
              >
                {modes[key].label}
              </button>
            ))}
          </div>
          <div className="landing-action-row">
            <button className="landing-product-button" type="button" aria-label="Open workspace" onClick={openProduct}>
              <span>Open workspace</span>
              <span aria-hidden="true">-&gt;</span>
            </button>
            <small>Starts with a blank board. No demo data forced.</small>
          </div>
          <div className="landing-hero-notes" aria-label="Product notes">
            <div className="landing-card landing-note landing-note-a">
              <span>{activeMode.eyebrow}</span>
              <strong>{activeMode.headline}</strong>
            </div>
            <div className="landing-card landing-note landing-note-b">
              <span>Board first</span>
              <strong>Not another spreadsheet pretending to understand relationships.</strong>
            </div>
          </div>
        </div>

        <aside className="landing-product-demo" aria-label="Interactive product preview">
          <div className="landing-demo-toolbar">
            <span>Live board preview</span>
            <strong>{activeMode.insight}</strong>
          </div>
          <div className="landing-demo-canvas">
            <div className="landing-orbit landing-orbit-one" />
            <div className="landing-orbit landing-orbit-two" />
            {previewNodes.map((node) => (
              <div className={node.className} key={node.name}>
                {node.name}
              </div>
            ))}
            <div className="landing-demo-note">
              <span>{activeMode.label}</span>
              <strong>{activeMode.note}</strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="landing-section landing-workflow" id="workflow">
        <div className="landing-section-copy">
          <span className="landing-section-kicker">How it works</span>
          <h2>Three moves from contact soup to useful graph.</h2>
        </div>
        <div className="landing-workflow-grid">
          <div className="landing-workflow-tabs" role="tablist" aria-label="Workflow steps">
            {workflow.map((step, index) => (
              <button
                className={index === activeStep ? 'is-active' : ''}
                key={step.title}
                type="button"
                role="tab"
                aria-selected={index === activeStep}
                onClick={() => setActiveStep(index)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                {step.title}
              </button>
            ))}
          </div>
          <article className="landing-card landing-workflow-card">
            <span>{activeWorkflow.title}</span>
            <h3>{activeWorkflow.body}</h3>
            <div className="landing-mini-board" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </article>
        </div>
      </section>

      <section className="landing-section landing-use-cases" id="use-cases">
        <div className="landing-section-copy">
          <span className="landing-section-kicker">Built for messy networks</span>
          <h2>Useful before you have a perfect CRM process.</h2>
        </div>
        <div className="landing-use-case-grid">
          {useCases.map(([title, body]) => (
            <article className="landing-card landing-use-case" key={title}>
              <span>{title}</span>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-section landing-features" id="features">
        <div className="landing-section-copy">
          <span className="landing-section-kicker">What ships today</span>
          <h2>A real canvas app behind the landing page.</h2>
        </div>
        <div className="landing-feature-grid">
          {featureCards.map(([title, body]) => (
            <article className="landing-card landing-feature" key={title}>
              <span aria-hidden="true" />
              <h3>{title}</h3>
              <p>{body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-final">
        <div className="landing-final-copy">
          <span className="landing-section-kicker">Try it now</span>
          <h2>Open the board and start arranging the people that matter.</h2>
        </div>
        <button className="landing-product-button" type="button" aria-label="Launch Social Datanode" onClick={openProduct}>
          <span>Launch Social Datanode</span>
          <span aria-hidden="true">-&gt;</span>
        </button>
      </section>
    </main>
  )
}
