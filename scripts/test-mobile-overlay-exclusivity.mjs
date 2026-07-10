import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'

const port = 5189
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
      const coach = page.getByRole('region', { name: 'Board guide' })
      await coach.waitFor()

      await page.getByRole('button', { name: 'Settings' }).click()
      await page.locator('.settings-panel.is-open').waitFor()
      await coach.waitFor({ state: 'hidden', timeout: 700 })

      await page.getByRole('button', { name: 'Settings' }).click()
      await coach.waitFor({ state: 'visible' })
      assert.equal(await page.locator('.board-mode-menu').count(), 0, 'Mobile must not show persistent tool modes.')

      await page.locator('.graph-surface').dispatchEvent('dblclick', { clientX: 350, clientY: 450 })
      await page.locator('.inspector.is-open').waitFor()
      await coach.waitFor({ state: 'hidden' })
      await page.locator('.inspector-close-btn').first().click()
      await coach.waitFor({ state: 'visible' })

      await page.locator('.graph-surface').dispatchEvent('dblclick', { clientX: 350, clientY: 450 })
      await page.locator('.inspector.is-open').waitFor()
      await page.getByRole('button', { name: 'Settings' }).click()
      await page.locator('.settings-panel.is-open').waitFor()
      await page.locator('.inspector.is-open').waitFor({ state: 'hidden' })
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
