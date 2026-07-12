import type { ReactNode } from 'react'

export type DocsCategory = 'getting-started' | 'mcp' | 'cli' | 'api'

export type Article = {
  id: string
  category: DocsCategory
  title: string
  keywords: string[]
  badge?: 'get' | 'post' | 'delete'
  render: (copyFn: (text: string, message: string) => void) => ReactNode
}

export type NavGroup = {
  id: string
  title: string
  articleIds: string[]
}

export type NavSection = {
  title: string
  groups: NavGroup[]
  collapsible?: boolean
}

