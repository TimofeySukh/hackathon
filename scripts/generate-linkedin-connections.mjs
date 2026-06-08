import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { BlobReader, BlobWriter, TextReader, ZipWriter } from '@zip.js/zip.js'

const DEFAULT_COUNT = 10_000
const DEFAULT_OUTPUT_DIR = 'fixtures/linkedin'

function readArg(name, fallback) {
  const prefix = `--${name}=`
  const inline = process.argv.find((arg) => arg.startsWith(prefix))
  if (inline) return inline.slice(prefix.length)

  const index = process.argv.indexOf(`--${name}`)
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1]

  return fallback
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number.parseInt(String(value), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function csvCell(value) {
  const text = String(value ?? '')
  if (!/[",\r\n]/.test(text)) return text

  return `"${text.replaceAll('"', '""')}"`
}

function buildConnectionsCsv(count) {
  const header = [
    'First Name',
    'Last Name',
    'URL',
    'Email Address',
    'Company',
    'Position',
    'Connected On',
  ]
  const rows = [header]

  for (let index = 1; index <= count; index += 1) {
    const padded = String(index).padStart(5, '0')
    rows.push([
      `Contact${padded}`,
      `Fixture`,
      `https://www.linkedin.com/in/contact-${padded}`,
      `contact-${padded}@example.invalid`,
      `Company ${((index - 1) % 250) + 1}`,
      `Role ${((index - 1) % 120) + 1}`,
      `2026-${String(((index - 1) % 12) + 1).padStart(2, '0')}-${String(((index - 1) % 28) + 1).padStart(2, '0')}`,
    ])
  }

  return `${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`
}

async function buildZip(csv) {
  const zipWriter = new ZipWriter(new BlobWriter('application/zip'))
  await zipWriter.add('Connections.csv', new TextReader(csv))
  const blob = await zipWriter.close()
  return Buffer.from(await blob.arrayBuffer())
}

const count = parsePositiveInteger(readArg('count', DEFAULT_COUNT), DEFAULT_COUNT)
const outputDir = readArg('out-dir', DEFAULT_OUTPUT_DIR)
const csv = buildConnectionsCsv(count)
const absoluteOutputDir = path.resolve(outputDir)
const csvPath = path.join(absoluteOutputDir, `Connections-${count}.csv`)
const zipPath = path.join(absoluteOutputDir, `linkedin-connections-${count}.zip`)

await mkdir(absoluteOutputDir, { recursive: true })
await writeFile(csvPath, csv)
await writeFile(zipPath, await buildZip(csv))

console.log(`Wrote ${csvPath}`)
console.log(`Wrote ${zipPath}`)
