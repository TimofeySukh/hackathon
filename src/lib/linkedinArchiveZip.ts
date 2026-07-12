import type { Entry as ZipEntry } from '@zip.js/zip.js'

import { parseCSV, serializeCsvCell } from './csv'

export type LinkedInArchiveZipTexts = {
  connectionsText: string
  positionsText: string | null
  richMediaText: string | null
  recommendationsReceivedText: string | null
  recommendationsGivenText: string | null
  messagesText: string | null
  invitationsText: string | null
  sharesText: string | null
}

function findEntry(entries: ZipEntry[], fileName: string) {
  return entries.find((entry) => entry.filename === fileName || entry.filename.endsWith(`/${fileName}`)) ?? null
}

function isTextEntry(entry: ZipEntry): entry is ZipEntry & { getData: (writer: unknown) => Promise<unknown> } {
  return 'getData' in entry && typeof entry.getData === 'function'
}

async function readTextEntry(entry: ZipEntry): Promise<string> {
  if (!isTextEntry(entry)) throw new Error(`Could not read ${entry.filename}.`)
  const { TextWriter } = await import('@zip.js/zip.js')
  const data = await entry.getData(new TextWriter())
  if (typeof data !== 'string') throw new Error(`Could not read ${entry.filename}.`)
  return data
}

async function readOptionalEntry(entries: ZipEntry[], fileName: string): Promise<string | null> {
  const entry = findEntry(entries, fileName)
  return entry ? readTextEntry(entry) : null
}

function mergeMessageCsvTexts(primaryText: string | null, fallbackText: string | null) {
  if (!primaryText?.trim()) return fallbackText
  if (!fallbackText?.trim()) return primaryText

  const primaryRows = parseCSV(primaryText)
  const fallbackRows = parseCSV(fallbackText)
  const primaryHasData = primaryRows.length > 1
  const fallbackHasData = fallbackRows.length > 1
  if (primaryHasData && fallbackHasData) {
    return `${primaryText.trim()}\n${fallbackRows.slice(1).map((row) => row.map(serializeCsvCell).join(',')).join('\n')}`
  }
  return primaryHasData ? primaryText : fallbackText
}

export async function readLinkedInArchiveZip(file: File): Promise<LinkedInArchiveZipTexts> {
  const zip = await import('@zip.js/zip.js')
  zip.configure({ useWebWorkers: false })
  const zipReader = new zip.ZipReader(new zip.BlobReader(file))
  try {
    const entries = await zipReader.getEntries()
    const connectionsEntry = findEntry(entries, 'Connections.csv')
    if (!connectionsEntry) throw new Error('Could not find Connections.csv inside the ZIP file.')

    const [
      connectionsText,
      positionsText,
      richMediaText,
      recommendationsReceivedText,
      recommendationsGivenText,
      messagesText,
      guideMessagesText,
      invitationsText,
      sharesText,
    ] = await Promise.all([
      readTextEntry(connectionsEntry),
      readOptionalEntry(entries, 'Positions.csv'),
      readOptionalEntry(entries, 'Rich_Media.csv'),
      readOptionalEntry(entries, 'Recommendations_Received.csv'),
      readOptionalEntry(entries, 'Recommendations_Given.csv'),
      readOptionalEntry(entries, 'messages.csv'),
      readOptionalEntry(entries, 'guide_messages.csv'),
      readOptionalEntry(entries, 'Invitations.csv'),
      readOptionalEntry(entries, 'Shares.csv'),
    ])

    return {
      connectionsText,
      positionsText,
      richMediaText,
      recommendationsReceivedText,
      recommendationsGivenText,
      messagesText: mergeMessageCsvTexts(messagesText, guideMessagesText),
      invitationsText,
      sharesText,
    }
  } finally {
    await zipReader.close()
  }
}
