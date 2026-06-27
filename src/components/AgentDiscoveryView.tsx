import { useMemo, useState } from 'react'

import type { AgentDiscoveryResponse, DiscoveryGroup, DiscoveryPerson } from '../lib/agentDiscovery'
import { formatPersonNotesBlock } from '../lib/search/personNotesDisplay'

const TONE_COLORS: Record<DiscoveryGroup['tone'], { fill: string; stroke: string; soft: string }> = {
  blue: { fill: '#00629d', stroke: '#004a77', soft: 'rgba(0, 98, 157, 0.12)' },
  green: { fill: '#006e26', stroke: '#005316', soft: 'rgba(0, 110, 38, 0.12)' },
  amber: { fill: '#8f4f00', stroke: '#6b3a00', soft: 'rgba(143, 79, 0, 0.12)' },
  violet: { fill: '#5b4b8a', stroke: '#433668', soft: 'rgba(91, 75, 138, 0.12)' },
  red: { fill: '#ba1a1a', stroke: '#930000', soft: 'rgba(186, 26, 26, 0.12)' },
}

type Props = {
  data: AgentDiscoveryResponse | null
  loading: boolean
  error: string | null
  onClose: () => void
  onSelectPerson: (personId: string) => void
  onRetry?: () => void
  /** Inline in Search Lab instead of full-screen overlay */
  embedded?: boolean
  hideClose?: boolean
  eyebrow?: string
}

function toSvg(value: number) {
  return Math.round(value * 1000)
}

function DiscoveryPersonNode({
  person,
  tone,
  selected,
  onSelect,
}: {
  person: DiscoveryPerson
  tone: DiscoveryGroup['tone']
  selected: boolean
  onSelect: () => void
}) {
  const colors = TONE_COLORS[tone]
  const cx = toSvg(person.x)
  const cy = toSvg(person.y)
  const r = selected ? 14 : 11

  return (
    <g className="discovery-node" onClick={onSelect} role="button" tabIndex={0} onKeyDown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        onSelect()
      }
    }}>
      <circle cx={cx} cy={cy} r={r + 6} fill={colors.soft} />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={colors.fill}
        stroke={selected ? 'var(--md-on-surface)' : colors.stroke}
        strokeWidth={selected ? 2.5 : 1.5}
      />
      <text x={cx} y={cy + r + 16} className="discovery-node__label" textAnchor="middle">
        {person.name.length > 18 ? `${person.name.slice(0, 16)}…` : person.name}
      </text>
    </g>
  )
}

export function AgentDiscoveryView({
  data,
  loading,
  error,
  onClose,
  onSelectPerson,
  onRetry,
  embedded = false,
  hideClose = false,
  eyebrow = 'People discovery',
}: Props) {
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null)

  const selectedPerson = (() => {
    if (!data || !selectedPersonId) return null
    for (const group of data.groups) {
      const person = group.people.find((entry) => entry.id === selectedPersonId)
      if (person) return { person, group }
    }
    return null
  })()

  const groupLayouts = useMemo(() => {
    if (!data) return []
    return data.groups.map((group) => {
      if (group.people.length === 0) {
        return { group, cx: 500, cy: 400, ringR: 0 }
      }
      const xs = group.people.map((person) => person.x)
      const ys = group.people.map((person) => person.y)
      const cx = toSvg(xs.reduce((sum, value) => sum + value, 0) / xs.length)
      const cy = toSvg(ys.reduce((sum, value) => sum + value, 0) / ys.length)
      const maxDist = Math.max(
        ...group.people.map((person) => Math.hypot(toSvg(person.x) - cx, toSvg(person.y) - cy)),
        40,
      )
      return { group, cx, cy, ringR: maxDist + 28 }
    })
  }, [data])

  return (
    <section
      className={`discovery-panel ${embedded ? 'discovery-panel--embedded' : ''}`}
      aria-label="People discovery map"
    >
      <header className="discovery-panel__header">
        <div className="discovery-panel__title-block">
          <p className="discovery-panel__eyebrow">{eyebrow}</p>
          <h2 className="discovery-panel__title">{data?.query ?? 'Discovering people…'}</h2>
          {data?.explanation ? (
            <p className="discovery-panel__subtitle">{data.explanation}</p>
          ) : null}
          {data?.llmProviders?.length ? (
            <p className="discovery-panel__provider">
              {data.llmProviders.join(', ')} · {data.llmCalls ?? 0} LLM call{data.llmCalls === 1 ? '' : 's'}
            </p>
          ) : null}
        </div>
        {!hideClose ? (
          <button type="button" className="discovery-panel__close" onClick={onClose} aria-label="Close discovery map">
            Close
          </button>
        ) : null}
      </header>

      <div className="discovery-panel__body">
        <div className="discovery-panel__map-wrap">
          {loading ? (
            <div className="discovery-panel__status" aria-live="polite">
              <span className="discovery-panel__spinner" aria-hidden="true" />
              <p>Scanning {data?.totalScanned ? `${data.totalScanned} profiles` : 'your graph'}…</p>
            </div>
          ) : error ? (
            <div className="discovery-panel__status discovery-panel__status--error" aria-live="polite">
              <p>{error}</p>
              {onRetry ? (
                <button type="button" className="discovery-panel__retry" onClick={onRetry}>
                  Try again
                </button>
              ) : null}
            </div>
          ) : data ? (
            <svg className="discovery-panel__map" viewBox="0 0 1000 800" role="img" aria-label="Discovery cluster map">
              <circle cx="500" cy="400" r="360" className="discovery-map__backdrop" />
              {groupLayouts.map(({ group, cx, cy, ringR }) => {
                const colors = TONE_COLORS[group.tone]
                if (group.people.length === 0) return null
                return (
                  <g key={group.id}>
                    <circle cx={cx} cy={cy} r={ringR} fill={colors.soft} stroke={colors.stroke} strokeWidth={1.5} strokeDasharray="6 6" />
                    <text x={cx} y={cy - ringR - 10} className="discovery-map__group-label" textAnchor="middle">
                      {group.label}
                    </text>
                  </g>
                )
              })}
              {data.groups.length > 1 ? (
                <text x="500" y="400" className="discovery-map__center-label" textAnchor="middle" dominantBaseline="middle">
                  {data.query.length > 42 ? `${data.query.slice(0, 40)}…` : data.query}
                </text>
              ) : null}
              {data.groups.flatMap((group) =>
                group.people.map((person) => (
                  <DiscoveryPersonNode
                    key={person.id}
                    person={person}
                    tone={group.tone}
                    selected={selectedPersonId === person.id}
                    onSelect={() => setSelectedPersonId(person.id)}
                  />
                )),
              )}
            </svg>
          ) : null}
        </div>

        <aside className="discovery-panel__sidebar">
          {data && data.steps.length > 0 ? (
            <div className="discovery-panel__steps">
              <h3 className="discovery-panel__section-title">Agent steps</h3>
              <ol className="discovery-panel__step-list">
                {data.steps.map((step) => (
                  <li key={step.id} className="discovery-panel__step">
                    <span>{step.label}</span>
                    {step.detail ? <small>{step.detail}</small> : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}

          {selectedPerson ? (
            <div className="discovery-panel__detail">
              <h3 className="discovery-panel__section-title">{selectedPerson.person.name}</h3>
              <p className="discovery-panel__detail-meta">{selectedPerson.group.label}</p>
              {selectedPerson.person.subtitle ? (
                <p className="discovery-panel__detail-subtitle">{selectedPerson.person.subtitle}</p>
              ) : null}
              <p className="discovery-panel__detail-reason">{selectedPerson.person.aiReason}</p>
              {formatPersonNotesBlock(selectedPerson.person.notes).length > 0 ? (
                <div className="discovery-panel__detail-block">
                  <h4 className="discovery-panel__detail-heading">Notes</h4>
                  <ul className="discovery-panel__notes">
                    {formatPersonNotesBlock(selectedPerson.person.notes).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="discovery-panel__detail-empty">No notes on this profile.</p>
              )}
              {selectedPerson.person.links?.length ? (
                <div className="discovery-panel__detail-block">
                  <h4 className="discovery-panel__detail-heading">Links</h4>
                  <ul className="discovery-panel__links">
                    {selectedPerson.person.links.map((link) => (
                      <li key={link.id}>
                        <a href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <button
                type="button"
                className="discovery-panel__open-person"
                onClick={() => onSelectPerson(selectedPerson.person.id)}
              >
                {embedded ? 'Highlight in list' : 'Open on board'}
              </button>
            </div>
          ) : (
            <div className="discovery-panel__detail discovery-panel__detail--empty">
              <h3 className="discovery-panel__section-title">Select a person</h3>
              <p>Click a node on the map to see why the agent picked them.</p>
            </div>
          )}

          {data && data.suggestions.length > 0 ? (
            <div className="discovery-panel__suggestions">
              <h3 className="discovery-panel__section-title">Try next</h3>
              <ul>
                {data.suggestions.map((suggestion) => (
                  <li key={suggestion}>{suggestion}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  )
}
