const DEFAULT_ALLOWED_ORIGINS = [
  'https://social.datanode.live',
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:5175',
]

function getAllowedOrigins() {
  const configuredOrigins = Deno.env.get('ALLOWED_ORIGINS')
    ?.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean) ?? []

  return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins])
}

function isAllowedDevOrigin(origin: string) {
  return /^http:\/\/(?:10|172\.(?:1[6-9]|2\d|3[01])|192\.168)\.\d{1,3}\.\d{1,3}:\d+$/.test(origin)
}

export function createCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? ''
  const allowedOrigins = getAllowedOrigins()
  const allowedOrigin = allowedOrigins.has(origin) || isAllowedDevOrigin(origin) ? origin : ''

  return {
    ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}
