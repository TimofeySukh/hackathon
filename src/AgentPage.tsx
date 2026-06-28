import { useEffect, useMemo, useRef, useState } from 'react'
import sdnLogo from './assets/sdn-logo.svg'
import WorkspaceModeToggle from './components/WorkspaceModeToggle'
import {
  completeOpenRouterChat,
  getOpenRouterModelLabel,
  isOpenRouterConfigured,
  type OpenRouterChatMessage,
} from './lib/openRouterChat'

type ChatRole = 'user' | 'assistant'

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  createdAt: number
  variant?: 'demo-referral'
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

const demoSecondDegreeProspects = [
  {
    name: 'Sarah Mitchell',
    title: 'Fresh Produce Category Lead',
    company: 'Harvest Market',
    linkedin: 'linkedin.com/in/sarah-mitchell-produce',
    email: 'sarah.mitchell@harvestmarket.com',
    connectedThrough: 'Olivia Bennett',
    reason: 'Owns fruit buying for 42 stores and recently added local farm suppliers.',
  },
  {
    name: 'Daniel Brooks',
    title: 'Regional Procurement Manager',
    company: 'Green Basket Foods',
    linkedin: 'linkedin.com/in/daniel-brooks-grocery',
    email: 'daniel.brooks@greenbasketfoods.com',
    connectedThrough: 'Mark Feldman',
    reason: 'Runs produce vendor selection and has budget for seasonal apple contracts.',
  },
  {
    name: 'Emma Carter',
    title: 'Store Operations Director',
    company: 'Northside Grocers',
    linkedin: 'linkedin.com/in/emma-carter-retail',
    email: 'emma.carter@northsidegrocers.com',
    connectedThrough: 'Julia Stone',
    reason: 'Coordinates direct farm deliveries for a 19-store neighborhood chain.',
  },
  {
    name: 'Priya Nair',
    title: 'Founder',
    company: 'Corner Pantry',
    linkedin: 'linkedin.com/in/priya-nair-cornerpantry',
    email: 'priya@cornerpantry.co',
    connectedThrough: 'Noah Kim',
    reason: 'Promotes local farm products and buys weekly produce for three stores.',
  },
  {
    name: 'Jonas Weber',
    title: 'Produce Buyer',
    company: 'Urban Produce Co.',
    linkedin: 'linkedin.com/in/jonas-weber-produce',
    email: 'jonas.weber@urbanproduce.co',
    connectedThrough: 'Clara Jensen',
    reason: 'Supplies independent grocery stores and is expanding fruit assortment.',
  },
  {
    name: 'Lena Fischer',
    title: 'Retail Partnerships Lead',
    company: 'Daily Juice Bar',
    linkedin: 'linkedin.com/in/lena-fischer-juice',
    email: 'lena.fischer@dailyjuicebar.com',
    connectedThrough: 'Thomas Reed',
    reason: 'High apple usage for juice programs and recurring store replenishment.',
  },
  {
    name: 'Peter Novak',
    title: 'Supply Manager',
    company: 'Valley Market Group',
    linkedin: 'linkedin.com/in/peter-novak-supply',
    email: 'peter.novak@valleymarketgroup.com',
    connectedThrough: 'Marta Silva',
    reason: 'Buys bulk produce for convenience stores with weekly delivery cycles.',
  },
  {
    name: 'Aisha Khan',
    title: 'Fresh Food Program Manager',
    company: 'Bright Schools Market',
    linkedin: 'linkedin.com/in/aisha-khan-food',
    email: 'aisha.khan@brightschoolsmarket.org',
    connectedThrough: 'Ethan Morris',
    reason: 'Manages recurring fruit supply and prefers local seasonal vendors.',
  },
]

const demoIntroEmailBody = `Hi Olivia,

I noticed you are connected with Sarah Mitchell at Harvest Market. I am looking for retail produce buyers who may need a reliable local apple supplier this season.

Would you be comfortable making a quick intro?

A one-line forward is enough. I can follow up with availability, pricing, delivery windows, and sample crates.

Thanks again.`

const demoOutreachEmailBody = `Hi Sarah,

I am the Sales Director at a farm producing fresh apples for grocery and retail partners.

I saw that Harvest Market has been expanding local produce options. We can supply consistent seasonal apples with flexible delivery windows and clear wholesale pricing.

Would it be worth a quick call next week to see whether our apple supply fits your produce calendar?

Best,`

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
  const asksForSecondDegree =
    normalized.includes('second-degree') ||
    normalized.includes('second degree') ||
    normalized.includes('2nd degree') ||
    normalized.includes('second circle') ||
    normalized.includes('second network') ||
    normalized.includes('втором круг') ||
    normalized.includes('второго круг')
  const asksForRetailBuyers =
    normalized.includes('store') ||
    normalized.includes('grocery') ||
    normalized.includes('retail') ||
    normalized.includes('shop') ||
    normalized.includes('buyer') ||
    normalized.includes('магазин')
  const legacyReferralPrompt =
    (normalized.includes('deal') || normalized.includes('сделк')) &&
    (normalized.includes('linkedin') || normalized.includes('линкет') || normalized.includes('линкед')) &&
    (normalized.includes('connection') || normalized.includes('конекш') || normalized.includes('первом круг'))

  return hasAppleFarmContext && ((asksForSecondDegree && asksForRetailBuyers) || legacyReferralPrompt)
}

function getDemoPriorityLabel(index: number): string {
  if (index < 2) return 'High'
  if (index < 5) return 'Medium'
  return 'Watch'
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms)
  })
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

function DemoReferralResult() {
  const [generatedEmail, setGeneratedEmail] = useState<'intro' | 'outreach' | null>(null)

  return (
    <section className="agent-demo-result" aria-label="Second-degree sales lead report">
      <header className="agent-demo-result__header">
        <div>
          <div className="agent-demo-result__eyebrow">Second-degree sales lead search</div>
          <h3>8 priority retail buyers for apple supply</h3>
        </div>
        <span className="agent-demo-result__status">Demo data</span>
      </header>

      <div className="agent-demo-stats" aria-label="Lead search metrics">
        <div className="agent-demo-stat">
          <span className="agent-demo-stat__value">14,892</span>
          <span className="agent-demo-stat__label">Second-degree profiles scanned</span>
        </div>
        <div className="agent-demo-stat">
          <span className="agent-demo-stat__value">1,086</span>
          <span className="agent-demo-stat__label">Store and retail operators</span>
        </div>
        <div className="agent-demo-stat">
          <span className="agent-demo-stat__value">8</span>
          <span className="agent-demo-stat__label">Highest-probability buyers</span>
        </div>
      </div>

      <div className="agent-demo-insight">
        <span>Best path</span>
        Start with Sarah Mitchell through Olivia Bennett, then run direct outreach to the remaining store buyers.
      </div>

      <div className="agent-demo-actions" aria-label="Email generation actions">
        <button type="button" onClick={() => setGeneratedEmail('intro')}>
          Generate intro email to first-degree contact
        </button>
        <button type="button" onClick={() => setGeneratedEmail('outreach')}>
          Generate outreach email to second-degree buyer
        </button>
      </div>

      {generatedEmail ? (
        <div className="agent-demo-email">
          <div className="agent-demo-section__head">
            <h4>
              {generatedEmail === 'intro'
                ? 'Intro email to first-degree contact'
                : 'Direct email to second-degree buyer'}
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
              ? 'Quick intro to Sarah at Harvest Market'
              : 'Local apple supply for Harvest Market'}
          </div>
          <pre>{generatedEmail === 'intro' ? demoIntroEmailBody : demoOutreachEmailBody}</pre>
        </div>
      ) : null}

      <div className="agent-demo-table-wrap">
        <table className="agent-demo-table">
          <thead>
            <tr>
              <th>Priority</th>
              <th>Person</th>
              <th>LinkedIn</th>
              <th>Email</th>
              <th>Connected through</th>
              <th>Works at</th>
              <th>Why this priority</th>
            </tr>
          </thead>
          <tbody>
            {demoSecondDegreeProspects.map((prospect, index) => (
              <tr key={prospect.email}>
                <td>
                  <span className={`agent-demo-priority agent-demo-priority--${getDemoPriorityLabel(index).toLowerCase()}`}>
                    {index + 1} {getDemoPriorityLabel(index)}
                  </span>
                </td>
                <td>
                  <strong>{prospect.name}</strong>
                  <span>{prospect.title}</span>
                </td>
                <td>{prospect.linkedin}</td>
                <td>{prospect.email}</td>
                <td>{prospect.connectedThrough}</td>
                <td>{prospect.company}</td>
                <td>{prospect.reason}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  const modelLabel = getOpenRouterModelLabel()
  const isDemoDraft = isDemoReferralPrompt(draft)

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? threads[0] ?? null,
    [activeThreadId, threads],
  )

  useEffect(() => {
    const lastMessage = activeThread?.messages.at(-1)
    window.requestAnimationFrame(() => {
      if (lastMessage?.variant === 'demo-referral') {
        messagesScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
        return
      }
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    })
  }, [activeThread?.messages, isThinking])

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
      setChatError('Add VITE_OPENROUTER_API_KEY to .env.local, then restart the dev server.')
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
        await wait(650)
        appendMessage(activeThread.id, {
          id: createId('msg'),
          role: 'assistant',
          content: 'Second-degree retail buyer table prepared.',
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
        content: `Sorry, I could not reach OpenRouter.\n\n${message}`,
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
        <div className="agent-toolbar__right">
          <span className="agent-model-chip">{modelLabel}</span>
        </div>
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
            Demo second-degree lead search is prepared locally. Other chats use OpenRouter when configured.
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
              {activeThread?.messages.map((message) => (
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
                      <DemoReferralResult />
                    ) : (
                      <p>{message.content}</p>
                    )}
                  </div>
                </article>
              ))}
              {isThinking ? (
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
