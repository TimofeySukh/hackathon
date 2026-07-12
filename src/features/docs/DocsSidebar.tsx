import { useEffect, useRef } from 'react'
import { DOC_SECTIONS } from './navigation'
import type { Article } from './types'

interface DocsSidebarProps {
  activeArticleId: string
  articleById: Map<string, Article>
  collapsedGroups: Set<string>
  isOpen: boolean
  matchesSearch: (id: string) => boolean
  onClose: () => void
  onSelectArticle: (id: string) => void
  onToggleGroup: (id: string) => void
  triggerElement: HTMLButtonElement | null
}

export default function DocsSidebar({
  activeArticleId,
  articleById,
  collapsedGroups,
  isOpen,
  matchesSearch,
  onClose,
  onSelectArticle,
  onToggleGroup,
  triggerElement,
}: DocsSidebarProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const wasOpenRef = useRef(false)

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true
      const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 50)
      return () => window.clearTimeout(focusTimer)
    }
    if (wasOpenRef.current) {
      wasOpenRef.current = false
      triggerElement?.focus()
    }
  }, [isOpen, triggerElement])

  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return

      const focusable = Array.from(
        sidebarRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [],
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  return (
    <>
      <button
        type="button"
        className={`docs-nav-scrim ${isOpen ? 'is-open' : ''}`}
        aria-label="Close documentation contents"
        tabIndex={isOpen ? 0 : -1}
        onClick={onClose}
      />
      <aside
        ref={sidebarRef}
        id="docs-sidebar"
        className={`docs-sidebar ${isOpen ? 'is-open' : ''}`}
        role={isOpen ? 'dialog' : undefined}
        aria-modal={isOpen ? true : undefined}
        aria-label="Documentation contents"
      >
        <div className="docs-sidebar__mobile-header">
          <span>Contents</span>
          <button ref={closeButtonRef} type="button" className="docs-sidebar__close" onClick={onClose} aria-label="Close contents">×</button>
        </div>
        <nav aria-label="Documentation navigation">
          {DOC_SECTIONS.map((section) => {
            const visibleGroups = section.groups
              .map((group) => ({
                ...group,
                articles: group.articleIds
                  .map((id) => articleById.get(id))
                  .filter((article): article is Article => Boolean(article))
                  .filter((article) => matchesSearch(article.id)),
              }))
              .filter((group) => group.articles.length > 0)

            if (visibleGroups.length === 0) return null

            return (
              <section key={section.title} className="docs-sidebar-section" aria-labelledby={`docs-section-${section.title.replace(/\s+/g, '-').toLowerCase()}`}>
                <h2 id={`docs-section-${section.title.replace(/\s+/g, '-').toLowerCase()}`} className="docs-sidebar-section__title">{section.title}</h2>
                {visibleGroups.map((group) => {
                  const isCollapsed = section.collapsible && collapsedGroups.has(group.id)
                  return (
                    <div key={group.id} className="docs-sidebar-group">
                      {section.collapsible ? (
                        <button
                          type="button"
                          className="docs-sidebar-group__toggle"
                          aria-expanded={!isCollapsed}
                          onClick={() => onToggleGroup(group.id)}
                        >
                          <span>{group.title}</span>
                          <svg className={`docs-sidebar-group__chevron ${isCollapsed ? '' : 'is-open'}`} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </button>
                      ) : (
                        <div className="docs-sidebar-group__label">{group.title}</div>
                      )}
                      {!isCollapsed && (
                        <div className="docs-sidebar-list">
                          {group.articles.map((article) => (
                            <button
                              key={article.id}
                              type="button"
                              aria-current={activeArticleId === article.id ? 'page' : undefined}
                              className={`docs-sidebar-item ${activeArticleId === article.id ? 'is-active' : ''}`}
                              onClick={() => onSelectArticle(article.id)}
                            >
                              <span>{article.title.replace(/^(GET|POST|PUT|PATCH|DELETE)\s+/, '')}</span>
                              {article.badge && <span className={`docs-sidebar-item__badge ${article.badge}`}>{article.badge.toUpperCase()}</span>}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </section>
            )
          })}
        </nav>
      </aside>
    </>
  )
}
