export type WorkspaceMode = 'board' | 'agent'

const STORAGE_KEY = 'datanode.workspaceMode'

export function readWorkspaceMode(): WorkspaceMode {
  if (typeof window === 'undefined') return 'board'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'agent' ? 'agent' : 'board'
}

export function writeWorkspaceMode(mode: WorkspaceMode): void {
  window.localStorage.setItem(STORAGE_KEY, mode)
}
