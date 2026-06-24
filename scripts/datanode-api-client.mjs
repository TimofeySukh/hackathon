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

export async function listCircles() {
  return await datanodeFetch('/circles')
}

export async function createPerson(input) {
  return await datanodeFetch('/people', {
    method: 'POST',
    body: JSON.stringify(input),
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
