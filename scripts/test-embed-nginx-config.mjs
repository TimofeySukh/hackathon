import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

function extractBlock(source, marker) {
  const start = source.indexOf(marker)
  assert.notEqual(start, -1, `Missing nginx block: ${marker}`)

  const openingBrace = source.indexOf('{', start)
  assert.notEqual(openingBrace, -1, `Missing opening brace for: ${marker}`)

  let depth = 0
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') depth -= 1
    if (depth === 0) return source.slice(openingBrace + 1, index)
  }

  throw new Error(`Missing closing brace for: ${marker}`)
}

const source = await readFile('deploy/social-datanode-live/nginx.conf', 'utf8')
const serverBlock = extractBlock(source, 'server {')
const embedBlock = extractBlock(source, 'location = /embed {')

assert.match(serverBlock, /frame-ancestors 'none'/, 'Normal production responses must remain non-embeddable.')
assert.match(serverBlock, /X-Frame-Options "DENY"/, 'Normal production responses must retain X-Frame-Options DENY.')

assert.match(embedBlock, /frame-ancestors https:\/\/chatgpt\.com https:\/\/\*\.chatgpt\.com https:\/\/\*\.openai\.com;/)
assert.doesNotMatch(embedBlock, /frame-ancestors 'none'/)
assert.doesNotMatch(embedBlock, /X-Frame-Options/)
assert.match(embedBlock, /Cache-Control "no-cache, no-store, must-revalidate"/)
assert.match(embedBlock, /try_files \/index\.html =404;/)

console.log('Embed nginx configuration is isolated and keeps the default framing denial.')
