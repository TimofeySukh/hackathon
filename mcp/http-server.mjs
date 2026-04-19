import process from 'node:process'

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js'

import { createHackathonServer, serverVersion } from './server.mjs'

const DEFAULT_HOST = '0.0.0.0'
const DEFAULT_PORT = 3334

function parsePort(value) {
  const port = Number.parseInt(value ?? `${DEFAULT_PORT}`, 10)

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid HACKATHON_MCP_HTTP_PORT: ${value}`)
  }

  return port
}

function getAllowedHosts() {
  const value = process.env.HACKATHON_MCP_ALLOWED_HOSTS?.trim()

  if (!value) {
    return undefined
  }

  return value
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)
}

function createErrorResponse(res, error) {
  console.error('[hackathon-board MCP HTTP] request failed', error)

  if (res.headersSent) {
    return
  }

  res.status(500).json({
    jsonrpc: '2.0',
    error: {
      code: -32603,
      message: error instanceof Error ? error.message : 'Internal server error',
    },
    id: null,
  })
}

async function main() {
  const host = process.env.HACKATHON_MCP_HTTP_HOST || DEFAULT_HOST
  const port = parsePort(process.env.HACKATHON_MCP_HTTP_PORT)
  const allowedHosts = getAllowedHosts()
  const app = createMcpExpressApp({ host, allowedHosts })

  app.get('/', (_req, res) => {
    res.json({
      name: 'hackathon-board',
      version: serverVersion,
      transport: 'streamable-http',
      endpoint: '/mcp',
    })
  })

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      name: 'hackathon-board',
      version: serverVersion,
    })
  })

  app.post('/mcp', async (req, res) => {
    const server = createHackathonServer()
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    })

    res.on('close', () => {
      void transport.close()
      void server.close()
    })

    try {
      await server.connect(transport)
      await transport.handleRequest(req, res, req.body)
    } catch (error) {
      createErrorResponse(res, error)
    }
  })

  app.get('/mcp', (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed. Use POST for Streamable HTTP MCP requests.',
      },
      id: null,
    })
  })

  app.delete('/mcp', (_req, res) => {
    res.status(405).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Method not allowed. Stateless MCP does not require session deletion.',
      },
      id: null,
    })
  })

  app.listen(port, host, (error) => {
    if (error) {
      console.error('[hackathon-board MCP HTTP] failed to start', error)
      process.exit(1)
    }

    console.error(`[hackathon-board MCP HTTP] listening on http://${host}:${port}/mcp`)
  })
}

main().catch((error) => {
  console.error('[hackathon-board MCP HTTP] fatal error', error)
  process.exit(1)
})
