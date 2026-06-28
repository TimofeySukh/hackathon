import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import sdnLogo from './assets/sdn-logo.svg'
import WorkspaceModeToggle from './components/WorkspaceModeToggle'
import {
  completeOpenRouterChat,
  isOpenRouterConfigured,
  type OpenRouterChatMessage,
} from './lib/openRouterChat'

type ChatRole = 'user' | 'assistant'

type DemoThinkingStep = {
  label: string
  status: 'done' | 'active'
}

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  createdAt: number
  variant?: 'demo-referral' | 'demo-thinking'
  demoThinkingSteps?: DemoThinkingStep[]
  demoThinkingCollapsed?: boolean
  demoThinkingHasBeenCollapsed?: boolean
}

type ChatThread = {
  id: string
  title: string
  messages: ChatMessage[]
  updatedAt: number
}

type AgentPageProps = {
  onSwitchToBoard: () => void
}

const demoClosedCustomer = {
  name: 'Olivia Bennett',
  company: 'Harvest Market',
  role: 'Regional Produce Director',
}

const demoCustomerCircleProspects = [
  {
    name: 'Sarah Mitchell',
    title: 'Fresh Produce Category Lead',
    company: 'FreshLine Grocers',
    linkedin: 'https://linkedin.com/in/sarah-mitchell-produce',
    email: 'sarah.mitchell@harvestmarket.com',
    relationship: 'Worked with Olivia at Harvest Market',
    reason: 'Owns fruit buying for 42 stores and recently added local farm suppliers.',
  },
  {
    name: 'Daniel Brooks',
    title: 'Regional Procurement Manager',
    company: 'Green Basket Foods',
    linkedin: 'https://linkedin.com/in/daniel-brooks-grocery',
    email: 'daniel.brooks@greenbasketfoods.com',
    relationship: 'Former buying partner in Olivia\'s network',
    reason: 'Runs produce vendor selection and has budget for seasonal apple contracts.',
  },
  {
    name: 'Emma Carter',
    title: 'Store Operations Director',
    company: 'Northside Grocers',
    linkedin: 'https://linkedin.com/in/emma-carter-retail',
    email: 'emma.carter@northsidegrocers.com',
    relationship: 'Direct connection from Olivia\'s retail circle',
    reason: 'Coordinates direct farm deliveries for a 19-store neighborhood chain.',
  },
  {
    name: 'Priya Nair',
    title: 'Founder',
    company: 'Corner Pantry',
    linkedin: 'https://linkedin.com/in/priya-nair-cornerpantry',
    email: 'priya@cornerpantry.co',
    relationship: 'Introduced by Olivia at a local retail event',
    reason: 'Promotes local farm products and buys weekly produce for three stores.',
  },
  {
    name: 'Jonas Weber',
    title: 'Produce Buyer',
    company: 'Urban Produce Co.',
    linkedin: 'https://linkedin.com/in/jonas-weber-produce',
    email: 'jonas.weber@urbanproduce.co',
    relationship: 'Shared supplier group with Olivia',
    reason: 'Supplies independent grocery stores and is expanding fruit assortment.',
  },
  {
    name: 'Lena Fischer',
    title: 'Retail Partnerships Lead',
    company: 'Daily Juice Bar',
    linkedin: 'https://linkedin.com/in/lena-fischer-juice',
    email: 'lena.fischer@dailyjuicebar.com',
    relationship: 'Olivia endorsed her produce partnerships work',
    reason: 'High apple usage for juice programs and recurring store replenishment.',
  },
  {
    name: 'Peter Novak',
    title: 'Supply Manager',
    company: 'Valley Market Group',
    linkedin: 'https://linkedin.com/in/peter-novak-supply',
    email: 'peter.novak@valleymarketgroup.com',
    relationship: 'Second retail buyer inside Olivia\'s circle',
    reason: 'Buys bulk produce for convenience stores with weekly delivery cycles.',
  },
  {
    name: 'Aisha Khan',
    title: 'Fresh Food Program Manager',
    company: 'Bright Schools Market',
    linkedin: 'https://linkedin.com/in/aisha-khan-food',
    email: 'aisha.khan@brightschoolsmarket.org',
    relationship: 'Olivia follows her school-market produce work',
    reason: 'Manages recurring fruit supply and prefers local seasonal vendors.',
  },
]

const demoIntroEmailBody = `Hi Olivia,

Great closing the apple supply deal today. I really appreciate the trust.

I noticed Sarah Mitchell in your network. She looks responsible for fresh produce buying at FreshLine Grocers, so she may also be a fit for our apples this season.

Would you be comfortable making a quick intro?

A one-line forward is enough. I can follow up with availability, pricing, delivery windows, and sample crates.

Thanks again.`

const demoOutreachEmailBody = `Hi Sarah,

I am the Sales Director at a farm producing fresh apples for grocery and retail partners.

Olivia Bennett and I just closed an apple supply order, and I noticed you also work on fresh produce buying. We can supply consistent seasonal apples with flexible delivery windows and clear wholesale pricing.

Would it be worth a quick call next week to see whether our apple supply fits your produce calendar?

Best,`

const DEMO_INTRO_TEXT =
  "I analyzed Olivia Bennett's customer network across 1,273 connections and identified 8 retail buyers most likely to purchase apples this season."

const DEMO_THINKING_STEPS = [
  { label: 'Reading your request…', durationMs: 850 },
  { label: 'Mapping Olivia Bennett\'s customer network…', durationMs: 1150 },
  { label: 'Scanning 1,273 LinkedIn connections…', durationMs: 1350 },
  { label: 'Finding retail and grocery profiles…', durationMs: 1350 },
  { label: 'Analyzing buyer roles and produce categories…', durationMs: 1500 },
  { label: 'Ranking highest-probability apple buyers…', durationMs: 1500 },
  { label: 'Drafting intro and outreach recommendations…', durationMs: 1150 },
  { label: 'Preparing lead report…', durationMs: 1150 },
] as const

const DEMO_REVEAL_STAGE_DELAYS_MS = [80, 100, 100, 100, 120, 120, 100, 110, 60, 60, 60, 60, 60, 60, 60, 60] as const

const DEMO_INTRO_CHAR_MS = 5

function toApiMessages(messages: ChatMessage[]): OpenRouterChatMessage[] {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
  }))
}

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function createThread(title = 'New chat'): ChatThread {
  const now = Date.now()
  return {
    id: createId('thread'),
    title,
    messages: [],
    updatedAt: now,
  }
}

function deriveTitle(content: string): string {
  const trimmed = content.trim()
  if (!trimmed) return 'New chat'
  return trimmed.length > 42 ? `${trimmed.slice(0, 42)}…` : trimmed
}

function isDemoReferralPrompt(content: string): boolean {
  const normalized = content.toLowerCase()
  const hasAppleFarmContext =
    (normalized.includes('apple') || normalized.includes('яблок')) &&
    (normalized.includes('farm') || normalized.includes('ферм'))
  const hasClosedDealContext =
    normalized.includes('closed a deal') ||
    normalized.includes('just closed') ||
    normalized.includes('new customer') ||
    normalized.includes('client') ||
    normalized.includes('customer') ||
    normalized.includes('закрыл сделк') ||
    normalized.includes('клиент')
  const asksForCustomerNetwork =
    normalized.includes('his network') ||
    normalized.includes('her network') ||
    normalized.includes('customer network') ||
    normalized.includes('client network') ||
    normalized.includes('his circle') ||
    normalized.includes('her circle') ||
    normalized.includes('linkedin') ||
    normalized.includes('network') ||
    normalized.includes('circle') ||
    normalized.includes('его круг') ||
    normalized.includes('ее круг') ||
    normalized.includes('круге') ||
    normalized.includes('линкед') ||
    normalized.includes('линкет')
  const asksForRetailBuyers =
    normalized.includes('store') ||
    normalized.includes('grocery') ||
    normalized.includes('retail') ||
    normalized.includes('shop') ||
    normalized.includes('buyer') ||
    normalized.includes('магазин')

  return hasAppleFarmContext && hasClosedDealContext && asksForCustomerNetwork && asksForRetailBuyers
}

function getDemoPriorityLabel(index: number): string {
  if (index < 2) return 'High'
  if (index < 5) return 'Medium'
  return 'Watch'
}

function splitEmail(email: string): { local: string; domain: string } {
  const [local, domain] = email.split('@')
  return {
    local: local || email,
    domain: domain || '',
  }
}

function waitWithAbort(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'))
  }

  return new Promise((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      signal.removeEventListener('abort', onAbort)
      resolve()
    }, ms)

    function onAbort() {
      window.clearTimeout(timeoutId)
      reject(new DOMException('Aborted', 'AbortError'))
    }

    signal.addEventListener('abort', onAbort)
  })
}

async function runDemoThinkingSequence(
  signal: AbortSignal,
  onStep: (steps: DemoThinkingStep[]) => void,
): Promise<void> {
  for (let index = 0; index < DEMO_THINKING_STEPS.length; index += 1) {
    const step = DEMO_THINKING_STEPS[index]
    onStep([
      ...DEMO_THINKING_STEPS.slice(0, index).map((item) => ({
        label: item.label,
        status: 'done' as const,
      })),
      { label: step.label, status: 'active' },
    ])
    await waitWithAbort(step.durationMs, signal)
  }

  onStep(DEMO_THINKING_STEPS.map((item) => ({
    label: item.label,
    status: 'done' as const,
  })))
}

function useDemoReportReveal(onRevealUpdate?: () => void) {
  const [introChars, setIntroChars] = useState(0)
  const [stageIndex, setStageIndex] = useState(-1)

  useEffect(() => {
    let index = 0
    const intervalId = window.setInterval(() => {
      index += 1
      setIntroChars(index)
      onRevealUpdate?.()
      if (index >= DEMO_INTRO_TEXT.length) {
        window.clearInterval(intervalId)
        setStageIndex(0)
      }
    }, DEMO_INTRO_CHAR_MS)

    return () => window.clearInterval(intervalId)
  }, [onRevealUpdate])

  useEffect(() => {
    if (stageIndex < 0) return
    if (stageIndex >= DEMO_REVEAL_STAGE_DELAYS_MS.length) return

    const timeoutId = window.setTimeout(() => {
      setStageIndex((current) => current + 1)
      onRevealUpdate?.()
    }, DEMO_REVEAL_STAGE_DELAYS_MS[stageIndex])

    return () => window.clearTimeout(timeoutId)
  }, [onRevealUpdate, stageIndex])

  return { introChars, stageIndex }
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 5v14M5 12l7-7 7 7" />
    </svg>
  )
}

function ChevronIcon({ open }: { open?: boolean }) {
  return (
    <svg
      className={`agent-demo-thinking-toggle__chevron ${open ? 'is-open' : ''}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function ThinkingSpinnerIcon() {
  return (
    <svg className="agent-demo-thinking-spinner" viewBox="0 0 24 24" aria-hidden="true">
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="14 42"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg className="agent-demo-thinking-check" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 12l5 5L19 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function revealStyle(delayMs = 0): { style: { animationDelay: string } } {
  return { style: { animationDelay: `${delayMs}ms` } }
}

function DemoThinkingBlock({
  message,
  onToggle,
}: {
  message: ChatMessage
  onToggle: () => void
}) {
  const steps = message.demoThinkingSteps ?? []
  const collapsed = message.demoThinkingCollapsed ?? false
  const canCollapse = collapsed === false
    && steps.every((step) => step.status === 'done')
    && message.demoThinkingHasBeenCollapsed === true

  if (collapsed) {
    return (
      <article className="agent-message agent-message--assistant agent-message--thinking-collapsed agent-demo-thinking-summary-enter">
        <img className="agent-message__logo" src={sdnLogo} alt="" aria-hidden="true" />
        <button
          type="button"
          className="agent-message__bubble agent-demo-thinking-toggle"
          onClick={onToggle}
          aria-expanded="false"
        >
          <div className="agent-message__meta">DataNode Agent</div>
          <span className="agent-demo-thinking-toggle__title">Network analysis</span>
          <span className="agent-demo-thinking-toggle__meta">
            {steps.length} steps completed
          </span>
          <ChevronIcon />
        </button>
      </article>
    )
  }

  return (
    <div className="agent-demo-thinking-block">
      {steps.map((step, index) => (
        <article
          key={`${message.id}-${step.label}`}
          className={`agent-message agent-message--assistant agent-message--thinking-step ${step.status === 'active' ? 'is-pending' : 'is-done'}`}
          {...revealStyle(index * 70)}
        >
          <img className="agent-message__logo" src={sdnLogo} alt="" aria-hidden="true" />
          <div className="agent-message__bubble">
            {index === 0 ? <div className="agent-message__meta">DataNode Agent</div> : null}
            <p className="agent-demo-thinking-step">
              <span className="agent-demo-thinking-step__icon" aria-hidden="true">
                {step.status === 'active' ? <ThinkingSpinnerIcon /> : <CheckIcon />}
              </span>
              <span>{step.label}</span>
            </p>
          </div>
        </article>
      ))}
      {canCollapse ? (
        <article className="agent-message agent-message--assistant agent-message--thinking-collapsed">
          <img className="agent-message__logo" src={sdnLogo} alt="" aria-hidden="true" />
          <button
            type="button"
            className="agent-message__bubble agent-demo-thinking-toggle is-inline"
            onClick={onToggle}
            aria-expanded="true"
          >
            <span className="agent-demo-thinking-toggle__title">Collapse analysis steps</span>
            <ChevronIcon open />
          </button>
        </article>
      ) : null}
    </div>
  )
}

function DemoReferralResult({ onRevealUpdate }: { onRevealUpdate?: () => void }) {
  const [generatedEmail, setGeneratedEmail] = useState<'intro' | 'outreach' | null>(null)
  const { introChars, stageIndex } = useDemoReportReveal(onRevealUpdate)
  const introText = DEMO_INTRO_TEXT.slice(0, introChars)
  const isIntroStreaming = introChars < DEMO_INTRO_TEXT.length
  const showHeader = stageIndex >= 0
  const showStats = stageIndex >= 1
  const visibleStatCount = showStats ? Math.min(3, stageIndex) : 0
  const showCustomer = stageIndex >= 4
  const showInsight = stageIndex >= 5
  const showActions = stageIndex >= 6
  const showTable = stageIndex >= 7
  const visibleRowCount = showTable ? Math.max(0, stageIndex - 7) : 0
  const isRevealComplete = stageIndex >= DEMO_REVEAL_STAGE_DELAYS_MS.length

  return (
    <section className="agent-demo-result" aria-label="Customer network sales lead report">
      <p className="agent-demo-stream">
        {introText}
        {isIntroStreaming ? <span className="agent-demo-stream__cursor" aria-hidden="true" /> : null}
      </p>

      {showHeader ? (
        <header className="agent-demo-result__header agent-demo-reveal" {...revealStyle(0)}>
          <div>
            <div className="agent-demo-result__eyebrow">Customer network analysis</div>
            <h3>8 likely apple buyers in Olivia Bennett's circle</h3>
          </div>
          {isRevealComplete ? (
            <span className="agent-demo-result__status">Ready for outreach</span>
          ) : (
            <span className="agent-demo-result__status agent-demo-result__status--pending">Generating…</span>
          )}
        </header>
      ) : null}

      {showStats ? (
        <div className="agent-demo-stats" aria-label="Lead search metrics">
          {visibleStatCount >= 1 ? (
            <div className="agent-demo-stat agent-demo-reveal" {...revealStyle(40)}>
              <span className="agent-demo-stat__value">1,273</span>
              <span className="agent-demo-stat__label">Connections in Olivia's circle</span>
            </div>
          ) : null}
          {visibleStatCount >= 2 ? (
            <div className="agent-demo-stat agent-demo-reveal" {...revealStyle(90)}>
              <span className="agent-demo-stat__value">276</span>
              <span className="agent-demo-stat__label">Retail and grocery profiles</span>
            </div>
          ) : null}
          {visibleStatCount >= 3 ? (
            <div className="agent-demo-stat agent-demo-reveal" {...revealStyle(140)}>
              <span className="agent-demo-stat__value">8</span>
              <span className="agent-demo-stat__label">Highest-probability buyers</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {showCustomer ? (
        <div className="agent-demo-customer agent-demo-reveal" {...revealStyle(0)}>
          <span>Closed customer</span>
          <strong>{demoClosedCustomer.name}</strong>
          <em>{demoClosedCustomer.role} at {demoClosedCustomer.company}</em>
        </div>
      ) : null}

      {showInsight ? (
        <div className="agent-demo-insight agent-demo-reveal" {...revealStyle(0)}>
          <span>Best path</span>
          Ask Olivia for warm introductions to the highest-ranked store buyers in her network.
        </div>
      ) : null}

      {showActions ? (
        <div className="agent-demo-actions agent-demo-reveal" aria-label="Email generation actions" {...revealStyle(0)}>
          <button type="button" onClick={() => setGeneratedEmail('intro')}>
            Generate email to Olivia for intro
          </button>
          <button type="button" onClick={() => setGeneratedEmail('outreach')}>
            Generate direct email to buyer
          </button>
        </div>
      ) : null}

      {generatedEmail ? (
        <div className="agent-demo-email agent-demo-reveal">
          <div className="agent-demo-section__head">
            <h4>
              {generatedEmail === 'intro'
                ? 'Intro request email to Olivia'
                : 'Direct email to Sarah'}
            </h4>
            <span>
              {generatedEmail === 'intro'
                ? 'Send to Olivia Bennett'
                : 'Send to Sarah Mitchell'}
            </span>
          </div>
          <div className="agent-demo-email__subject">
            <span>Subject</span>
            {generatedEmail === 'intro'
              ? 'Could you introduce me to Sarah Mitchell?'
              : 'Local apple supply for FreshLine Grocers'}
          </div>
          <pre>{generatedEmail === 'intro' ? demoIntroEmailBody : demoOutreachEmailBody}</pre>
        </div>
      ) : null}

      {showTable ? (
        <div className="agent-demo-table-wrap agent-demo-reveal" {...revealStyle(0)}>
          <table className="agent-demo-table">
            <thead>
              <tr>
                <th>Priority</th>
                <th>Person</th>
                <th>LinkedIn</th>
                <th>Email</th>
                <th>In Olivia's circle</th>
                <th>Works at</th>
                <th>Why this priority</th>
              </tr>
            </thead>
            <tbody>
              {demoCustomerCircleProspects.slice(0, visibleRowCount).map((prospect, index) => {
                const emailParts = splitEmail(prospect.email)
                return (
                  <tr key={prospect.email} className="agent-demo-reveal" {...revealStyle(index * 55)}>
                    <td>
                      <span className={`agent-demo-priority agent-demo-priority--${getDemoPriorityLabel(index).toLowerCase()}`}>
                        {index + 1} {getDemoPriorityLabel(index)}
                      </span>
                    </td>
                    <td>
                      <strong>{prospect.name}</strong>
                      <span>{prospect.title}</span>
                    </td>
                    <td>
                      <a className="agent-demo-link" href={prospect.linkedin} target="_blank" rel="noreferrer">
                        Open profile
                      </a>
                    </td>
                    <td>
                      <a className="agent-demo-email-link" href={`mailto:${prospect.email}`}>
                        <span>{emailParts.local}</span>
                        {emailParts.domain ? <span>@{emailParts.domain}</span> : null}
                      </a>
                    </td>
                    <td>{prospect.relationship}</td>
                    <td>{prospect.company}</td>
                    <td>{prospect.reason}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  )
}

export default function AgentPage({ onSwitchToBoard }: AgentPageProps) {
  const [threads, setThreads] = useState<ChatThread[]>(() => [createThread()])
  const [activeThreadId, setActiveThreadId] = useState<string>(() => threads[0]?.id ?? '')
  const [draft, setDraft] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const messagesScrollRef = useRef<HTMLDivElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const requestAbortRef = useRef<AbortController | null>(null)
  const openRouterReady = isOpenRouterConfigured()
  const isDemoDraft = isDemoReferralPrompt(draft)

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? threads[0] ?? null,
    [activeThreadId, threads],
  )

  const scrollDemoReportIntoView = useCallback(() => {
    window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    })
  }, [])

  useEffect(() => {
    const lastMessage = activeThread?.messages.at(-1)
    window.requestAnimationFrame(() => {
      if (lastMessage?.variant === 'demo-referral') {
        scrollDemoReportIntoView()
        return
      }
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    })
  }, [activeThread?.messages, isThinking])

  const isDemoThinkingLive = useMemo(
    () => activeThread?.messages.some(
      (message) => message.variant === 'demo-thinking'
        && message.demoThinkingSteps?.some((step) => step.status === 'active'),
    ) ?? false,
    [activeThread?.messages],
  )

  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`
  }, [draft])

  useEffect(() => () => {
    requestAbortRef.current?.abort()
  }, [])

  const handleNewChat = () => {
    requestAbortRef.current?.abort()
    requestAbortRef.current = null
    const thread = createThread()
    setThreads((current) => [thread, ...current])
    setActiveThreadId(thread.id)
    setDraft('')
    setIsThinking(false)
    setChatError(null)
    window.requestAnimationFrame(() => textareaRef.current?.focus())
  }

  const updateMessage = (threadId: string, messageId: string, patch: Partial<ChatMessage>) => {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId
          ? {
              ...thread,
              messages: thread.messages.map((message) =>
                message.id === messageId ? { ...message, ...patch } : message,
              ),
            }
          : thread,
      ),
    )
  }

  const toggleDemoThinkingCollapsed = (threadId: string, messageId: string) => {
    setThreads((current) =>
      current.map((thread) => {
        if (thread.id !== threadId) return thread
        return {
          ...thread,
          messages: thread.messages.map((message) => {
            if (message.id !== messageId || message.variant !== 'demo-thinking') return message
            return {
              ...message,
              demoThinkingCollapsed: !message.demoThinkingCollapsed,
            }
          }),
        }
      }),
    )
  }

  const appendMessage = (threadId: string, message: ChatMessage) => {
    setThreads((current) =>
      current
        .map((thread) =>
          thread.id === threadId
            ? {
                ...thread,
                messages: [...thread.messages, message],
                updatedAt: message.createdAt,
                title: thread.messages.length === 0 && message.role === 'user'
                  ? deriveTitle(message.content)
                  : thread.title,
              }
            : thread,
        )
        .sort((a, b) => b.updatedAt - a.updatedAt),
    )
  }

  const submitMessage = async (rawContent: string) => {
    const content = rawContent.trim()
    if (!content || !activeThread || isThinking) return

    const isDemoPrompt = isDemoReferralPrompt(content)
    if (!isDemoPrompt && !openRouterReady) {
      setChatError('This demo is prepared for the customer-network buyer search prompt.')
      return
    }

    const userMessage: ChatMessage = {
      id: createId('msg'),
      role: 'user',
      content,
      createdAt: Date.now(),
    }

    appendMessage(activeThread.id, userMessage)
    setDraft('')
    setChatError(null)
    setIsThinking(true)

    requestAbortRef.current?.abort()
    const controller = new AbortController()
    requestAbortRef.current = controller

    try {
      if (isDemoPrompt) {
        const thinkingMessageId = createId('msg')
        appendMessage(activeThread.id, {
          id: thinkingMessageId,
          role: 'assistant',
          content: '',
          createdAt: Date.now(),
          variant: 'demo-thinking',
          demoThinkingSteps: [{ label: DEMO_THINKING_STEPS[0].label, status: 'active' }],
          demoThinkingCollapsed: false,
        })

        await runDemoThinkingSequence(controller.signal, (steps) => {
          updateMessage(activeThread.id, thinkingMessageId, { demoThinkingSteps: steps })
          scrollDemoReportIntoView()
        })

        updateMessage(activeThread.id, thinkingMessageId, {
          demoThinkingCollapsed: true,
          demoThinkingHasBeenCollapsed: true,
        })

        appendMessage(activeThread.id, {
          id: createId('msg'),
          role: 'assistant',
          content: 'Customer network buyer table prepared.',
          createdAt: Date.now(),
          variant: 'demo-referral',
        })
        return
      }
      const reply = await completeOpenRouterChat(toApiMessages([...activeThread.messages, userMessage]), controller.signal)
      appendMessage(activeThread.id, {
        id: createId('msg'),
        role: 'assistant',
        content: reply,
        createdAt: Date.now(),
      })
    } catch (error) {
      if (controller.signal.aborted) return
      const message = error instanceof Error ? error.message : 'Agent chat failed.'
      setChatError(message)
      appendMessage(activeThread.id, {
        id: createId('msg'),
        role: 'assistant',
        content: `Sorry, the live chat fallback is unavailable.\n\n${message}`,
        createdAt: Date.now(),
      })
    } finally {
      if (requestAbortRef.current === controller) {
        requestAbortRef.current = null
      }
      setIsThinking(false)
    }
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    void submitMessage(draft)
  }

  const hasMessages = (activeThread?.messages.length ?? 0) > 0

  return (
    <div className="agent-shell is-sidebar-open">
      <div className="agent-board-surface" aria-hidden="true" />

      <header className="agent-toolbar" aria-label="Agent controls">
        <div className="agent-toolbar__left">
          <WorkspaceModeToggle
            mode="agent"
            onSwitchToBoard={onSwitchToBoard}
            onSwitchToAgent={() => undefined}
          />
        </div>
        <div className="agent-toolbar__right" />
      </header>

      <aside className="agent-sidebar" aria-label="Chat history">
          <div className="agent-sidebar__head">
            <span className="agent-sidebar__label">Chats</span>
            <button type="button" className="agent-sidebar__new" onClick={handleNewChat}>
              <PlusIcon />
              <span>New</span>
            </button>
          </div>

          <nav className="agent-chat-list">
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                className={`agent-chat-list__item ${thread.id === activeThread?.id ? 'is-active' : ''}`}
                onClick={() => {
                  setActiveThreadId(thread.id)
                  setDraft('')
                  setChatError(null)
                }}
              >
                <span className="agent-chat-list__title">{thread.title}</span>
              </button>
            ))}
          </nav>

          <p className="agent-sidebar__note">
            Demo customer-network buyer search is prepared locally.
          </p>
      </aside>

      <main className={`agent-stage ${hasMessages || isThinking ? 'has-thread' : 'is-empty'}`}>
        <div ref={messagesScrollRef} className="agent-messages" role="log" aria-live="polite" aria-relevant="additions">
          {!hasMessages && !isThinking ? (
            <div className="agent-empty">
              <img className="agent-empty__logo" src={sdnLogo} alt="" aria-hidden="true" />
              <div className="agent-empty__badge">Agent mode</div>
              <h2>How can I help with your network?</h2>
              <p>Type a message below to start chatting.</p>
            </div>
          ) : (
            <div className="agent-message-stack">
              {activeThread?.messages.map((message) => {
                if (message.variant === 'demo-thinking') {
                  return (
                    <DemoThinkingBlock
                      key={message.id}
                      message={message}
                      onToggle={() => toggleDemoThinkingCollapsed(activeThread.id, message.id)}
                    />
                  )
                }

                return (
                  <article
                    key={message.id}
                    className={`agent-message agent-message--${message.role} ${message.variant === 'demo-referral' ? 'agent-message--demo' : ''}`}
                  >
                    {message.role === 'assistant' ? (
                      <img className="agent-message__logo" src={sdnLogo} alt="" aria-hidden="true" />
                    ) : null}
                    <div className="agent-message__bubble">
                      {message.role === 'assistant' ? (
                        <div className="agent-message__meta">DataNode Agent</div>
                      ) : null}
                      {message.variant === 'demo-referral' ? (
                        <DemoReferralResult onRevealUpdate={scrollDemoReportIntoView} />
                      ) : (
                        <p>{message.content}</p>
                      )}
                    </div>
                  </article>
                )
              })}
              {isThinking && !isDemoThinkingLive ? (
                <article className="agent-message agent-message--assistant is-pending">
                  <img className="agent-message__logo" src={sdnLogo} alt="" aria-hidden="true" />
                  <div className="agent-message__bubble">
                    <div className="agent-message__meta">DataNode Agent</div>
                    <div className="agent-typing" aria-label="Assistant is typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                </article>
              ) : null}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <form className="agent-composer" onSubmit={handleSubmit}>
          <div className="agent-composer__dock">
            {chatError ? (
              <p className="agent-composer__error" role="alert">{chatError}</p>
            ) : null}
            <div className={`agent-composer__shell ${draft.trim() ? 'has-text' : ''}`}>
              <textarea
                ref={textareaRef}
                value={draft}
                rows={1}
                placeholder="Ask about your network…"
                aria-label="Message"
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault()
                    void submitMessage(draft)
                  }
                }}
              />
              <button
                type="submit"
                className="agent-composer__send"
                aria-label="Send message"
                disabled={!draft.trim() || isThinking || (!openRouterReady && !isDemoDraft)}
              >
                <SendIcon />
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  )
}
