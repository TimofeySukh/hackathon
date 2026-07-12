import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'

const assetsDirectory = path.resolve('dist/assets')
const maxJavaScriptBytes = 500_000
const maxLandingImageBytes = 100_000

const files = await readdir(assetsDirectory)
const sizes = await Promise.all(files.map(async (file) => ({
  file,
  bytes: (await stat(path.join(assetsDirectory, file))).size,
})))

const oversizedJavaScript = sizes.filter(({ file, bytes }) => file.endsWith('.js') && bytes > maxJavaScriptBytes)
if (oversizedJavaScript.length > 0) {
  throw new Error(`JavaScript chunk limit exceeded: ${JSON.stringify(oversizedJavaScript)}`)
}

const landingImage = sizes.find(({ file }) => file.startsWith('product-board-inspector-'))
if (!landingImage) throw new Error('Landing board image is missing from the production build.')
if (landingImage.bytes > maxLandingImageBytes) {
  throw new Error(`Landing board image limit exceeded: ${landingImage.bytes} bytes.`)
}

console.log(JSON.stringify({
  largestJavaScriptBytes: Math.max(...sizes.filter(({ file }) => file.endsWith('.js')).map(({ bytes }) => bytes)),
  landingImageBytes: landingImage.bytes,
}, null, 2))
