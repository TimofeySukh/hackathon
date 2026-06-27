/**
 * Build an eval graph from a LinkedIn Basic Data Export zip (~3k connections).
 * Ground truth comes from Position + Company only (no private notes).
 */

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import {
  ensureSearchSummaries,
} from './synthetic-search-graph.mjs'

function slugifyId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'item'
}

function makeUniqueId(baseId, existingIds) {
  if (!existingIds.has(baseId)) return baseId
  let index = 2
  while (existingIds.has(`${baseId}-${index}`)) index += 1
  return `${baseId}-${index}`
}

function parseCSV(text) {
  const lines = []
  let row = []
  let inQuotes = false
  let currentValue = ''

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentValue += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentValue.trim())
      currentValue = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i += 1
      row.push(currentValue.trim())
      if (row.length > 0 && row.some((val) => val !== '')) lines.push(row)
      row = []
      currentValue = ''
    } else {
      currentValue += char
    }
  }

  if (currentValue || row.length > 0) {
    row.push(currentValue.trim())
    if (row.some((val) => val !== '')) lines.push(row)
  }
  return lines
}

function findHeaderIndex(rows) {
  for (let index = 0; index < rows.length; index += 1) {
    const normalized = rows[index].map((cell) => cell.toLowerCase().replace(/\s+/g, ''))
    if (normalized.includes('firstname') && normalized.includes('lastname') && normalized.includes('company')) {
      return index
    }
  }
  return -1
}

function readConnectionsCsvFromZip(zipPath) {
  if (!fs.existsSync(zipPath)) {
    throw new Error(`LinkedIn export not found: ${zipPath}`)
  }
  return execFileSync('unzip', ['-p', zipPath, 'Connections.csv'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
}

function isFounder(position) {
  return /\bco-?found(er|ing)\b/i.test(position) || /\bfound(er|ing)\b/i.test(position)
}

function isAgileCoach(position) {
  return /agile coach/i.test(position)
}

function isSoftwareEngineerAt(position, company, companyNeedle) {
  const co = company.toLowerCase()
  const pos = position.toLowerCase()
  return co.includes(companyNeedle) && /software engineer/.test(pos)
}

/** Pick the company with the most "software engineer" titles for company-scoped eval. */
export function pickEngineerCompanyTag(rows, headers) {
  const counts = new Map()
  for (const row of rows) {
    const company = row[headers.companyIdx]?.trim() || ''
    const position = headers.positionIdx !== -1 ? row[headers.positionIdx] || '' : ''
    if (!company || !/software engineer/i.test(position)) continue
    counts.set(company, (counts.get(company) ?? 0) + 1)
  }
  let best = { company: '', needle: '', count: 0 }
  for (const [company, count] of counts) {
    if (count > best.count) {
      best = { company, needle: company.toLowerCase(), count }
    }
  }
  if (best.count === 0) best = { company: 'Yandex', needle: 'yandex', count: 0 }
  return best
}

export function buildGraphFromLinkedInZip(zipPath) {
  const csvText = readConnectionsCsvFromZip(zipPath)
  const rows = parseCSV(csvText)
  if (rows.length === 0) throw new Error('Connections.csv is empty or invalid.')

  const headerIdx = findHeaderIndex(rows)
  if (headerIdx === -1) throw new Error('Could not find standard headers in Connections.csv.')

  const headers = rows[headerIdx].map((cell) => cell.toLowerCase().replace(/\s+/g, ''))
  const headerIdxMap = {
    firstNameIdx: headers.indexOf('firstname'),
    lastNameIdx: headers.indexOf('lastname'),
    companyIdx: headers.indexOf('company'),
    positionIdx: headers.indexOf('position'),
    urlIdx: headers.indexOf('url'),
  }
  const dataRows = rows.slice(headerIdx + 1)
  const requiredWidth = Math.max(headerIdxMap.firstNameIdx, headerIdxMap.lastNameIdx, headerIdxMap.companyIdx)

  const circles = [{ id: 'you', name: 'You', parentId: null }]
  const circlesById = new Map(circles.map((c) => [c.id, c]))
  const people = []
  const existingPersonIds = new Set()

  const tags = {
    founders: new Set(),
    agileCoaches: new Set(),
    companyEngineers: new Set(),
  }

  const engineerCompany = pickEngineerCompanyTag(dataRows, headerIdxMap)
  tags._engineerCompany = engineerCompany

  for (const row of dataRows) {
    if (row.length <= requiredWidth) continue
    const firstName = row[headerIdxMap.firstNameIdx] || ''
    const lastName = row[headerIdxMap.lastNameIdx] || ''
    const name = `${firstName} ${lastName}`.trim()
    if (!name) continue

    const companyRaw = row[headerIdxMap.companyIdx]?.trim() || ''
    const companyName = companyRaw || 'No Company'
    const companyId = `linkedin-company-${slugifyId(companyName)}`
    if (!circlesById.has(companyId)) {
      const circle = { id: companyId, name: companyName, parentId: null }
      circles.push(circle)
      circlesById.set(companyId, circle)
    }

    const position = headerIdxMap.positionIdx !== -1 ? row[headerIdxMap.positionIdx] || '' : ''
    const basePersonId = `linkedin-person-${slugifyId(name)}`
    const personId = makeUniqueId(basePersonId, existingPersonIds)
    existingPersonIds.add(personId)

    const notes = position
      ? [{ id: `${personId}-pos`, title: 'Position', body: position }]
      : []

    people.push({ id: personId, name, circleId: companyId, notes })

    if (isFounder(position)) tags.founders.add(personId)
    if (isAgileCoach(position)) tags.agileCoaches.add(personId)
    if (isSoftwareEngineerAt(position, companyName, engineerCompany.needle)) {
      tags.companyEngineers.add(personId)
    }
  }

  const graph = {
    source: 'linkedin',
    circles,
    people,
    tags,
    meta: {
      zipPath,
      engineerCompany: engineerCompany.company,
      engineerCount: tags.companyEngineers.size,
    },
  }
  ensureSearchSummaries(graph)
  return graph
}

export function linkedInEvalCases(graph) {
  const co = graph.tags._engineerCompany?.company ?? 'Yandex'
  return [
    {
      id: 'founders',
      text: 'find founders and co-founders',
      wantMultiple: true,
      expectedIds: graph.tags.founders,
      minRecall: 0.95,
    },
    {
      id: 'agile-coaches',
      text: 'agile coaches',
      wantMultiple: true,
      expectedIds: graph.tags.agileCoaches,
      minRecall: 1,
    },
    {
      id: 'company-engineers',
      text: `software engineers at ${co}`,
      wantMultiple: true,
      expectedIds: graph.tags.companyEngineers,
      minRecall: 1,
    },
  ]
}
