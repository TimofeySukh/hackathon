type WorkspaceModeToggleProps = {
  mode: 'board' | 'agent'
  onSwitchToBoard: () => void
  onSwitchToAgent: () => void
  className?: string
}

function BoardIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="12" cy="18" r="3" />
      <path d="M8.5 7.5 10.5 15" />
      <path d="M15.5 7.5 13.5 15" />
    </svg>
  )
}

function AgentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a7 7 0 0 0-4 12.7V19a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.3A7 7 0 0 0 12 3Z" />
      <path d="M9 22h6" />
    </svg>
  )
}

export default function WorkspaceModeToggle({
  mode,
  onSwitchToBoard,
  onSwitchToAgent,
  className = '',
}: WorkspaceModeToggleProps) {
  const isBoard = mode === 'board'

  return (
    <button
      type="button"
      className={`workspace-mode-toggle ${className}`.trim()}
      onClick={isBoard ? onSwitchToAgent : onSwitchToBoard}
      aria-label={isBoard ? 'Switch to agent chat' : 'Switch to board'}
      title={isBoard ? 'Agent chat' : 'Board'}
    >
      {isBoard ? <AgentIcon /> : <BoardIcon />}
      <span>{isBoard ? 'Agent' : 'Board'}</span>
    </button>
  )
}
