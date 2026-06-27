import type { DiscoveryPerson } from '../lib/agentDiscovery'
import type { PersonNode } from '../lib/board/types'
import { formatPersonNotesBlock } from '../lib/search/personNotesDisplay'

type Props = {
  person: PersonNode | undefined
  discoveryMeta: { person: DiscoveryPerson; groupLabel: string } | null
  onClose: () => void
}

export function SearchLabPersonPanel({ person, discoveryMeta, onClose }: Props) {
  if (!person && !discoveryMeta) return null

  const name = person?.name ?? discoveryMeta?.person.name ?? 'Person'
  const subtitle = discoveryMeta?.person.subtitle ?? ''
  const aiReason = discoveryMeta?.person.aiReason ?? ''
  const groupLabel = discoveryMeta?.groupLabel ?? ''
  const notes = formatPersonNotesBlock(person?.notes)

  return (
    <aside className="search-lab-person-panel" aria-label={`Profile: ${name}`}>
      <header className="search-lab-person-panel__header">
        <h2 className="search-lab-person-panel__name">{name}</h2>
        <button type="button" className="search-lab-person-panel__close" onClick={onClose} aria-label="Close profile">
          ×
        </button>
      </header>
      {groupLabel ? <p className="search-lab-person-panel__meta">{groupLabel}</p> : null}
      {subtitle ? <p className="search-lab-person-panel__subtitle">{subtitle}</p> : null}
      {aiReason ? <p className="search-lab-person-panel__reason">{aiReason}</p> : null}
      {notes.length > 0 ? (
        <ul className="search-lab-person-panel__notes">
          {notes.map((line, index) => (
            <li key={`${line}-${index}`}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="search-lab-person-panel__empty">No notes on this profile.</p>
      )}
    </aside>
  )
}
