import { useEffect, useState, type RefObject } from 'react'
import sdnLogo from '../../assets/sdn-logo.svg'
import { categoryLabel } from './navigation'
import type { Article } from './types'

interface DocsHeaderProps {
  isAuthenticated: boolean
  mobileNavOpen: boolean
  mobileNavTriggerRef: RefObject<HTMLButtonElement | null>
  onHome: () => void
  onContact: () => void
  onBoard: () => void
  onLogin: () => void
  onSignUp: () => void
  onToggleMobileNav: () => void
  query: string
  searchOpen: boolean
  searchRef: RefObject<HTMLDivElement | null>
  searchResults: Article[]
  onQueryChange: (query: string) => void
  onSearchOpenChange: (open: boolean) => void
  onSelectArticle: (id: string) => void
}

export default function DocsHeader({
  isAuthenticated,
  mobileNavOpen,
  mobileNavTriggerRef,
  onHome,
  onContact,
  onBoard,
  onLogin,
  onSignUp,
  onToggleMobileNav,
  query,
  searchOpen,
  searchRef,
  searchResults,
  onQueryChange,
  onSearchOpenChange,
  onSelectArticle,
}: DocsHeaderProps) {
  const [activeResultIndex, setActiveResultIndex] = useState(0)

  useEffect(() => {
    setActiveResultIndex(0)
  }, [query, searchResults.length])

  const activeResult = searchResults[activeResultIndex]
  const resultListOpen = searchOpen && query.trim().length > 0

  return (
    <header className="docs-header">
      <div className="docs-product-nav">
        <button type="button" className="docs-brand" onClick={onHome} aria-label="Social Datanode home">
          <img src={sdnLogo} alt="" aria-hidden="true" />
          <span className="docs-brand__product">Social Datanode</span>
          <span className="docs-brand__context">Developer docs</span>
        </button>

        <nav className="docs-public-links" aria-label="Public navigation">
          <a href="#docs" className="docs-public-link is-active" aria-current="page">Docs</a>
          <button type="button" className="docs-public-link" onClick={onContact}>Contact</button>
        </nav>

        <div className="docs-auth-actions">
          {isAuthenticated ? (
            <button type="button" className="docs-button docs-button--filled" onClick={onBoard}>Launch app</button>
          ) : (
            <>
              <button type="button" className="docs-button docs-button--text" onClick={onLogin}>Log in</button>
              <button type="button" className="docs-button docs-button--filled" onClick={onSignUp}>Sign up</button>
            </>
          )}
        </div>
      </div>

      <div className="docs-tools">
        <button
          ref={mobileNavTriggerRef}
          type="button"
          className="docs-nav-toggle"
          aria-expanded={mobileNavOpen}
          aria-controls="docs-sidebar"
          onClick={onToggleMobileNav}
        >
          <span className="docs-nav-toggle__icon" aria-hidden="true">☰</span>
          Contents
        </button>

        <div className="docs-search-wrapper" ref={searchRef}>
          <svg className="docs-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="search"
            role="combobox"
            placeholder="Search docs"
            className="docs-search-input"
            value={query}
            aria-label="Search documentation"
            aria-autocomplete="list"
            aria-expanded={resultListOpen}
            aria-controls="docs-search-results"
            aria-activedescendant={resultListOpen && activeResult ? `docs-search-result-${activeResult.id}` : undefined}
            onFocus={() => onSearchOpenChange(true)}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' && searchResults.length > 0) {
                event.preventDefault()
                setActiveResultIndex((index) => (index + 1) % searchResults.length)
              }
              if (event.key === 'ArrowUp' && searchResults.length > 0) {
                event.preventDefault()
                setActiveResultIndex((index) => (index - 1 + searchResults.length) % searchResults.length)
              }
              if (event.key === 'Enter' && activeResult) {
                event.preventDefault()
                onSelectArticle(activeResult.id)
              }
              if (event.key === 'Escape') {
                onQueryChange('')
                onSearchOpenChange(false)
              }
            }}
          />
          {query && (
            <button
              type="button"
              className="docs-search-clear"
              aria-label="Clear search"
              onClick={() => {
                onQueryChange('')
                onSearchOpenChange(false)
              }}
            >
              ×
            </button>
          )}
          {resultListOpen && (
            <div className="docs-search-dropdown" id="docs-search-results" role="listbox" aria-label="Documentation search results">
              {searchResults.length > 0 ? (
                searchResults.map((article, index) => (
                  <button
                    id={`docs-search-result-${article.id}`}
                    key={article.id}
                    type="button"
                    role="option"
                    aria-selected={index === activeResultIndex}
                    className={`docs-search-result ${index === activeResultIndex ? 'is-active' : ''}`}
                    onMouseEnter={() => setActiveResultIndex(index)}
                    onClick={() => onSelectArticle(article.id)}
                  >
                    <span className="docs-search-result__title">{article.title}</span>
                    <span className="docs-search-result__meta">{categoryLabel(article.category)}</span>
                  </button>
                ))
              ) : (
                <div className="docs-search-empty" role="status">No matches for “{query.trim()}”</div>
              )}
            </div>
          )}
          <span className="docs-search-count" aria-live="polite">
            {resultListOpen ? `${searchResults.length} search ${searchResults.length === 1 ? 'result' : 'results'}` : ''}
          </span>
        </div>
      </div>
    </header>
  )
}

