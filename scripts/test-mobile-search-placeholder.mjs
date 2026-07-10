import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

const port = 5188
const baseUrl = `http://127.0.0.1:${port}`

async function waitForServer(timeoutMs = 30_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      if ((await fetch(baseUrl)).ok) return
    } catch {
      // Vite has not finished starting yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`Timed out waiting for ${baseUrl}`)
}

async function main() {
  const server = spawn(
    'npm',
    ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    {
      cwd: process.cwd(),
      stdio: 'inherit',
      env: {
        ...process.env,
        BROWSER: 'none',
        VITE_E2E_FAKE_AUTH: 'true',
        VITE_SUPABASE_URL: '',
        VITE_SUPABASE_PUBLISHABLE_KEY: '',
        VITE_SUPABASE_ANON_KEY: '',
      },
    },
  )

  try {
    await waitForServer()
    const { chromium } = await import('playwright')
    const browser = await chromium.launch({ headless: true })
    const page = await browser.newPage({
      viewport: { width: 393, height: 852 },
      isMobile: true,
      hasTouch: true,
    })

    try {
      await page.goto(`${baseUrl}/#board`)
      await page.getByRole('button', { name: 'Search' }).click()
      const input = page.locator('.search-box__input')
      await input.waitFor()
      await page.waitForTimeout(350)

      const result = await input.evaluate((element) => {
        const context = document.createElement('canvas').getContext('2d')
        if (!context) throw new Error('Canvas context unavailable')
        context.font = getComputedStyle(element).font
        return {
          placeholder: element.placeholder,
          inputWidth: element.clientWidth,
          placeholderWidth: context.measureText(element.placeholder).width,
        }
      })

      assert.ok(
        result.placeholderWidth <= result.inputWidth,
        `Mobile search placeholder is clipped: ${result.placeholderWidth}px text in ${result.inputWidth}px input (${result.placeholder})`,
      )
    } finally {
      await browser.close()
    }
  } finally {
    server.kill('SIGTERM')
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
