import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Session } from '@supabase/supabase-js'

import { SearchLabBoard } from './components/SearchLabBoard'
import { SearchLabPersonPanel } from './components/SearchLabPersonPanel'
import type { AgentDiscoveryResponse, AgentDiscoveryStep, DiscoveryPerson } from './lib/agentDiscovery'
import { totalDiscoveryPeople } from './lib/agentDiscovery'
import {
  buildResultsFocusGraph,
  discoveryGroupsFromResponse,
  discoveryMatchIds,
  highlightSearchMatches,
  layoutSyntheticGraphOnBoard,
} from './lib/search/syntheticBoardLayout'
import { formatPersonNoteLines, formatPersonNotesBlock } from './lib/search/personNotesDisplay'
import { runDiscoveryWithProgress, type DiscoveryEngine, type DiscoveryRunMeta } from './lib/search/runDiscoveryWithProgress'
import {
  buildSyntheticGraph,
  SEARCH_LAB_PRESETS,
  type SyntheticScale,
} from './lib/search/syntheticGraph'
import type { GraphState } from './lib/board/types'

type Props = {
  onBack: () => void
  session: Session | null
  isAuthenticated: boolean
}

type FlatResult = {
  query: string
  explanation: string
  steps: AgentDiscoveryStep[]
  results: Array<{
    id: string
    name: string
    subtitle: string
    aiReason: string
    confidence: number
  }>
}

type StepUiState = AgentDiscoveryStep & { status: 'active' | 'done' }

export default function SearchLabPage({ onBack, session, isAuthenticated }: Props) {
  const [scale, setScale] = useState<SyntheticScale>('small')
  const [organizeWithAi, setOrganizeWithAi] = useState(true)
  const [engine, setEngine] = useState<DiscoveryEngine>(() => (isAuthenticated ? 'llm' : 'local'))
  const [showFullNetwork, setShowFullNetwork] = useState(false)
  const [query, setQuery] = useState<string>(SEARCH_LAB_PRESETS[0].query)
  const [activePreset, setActivePreset] = useState<string>(SEARCH_LAB_PRESETS[0].id)
  const [loading, setLoading] = useState(false)
  const [discoveryData, setDiscoveryData] = useState<AgentDiscoveryResponse | null>(null)
  const [flatData, setFlatData] = useState<FlatResult | null>(null)
  const [highlightId, setHighlightId] = useState<string | null>(null)
  const [boardGraph, setBoardGraph] = useState<GraphState | null>(null)
  const [visibleSteps, setVisibleSteps] = useState<StepUiState[]>([])
  const [runMeta, setRunMeta] = useState<DiscoveryRunMeta | null>(null)
  const [runError, setRunError] = useState<string | null>(null)
  const [waitingMessage, setWaitingMessage] = useState<string | null>(null)
  const [hasRun, setHasRun] = useState(false)
  const [focusCircleIds, setFocusCircleIds] = useState<string[] | null>(null)
  const [searchMatchIds, setSearchMatchIds] = useState<string[]>([])
  const detailRef = useRef<HTMLDivElement>(null)
  const runTokenRef = useRef(0)

  const graphBundle = useMemo(() => {
    const bundle = buildSyntheticGraph(scale)
    const laidOut = layoutSyntheticGraphOnBoard({
      circles: bundle.circles,
      people: bundle.people,
      connections: bundle.connections ?? [],
    })
    return { ...bundle, ...laidOut }
  }, [scale])

  const { meta, ...baseGraph } = graphBundle
  const displayGraph = boardGraph ?? baseGraph

  const matchCount = organizeWithAi
    ? totalDiscoveryPeople(discoveryData?.groups ?? [])
    : flatData?.results.length ?? 0


  const lookupPerson = useCallback(
    (personId: string) => baseGraph.people.find((person) => person.id === personId),
    [baseGraph.people],
  )

  const selectedPerson = useMemo(() => {
    if (!highlightId) return null
    if (discoveryData) {
      for (const group of discoveryData.groups) {
        const person = group.people.find((entry) => entry.id === highlightId)
        if (person) return { person, groupLabel: group.label }
      }
    }
    const flat = flatData?.results.find((entry) => entry.id === highlightId)
    if (flat) return { person: flat as DiscoveryPerson, groupLabel: 'Matches' }
    return null
  }, [discoveryData, flatData, highlightId])

  const resetBoard = useCallback(() => {
    setBoardGraph(null)
    setDiscoveryData(null)
    setFlatData(null)
    setVisibleSteps([])
    setRunMeta(null)
    setRunError(null)
    setWaitingMessage(null)
    setHighlightId(null)
    setHasRun(false)
    setFocusCircleIds(null)
    setSearchMatchIds([])
    setShowFullNetwork(false)
  }, [])

  const runSearch = useCallback(() => {
    const trimmed = query.trim()
    if (!trimmed) return
    if (engine === 'llm' && !session) {
      setRunError('Sign in to use the LLM agent.')
      return
    }

    const token = runTokenRef.current + 1
    runTokenRef.current = token
    setLoading(true)
    setHighlightId(null)
    setVisibleSteps([])
    setRunMeta(null)
    setRunError(null)
    setWaitingMessage(null)
    setDiscoveryData(null)
    setFlatData(null)
    setBoardGraph(null)
    setFocusCircleIds(null)
    setSearchMatchIds([])

    void runDiscoveryWithProgress(
      baseGraph,
      trimmed,
      organizeWithAi,
      engine,
      session,
      (step, index, total) => {
        if (token !== runTokenRef.current) return
        setVisibleSteps((current) => {
          const done = current.map((entry) => ({ ...entry, status: 'done' as const }))
          return [...done, { ...step, status: index + 1 >= total ? 'done' : 'active' }]
        })
      },
      (message) => {
        if (token !== runTokenRef.current) return
        setWaitingMessage(message)
      },
    ).then(({ discovery, flat, meta: nextMeta }) => {
      if (token !== runTokenRef.current) return
      setWaitingMessage(null)

      if (nextMeta.error) {
        setRunError(nextMeta.error)
        setRunMeta(nextMeta)
        setLoading(false)
        return
      }

      if (organizeWithAi && discovery) {
        setDiscoveryData(discovery)
        const boardGroups = discoveryGroupsFromResponse(discovery.groups)
        const matchIds = discoveryMatchIds(boardGroups)
        setSearchMatchIds(matchIds)
        const focused = buildResultsFocusGraph(baseGraph, boardGroups)
        setBoardGraph(focused)
        setFocusCircleIds([
          'you',
          ...boardGroups.filter((group) => group.personIds.length > 0).map((group) => `discovery-${group.id}`),
        ])
      } else if (flat) {
        setFlatData(flat)
        const ids = flat.results.map((result) => result.id)
        setSearchMatchIds(ids)
        setBoardGraph(highlightSearchMatches(baseGraph, ids))
        setFocusCircleIds(ids.length > 0 ? ['you', ...new Set(flat.results.map((r) => {
          const person = baseGraph.people.find((p) => p.id === r.id)
          return person?.circleId ?? ''
        }).filter(Boolean))] : null)
      }

      setRunMeta(nextMeta)
      setHasRun(true)
      setLoading(false)
      setVisibleSteps((current) => current.map((entry) => ({ ...entry, status: 'done' as const })))
    })
  }, [baseGraph, engine, organizeWithAi, query, session])

  const applyFullNetworkToggle = useCallback((checked: boolean) => {
    setShowFullNetwork(checked)
    if (!hasRun || !discoveryData) return

    const boardGroups = discoveryGroupsFromResponse(discoveryData.groups)
    const matchIds = discoveryMatchIds(boardGroups)
    setSearchMatchIds(matchIds)

    if (checked) {
      setBoardGraph(highlightSearchMatches(
        layoutSyntheticGraphOnBoard(baseGraph),
        matchIds,
      ))
      setFocusCircleIds(null)
    } else {
      setBoardGraph(buildResultsFocusGraph(baseGraph, boardGroups))
      setFocusCircleIds([
        'you',
        ...boardGroups.filter((group) => group.personIds.length > 0).map((group) => `discovery-${group.id}`),
      ])
    }
  }, [baseGraph, discoveryData, hasRun])

  useEffect(() => {
    if (!highlightId || !detailRef.current) return
    detailRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [highlightId])

  return (
    <main className="search-lab-shell">
      <header className="search-lab-shell__header">
        <div>
          <p className="discovery-panel__eyebrow">Search Lab</p>
          <h1 className="search-lab-shell__title">Synthetic agent search</h1>
        </div>
        <div className="search-lab-shell__header-actions">
          <span className="search-lab-shell__engine-badge">
            {engine === 'llm' ? 'LLM agent' : 'Local harness'}
            {runMeta ? ` · ${runMeta.llmCalls} LLM call${runMeta.llmCalls === 1 ? '' : 's'}` : ''}
          </span>
          <button type="button" className="discovery-panel__close" onClick={onBack}>
            Back to board
          </button>
        </div>
      </header>

      <div className="search-lab-shell__body">
        <aside className="search-lab-shell__controls">
          <section className="search-lab__section">
            <h2 className="discovery-panel__section-title">Dataset</h2>
            <div className="search-lab__toggle-row">
              <button
                type="button"
                className={`search-lab__chip ${scale === 'small' ? 'is-active' : ''}`}
                onClick={() => { setScale('small'); resetBoard() }}
              >
                Small (~300)
              </button>
              <button
                type="button"
                className={`search-lab__chip ${scale === 'large' ? 'is-active' : ''}`}
                onClick={() => { setScale('large'); resetBoard() }}
              >
                Large (~3000)
              </button>
            </div>
            <p className="search-lab__stats">
              {meta.label} · {meta.peopleCount} people · {baseGraph.circles.length - 1} company circles
            </p>
          </section>

          <section className="search-lab__section">
            <h2 className="discovery-panel__section-title">Agent engine</h2>
            <div className="search-lab__toggle-row">
              <button
                type="button"
                className={`search-lab__chip ${engine === 'llm' ? 'is-active' : ''}`}
                disabled={!isAuthenticated}
                onClick={() => setEngine('llm')}
              >
                LLM agent
              </button>
              <button
                type="button"
                className={`search-lab__chip ${engine === 'local' ? 'is-active' : ''}`}
                onClick={() => setEngine('local')}
              >
                Local harness
              </button>
            </div>
            {!isAuthenticated ? (
              <p className="search-lab__hint">Sign in to enable LLM agent (OpenAI/Groq on server).</p>
            ) : (
              <p className="search-lab__hint">
                LLM: helper plans groups, worker matches batches, helper verifies. Local: deterministic rules only.
              </p>
            )}
          </section>

          <section className="search-lab__section">
            <h2 className="discovery-panel__section-title">Mode</h2>
            <label className="search-lab__switch">
              <span>Organize with AI (board graph)</span>
              <input
                type="checkbox"
                checked={organizeWithAi}
                onChange={(event) => setOrganizeWithAi(event.target.checked)}
              />
            </label>
            {hasRun && organizeWithAi ? (
              <label className="search-lab__switch">
                <span>Show full network</span>
                <input
                  type="checkbox"
                  checked={showFullNetwork}
                  onChange={(event) => applyFullNetworkToggle(event.target.checked)}
                />
              </label>
            ) : null}
            <p className="search-lab__hint">
              {organizeWithAi
                ? 'Agent creates discovery circles on the board and moves matches into them.'
                : 'Highlights matches on the full graph.'}
            </p>
          </section>

          <section className="search-lab__section">
            <h2 className="discovery-panel__section-title">Presets</h2>
            <div className="search-lab__presets">
              {SEARCH_LAB_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`search-lab__preset ${activePreset === preset.id ? 'is-active' : ''}`}
                  onClick={() => {
                    setActivePreset(preset.id)
                    setQuery(preset.query)
                    resetBoard()
                  }}
                >
                  <strong>{preset.label}</strong>
                  <span>{preset.query}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="search-lab__section">
            <h2 className="discovery-panel__section-title">Query</h2>
            <textarea
              className="search-lab__query"
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActivePreset('')
                resetBoard()
              }}
              placeholder="e.g. YC investors and AI speakers"
            />
            <button
              type="button"
              className="search-lab__run"
              disabled={loading || !query.trim()}
              onClick={runSearch}
            >
              {loading ? 'Running…' : 'Run search'}
            </button>
          </section>
        </aside>

        <div className="search-lab-shell__board">
          <SearchLabBoard
            graph={displayGraph}
            selectedPersonId={highlightId}
            onSelectPerson={setHighlightId}
            loading={loading}
            peopleCount={meta.peopleCount}
            focusCircleIds={hasRun && !showFullNetwork ? focusCircleIds : null}
            searchMatchPersonIds={hasRun ? searchMatchIds : []}
            totalMatchCount={matchCount}
          />
          {highlightId ? (
            <SearchLabPersonPanel
              person={lookupPerson(highlightId)}
              discoveryMeta={selectedPerson}
              onClose={() => setHighlightId(null)}
            />
          ) : null}
        </div>

        <aside className="discovery-panel__sidebar search-lab-shell__results">
          <div className="search-lab-shell__results-scroll">
            {loading ? (
              <div className="search-lab-shell__status">
                <span className="discovery-panel__spinner" aria-hidden="true" />
                <p>{waitingMessage ?? `Running ${engine === 'llm' ? 'LLM agent' : 'local harness'} on ${meta.peopleCount} profiles…`}</p>
              </div>
            ) : null}

            {runError ? (
              <div className="search-lab-shell__empty-results">
                <strong>LLM agent failed</strong>
                <p>{runError}</p>
              </div>
            ) : null}

            {runMeta && !runError ? (
              <div className="search-lab-shell__run-meta">
                <strong>{matchCount} match{matchCount === 1 ? '' : 'es'}</strong>
                <span>{runMeta.elapsedMs} ms · {runMeta.engine} · {runMeta.llmCalls} LLM call{runMeta.llmCalls === 1 ? '' : 's'}</span>
              </div>
            ) : null}

            {discoveryData?.explanation && !loading ? (
              <p className="search-lab-shell__explanation">{discoveryData.explanation}</p>
            ) : null}

            {visibleSteps.length > 0 ? (
              <div className="discovery-panel__steps">
                <h3 className="discovery-panel__section-title">Agent steps</h3>
                <ol className="discovery-panel__step-list">
                  {visibleSteps.map((step) => (
                    <li
                      key={step.id}
                      className={`discovery-panel__step search-lab-shell__step search-lab-shell__step--${step.status}`}
                    >
                      <strong>{step.label}</strong>
                      {step.detail ? <small>{step.detail}</small> : null}
                    </li>
                  ))}
                </ol>
              </div>
            ) : !loading && !hasRun ? (
              <div className="discovery-panel__detail discovery-panel__detail--empty">
                <h3 className="discovery-panel__section-title">Results</h3>
                <p>Run a query to see agent steps and matches here. Large graphs start zoomed out (zones only) — after search the camera focuses on discovery circles.</p>
              </div>
            ) : null}

            {hasRun && matchCount === 0 ? (
              <div className="search-lab-shell__empty-results">
                <strong>No matches</strong>
                <p>Local harness found nobody for this query. Try an English preset (e.g. “YC investors”) or add company/role keywords.</p>
              </div>
            ) : null}

            {discoveryData && matchCount > 0 ? (
              <div className="search-lab-shell__groups">
                {discoveryData.groups.map((group) => (
                  <section key={group.id} className="search-lab-shell__group">
                    <h3 className="discovery-panel__section-title">{group.label} ({group.people.length})</h3>
                    <ul className="search-lab-shell__match-list">
                      {group.people.map((person) => {
                        const noteLines = formatPersonNoteLines(lookupPerson(person.id)?.notes, 2)
                        return (
                          <li key={person.id}>
                            <button
                              type="button"
                              className={`search-lab-shell__match ${highlightId === person.id ? 'is-active' : ''}`}
                              onClick={() => setHighlightId(person.id)}
                            >
                              <strong>{person.name}</strong>
                              <span>{person.subtitle}</span>
                              {person.aiReason ? (
                                <span className="search-lab-shell__match-reason">{person.aiReason}</span>
                              ) : null}
                              {noteLines.map((line, noteIndex) => (
                                <span key={`${person.id}-note-${noteIndex}`} className="search-lab-shell__match-note">{line}</span>
                              ))}
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            ) : null}

            {flatData && flatData.results.length > 0 ? (
              <div className="search-lab-shell__groups">
                <section className="search-lab-shell__group">
                  <h3 className="discovery-panel__section-title">Matches ({flatData.results.length})</h3>
                  <ul className="search-lab-shell__match-list">
                    {flatData.results.map((person) => {
                      const noteLines = formatPersonNoteLines(lookupPerson(person.id)?.notes, 2)
                      return (
                        <li key={person.id}>
                          <button
                            type="button"
                            className={`search-lab-shell__match ${highlightId === person.id ? 'is-active' : ''}`}
                            onClick={() => setHighlightId(person.id)}
                          >
                            <strong>{person.name}</strong>
                            <span>{person.subtitle}</span>
                            {person.aiReason ? (
                              <span className="search-lab-shell__match-reason">{person.aiReason}</span>
                            ) : null}
                            {noteLines.map((line, noteIndex) => (
                              <span key={`${person.id}-note-${noteIndex}`} className="search-lab-shell__match-note">{line}</span>
                            ))}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </section>
              </div>
            ) : null}

            {selectedPerson ? (
              <div className="discovery-panel__detail" ref={detailRef}>
                <h3 className="discovery-panel__section-title">{selectedPerson.person.name}</h3>
                <p className="discovery-panel__detail-meta">{selectedPerson.groupLabel}</p>
                {'subtitle' in selectedPerson.person && selectedPerson.person.subtitle ? (
                  <p className="discovery-panel__detail-subtitle">{selectedPerson.person.subtitle}</p>
                ) : null}
                {'aiReason' in selectedPerson.person && selectedPerson.person.aiReason ? (
                  <p className="discovery-panel__detail-reason">{selectedPerson.person.aiReason}</p>
                ) : null}
                {formatPersonNotesBlock(lookupPerson(selectedPerson.person.id)?.notes).length > 0 ? (
                  <ul className="search-lab-shell__detail-notes">
                    {formatPersonNotesBlock(lookupPerson(selectedPerson.person.id)?.notes).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {discoveryData?.suggestions.length ? (
              <div className="discovery-panel__suggestions">
                <h3 className="discovery-panel__section-title">Try next</h3>
                <ul>
                  {discoveryData.suggestions.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  )
}
