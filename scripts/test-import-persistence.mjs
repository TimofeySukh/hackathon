import assert from 'node:assert/strict'
import http from 'node:http'
import { once } from 'node:events'
import { createServer as createViteServer } from 'vite'

function createGraph() {
  return {
    circles: [
      {
        id: 'you',
        name: 'You',
        icon: 'YOU',
        x: 0,
        y: 0,
        radius: 104,
        minRadius: 104,
        parentId: null,
        connectedTo: null,
        tone: 'blue',
        fillMode: 'transparent',
        shapeType: 'circle',
        shapeCustom: false,
        sides: 25,
        amplitude: 0,
      },
      {
        id: 'linkedin-company-openai',
        name: 'OpenAI',
        icon: 'OA',
        x: 400,
        y: 0,
        radius: 120,
        minRadius: 120,
        parentId: null,
        connectedTo: null,
        tone: 'red',
        fillMode: 'transparent',
        shapeType: 'circle',
        shapeCustom: false,
        sides: 25,
        amplitude: 0,
      },
    ],
    people: [
      {
        id: 'linkedin-person-sam-altman',
        name: 'Sam Altman',
        x: 420,
        y: 24,
        circleId: 'linkedin-company-openai',
        avatar: 'SA',
        shapeType: 'circle',
        sides: 10,
        amplitude: 0,
        links: [{ id: 'link-linkedin', service: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/samaltman/' }],
        notes: [{ id: 'note-position', title: 'Position', body: 'CEO' }],
      },
    ],
    connections: [],
  }
}

async function withMockGraphApi(handler, run) {
  const server = http.createServer(async (req, res) => {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const bodyText = Buffer.concat(chunks).toString('utf8')
    await handler(req, res, bodyText)
  })
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()
  try {
    await run(`http://127.0.0.1:${port}/functions/v1/graph-api`)
  } finally {
    server.close()
    await once(server, 'close')
  }
}

function json(res, status, payload) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(payload))
}

async function main() {
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' })
  try {
    const persistence = await vite.ssrLoadModule('/src/lib/graphPersistence.ts')
    const graphApiErrors = await vite.ssrLoadModule('/supabase/functions/graph-api/errors.ts')
    const graph = createGraph()

    await withMockGraphApi((req, res, bodyText) => {
      assert.equal(req.method, 'PUT')
      assert.equal(req.url, '/functions/v1/graph-api/v1/graph')
      assert.equal(req.headers.authorization, 'Bearer test-access-token')
      assert.match(req.headers['content-type'] ?? '', /application\/json/)

      const body = JSON.parse(bodyText)
      assert.equal(body.expectedRevision, 7)
      assert.deepEqual(body.graph, graph)
      json(res, 200, { revision: 8 })
    }, async (baseUrl) => {
      const response = await persistence.saveGraphThroughApi(baseUrl, 'test-access-token', graph, 7)
      assert.deepEqual(response, { revision: 8 })
    })

    await withMockGraphApi((_req, res) => {
      json(res, 409, { error: 'Revision conflict.', revision: 9 })
    }, async (baseUrl) => {
      await assert.rejects(
        () => persistence.saveGraphThroughApi(baseUrl, 'test-access-token', graph, 7),
        persistence.GraphRevisionConflictError,
      )
    })

    await withMockGraphApi((_req, res) => {
      json(res, 500, { error: 'Unexpected graph API error.' })
    }, async (baseUrl) => {
      await assert.rejects(
        () => persistence.saveGraphThroughApi(baseUrl, 'test-access-token', graph, 7),
        (error) =>
          error instanceof persistence.GraphPersistenceError &&
          error.message.includes('Failed to save your board') &&
          error.message.includes('Unexpected graph API error.'),
      )
    })

    await withMockGraphApi((req, res, bodyText) => {
      assert.equal(req.method, 'PATCH')
      assert.equal(req.url, '/rest/v1/user_graphs?user_id=eq.test-user&revision=eq.7&select=revision')
      assert.equal(req.headers.apikey, 'test-publishable-key')
      assert.equal(req.headers.authorization, 'Bearer test-access-token')
      assert.match(req.headers.prefer ?? '', /return=representation/)

      const body = JSON.parse(bodyText)
      assert.deepEqual(body, { graph })
      json(res, 200, [{ revision: 8 }])
    }, async (baseUrl) => {
      const restUrl = baseUrl.replace('/functions/v1/graph-api', '/rest/v1')
      const response = await persistence.saveGraphThroughRest(restUrl, 'test-publishable-key', 'test-access-token', 'test-user', graph, 7)
      assert.deepEqual(response, { revision: 8 })
    })

    await withMockGraphApi((req, res, bodyText) => {
      assert.equal(req.method, 'POST')
      assert.equal(req.url, '/rest/v1/user_graphs?select=revision')

      const body = JSON.parse(bodyText)
      assert.deepEqual(body, { user_id: 'test-user', graph })
      json(res, 200, [{ revision: 1 }])
    }, async (baseUrl) => {
      const restUrl = baseUrl.replace('/functions/v1/graph-api', '/rest/v1')
      const response = await persistence.saveGraphThroughRest(restUrl, 'test-publishable-key', 'test-access-token', 'test-user', graph, null)
      assert.deepEqual(response, { revision: 1 })
    })

    assert.equal(
      graphApiErrors.formatGraphApiError({
        message: 'column user_graphs.revision does not exist',
        details: 'Could not find the revision column.',
        hint: 'Reload schema cache.',
        code: 'PGRST204',
      }),
      'column user_graphs.revision does not exist Could not find the revision column. Reload schema cache. code PGRST204',
    )

    assert.equal(
      graphApiErrors.formatGraphApiError({ error: 'Unexpected graph API error.' }),
      'Unexpected graph API error.',
    )

    console.log(JSON.stringify({ status: 'ok', checked: ['graph-api-save-body', 'revision-conflict', 'rest-fallback-body', 'error-formatting'] }, null, 2))
  } finally {
    await vite.close()
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
