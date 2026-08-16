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
const callbackBlock = extractBlock(source, 'location @oauth_popup_callback {')

assert.match(serverBlock, /frame-ancestors 'none'/, 'Normal production responses must remain non-embeddable.')
assert.match(serverBlock, /X-Frame-Options "DENY"/, 'Normal production responses must retain X-Frame-Options DENY.')

assert.match(
  embedBlock,
  /frame-ancestors http:\/\/localhost:13337 https:\/\/chatgpt\.com https:\/\/\*\.chatgpt\.com https:\/\/\*\.openai\.com;/,
  'The embed route must allow the verified local moi workspace origin and hosted ChatGPT origins.',
)
assert.match(embedBlock, /\$arg_sdn_auth_popup_callback = v1/)
assert.match(embedBlock, /Cache-Control "no-cache, no-store, must-revalidate"/)
assert.match(embedBlock, /error_page 418 = @oauth_popup_callback;/)
assert.match(embedBlock, /return 418;/)
assert.match(embedBlock, /try_files \/index\.html =404;/)

assert.match(callbackBlock, /try_files \/auth\/popup-callback\.html =404;/)
assert.match(callbackBlock, /Cross-Origin-Opener-Policy "unsafe-none"/)
assert.match(callbackBlock, /X-Frame-Options "DENY"/)
assert.match(callbackBlock, /frame-ancestors 'none'/)
assert.match(callbackBlock, /Cache-Control "no-cache, no-store, must-revalidate"/)

const callbackHtml = await readFile('public/auth/popup-callback.html', 'utf8')
const callbackScript = await readFile('public/auth/popup-callback.js', 'utf8')
assert.match(callbackHtml, /<script type="module" src="\/auth\/popup-callback\.js"><\/script>/)
assert.doesNotMatch(callbackHtml, /<script(?![^>]*src=)/)
assert.match(callbackScript, /social-datanode\.oauth-result\.v1/)
assert.match(callbackScript, /opener\.postMessage/)

console.log('Embed nginx configuration isolates the moi callback and keeps default framing denial.')
