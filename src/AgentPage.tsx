import { useEffect, useMemo, useRef, useState } from 'react'
import sdnLogo from './assets/sdn-logo.svg'
import WorkspaceModeToggle from './components/WorkspaceModeToggle'
import {
  completeOpenRouterChat,
  getOpenRouterModelLabel,
  isOpenRouterConfigured,
  type OpenRouterChatMessage,
} from './lib/openRouterChat'
import {
  buildAgentBoardToolInstructions,
  parseAgentBoardToolCall,
  runAgentBoardTool,
} from './lib/agentBoardContext'
import type { GraphState } from './lib/board/types'

type ChatRole = 'user' | 'assistant'

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  createdAt: number
}

type ChatThread = {
  id: string
  title: string
  messages: ChatMessage[]
  updatedAt: number
}

type AgentPageProps = {
  onSwitchToBoard: () => void
  graph: GraphState | null
}

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

const MAX_BOARD_TOOL_STEPS = 6

async function runBoardToolLoop(
  graph: GraphState,
  historyForApi: OpenRouterChatMessage[],
  signal: AbortSignal,
) {
  const loopMessages: OpenRouterChatMessage[] = [
    { role: 'system', content: buildAgentBoardToolInstructions(graph) },
    ...historyForApi,
  ]

  for (let step = 0; step < MAX_BOARD_TOOL_STEPS; step += 1) {
    const assistantContent = await completeOpenRouterChat(loopMessages, signal)
    const toolCall = parseAgentBoardToolCall(assistantContent)
    if (!toolCall) return assistantContent

    const toolResult = runAgentBoardTool(graph, toolCall)
    loopMessages.push({ role: 'assistant', content: assistantContent })
    loopMessages.push({
      role: 'user',
      content: [
        `Tool result for ${toolCall.name}:`,
        JSON.stringify(toolResult),
        'Use this observation to decide whether to call another board tool or answer the user. Do not call the same tool with the same arguments unless you need the next offset.',
      ].join('\n'),
    })
  }

  return 'I searched the board but reached the tool-step limit before producing a final answer. Try asking a narrower question.'
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

export default function AgentPage({ onSwitchToBoard, graph }: AgentPageProps) {
  const [threads, setThreads] = useState<ChatThread[]>(() => [createThread()])
  const [activeThreadId, setActiveThreadId] = useState<string>(() => threads[0]?.id ?? '')
  const [draft, setDraft] = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const requestAbortRef = useRef<AbortController | null>(null)
  const openRouterReady = isOpenRouterConfigured()
  const modelLabel = getOpenRouterModelLabel()
  const boardCountsLabel = graph
    ? `${graph.people.length} people · ${graph.circles.length} circles`
    : 'Board is loading'

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? threads[0] ?? null,
    [activeThreadId, threads],
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
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

    if (!openRouterReady) {
      setChatError('Add VITE_OPENROUTER_API_KEY to .env.local, then restart the dev server.')
      return
    }

    const userMessage: ChatMessage = {
      id: createId('msg'),
      role: 'user',
      content,
      createdAt: Date.now(),
    }

    const historyForApi = toApiMessages([...activeThread.messages, userMessage])

    appendMessage(activeThread.id, userMessage)
    setDraft('')
    setChatError(null)
    setIsThinking(true)

    requestAbortRef.current?.abort()
    const controller = new AbortController()
    requestAbortRef.current = controller

    try {
      const reply = graph
        ? await runBoardToolLoop(graph, historyForApi, controller.signal)
        : await completeOpenRouterChat([
            { role: 'system', content: 'The board is still loading. Say that board search is unavailable until loading finishes.' },
            ...historyForApi,
          ], controller.signal)
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
            {openRouterReady
              ? `Board tools connected: ${boardCountsLabel}.`
              : 'Add VITE_OPENROUTER_API_KEY to .env.local.'}
          </p>
      </aside>

      <main className={`agent-stage ${hasMessages || isThinking ? 'has-thread' : 'is-empty'}`}>
        <div className="agent-messages" role="log" aria-live="polite" aria-relevant="additions">
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
                  className={`agent-message agent-message--${message.role}`}
                >
                  {message.role === 'assistant' ? (
                    <img className="agent-message__logo" src={sdnLogo} alt="" aria-hidden="true" />
                  ) : null}
                  <div className="agent-message__bubble">
                    {message.role === 'assistant' ? (
                      <div className="agent-message__meta">DataNode Agent</div>
                    ) : null}
                    <p>{message.content}</p>
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
                disabled={!draft.trim() || isThinking || !openRouterReady}
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
