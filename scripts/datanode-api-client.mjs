export function getConfig() {
  const apiUrl = process.env.DATANODE_API_URL?.replace(/\/$/, '')
  const token = process.env.DATANODE_API_TOKEN
  if (!apiUrl || !token) {
    throw new Error('Set DATANODE_API_URL and DATANODE_API_TOKEN.')
  }
  return { apiUrl, token }
}

export async function datanodeFetch(path, options = {}) {
  const { apiUrl, token } = getConfig()
  const response = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = payload?.error || `DataNode API returned ${response.status}`
    const error = new Error(message)
    error.status = response.status
    error.payload = payload
    throw error
  }
  return payload
}

export async function getMeta() {
  return await datanodeFetch('/graph/meta')
}

export async function search(query, limit = 10) {
  return await datanodeFetch(`/search?q=${encodeURIComponent(query)}&limit=${encodeURIComponent(String(limit))}`)
}

export async function batchSearch(queries, limit = 10) {
  return await datanodeFetch('/search/batch', {
    method: 'POST',
    body: JSON.stringify({ queries, limit }),
  })
}

export async function smartSearch(query, limit = 10) {
  return await datanodeFetch('/search/smart', {
    method: 'POST',
    body: JSON.stringify({ query, limit }),
  })
}

export async function discoverPeople(query, perGroupLimit) {
  const body = { query }
  if (perGroupLimit != null && Number.isFinite(Number(perGroupLimit))) {
    body.perGroupLimit = Number(perGroupLimit)
  }
  return await datanodeFetch('/search/discover', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function discoverPeopleLab(query, graph, perGroupLimit) {
  const body = { query, graph }
  if (perGroupLimit != null) body.perGroupLimit = perGroupLimit
  return await datanodeFetch('/search/discover-lab', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function listCircles() {
  return await datanodeFetch('/circles')
}

export async function createPerson(input) {
  return await datanodeFetch('/people', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function getPerson(personId, options = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined) params.set(key, String(value))
  }
  const suffix = params.toString() ? `?${params.toString()}` : ''
  return await datanodeFetch(`/people/${encodeURIComponent(personId)}${suffix}`)
}

export async function getPeople(ids, options = {}) {
  return await datanodeFetch('/people/batch', {
    method: 'POST',
    body: JSON.stringify({ ids, ...options }),
  })
}

export async function importLinkedInPerson(input) {
  return await datanodeFetch('/people/import-linkedin', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function addNote(personId, input) {
  return await datanodeFetch(`/people/${encodeURIComponent(personId)}/notes`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function addLink(personId, input) {
  return await datanodeFetch(`/people/${encodeURIComponent(personId)}/links`, {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function createConnection(input) {
  return await datanodeFetch('/connections', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function batchOperations(input) {
  return await datanodeFetch('/operations', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function deletePerson(personId, input) {
  return await datanodeFetch(`/people/${encodeURIComponent(personId)}`, {
    method: 'DELETE',
    body: JSON.stringify(input),
  })
}

export async function deleteNote(personId, noteId, input) {
  return await datanodeFetch(`/people/${encodeURIComponent(personId)}/notes/${encodeURIComponent(noteId)}`, {
    method: 'DELETE',
    body: JSON.stringify(input),
  })
}

export async function deleteLink(personId, linkId, input) {
  return await datanodeFetch(`/people/${encodeURIComponent(personId)}/links/${encodeURIComponent(linkId)}`, {
    method: 'DELETE',
    body: JSON.stringify(input),
  })
}

export async function deleteConnection(connectionId, input) {
  return await datanodeFetch(`/connections/${encodeURIComponent(connectionId)}`, {
    method: 'DELETE',
    body: JSON.stringify(input),
  })
}

export async function exportGraph() {
  return await datanodeFetch('/graph')
}

export async function importGraph(input) {
  return await datanodeFetch('/graph', {
    method: 'PUT',
    body: JSON.stringify(input),
  })
}

export async function clearGraph(input) {
  return await datanodeFetch('/graph/clear', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function createCircle(input) {
  return await datanodeFetch('/circles', {
    method: 'POST',
    body: JSON.stringify(input),
  })
}

export async function updateCircle(circleId, input) {
  return await datanodeFetch(`/circles/${encodeURIComponent(circleId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  })
}

export async function deleteCircle(circleId, input) {
  return await datanodeFetch(`/circles/${encodeURIComponent(circleId)}`, {
    method: 'DELETE',
    body: JSON.stringify(input),
  })
}

export async function uploadAvatar(type, id, base64OrUrl, expectedRevision) {
  const path = type === 'circle' ? `/circles/${encodeURIComponent(id)}/avatar` : `/people/${encodeURIComponent(id)}/avatar`
  return await datanodeFetch(path, {
    method: 'POST',
    body: JSON.stringify({
      imageUrl: base64OrUrl,
      expectedRevision,
    }),
  })
}
