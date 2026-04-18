import { expect, test } from '@playwright/test'

test('mobile graph flow keeps core interactions usable', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('button', { name: 'Pan' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add relation' })).toBeVisible()

  const addRelationButton = page.getByRole('button', { name: 'Add relation' })
  await addRelationButton.evaluate((node) => {
    ;(node as HTMLButtonElement).click()
  })
  await expect(addRelationButton).toHaveClass(/is-active/)

  await page.locator('.board-viewport').click({
    position: { x: 320, y: 280 },
  })

  const moveHandle = page.getByRole('button', { name: 'Move node' }).first()
  await expect(moveHandle).toBeVisible()

  await page.getByRole('button', { name: 'Pan' }).click()

  const movedNode = moveHandle.locator('xpath=ancestor::div[contains(@class,"graph-node")][1]')
  const beforePosition = await movedNode.getAttribute('style')
  const box = await moveHandle.boundingBox()

  if (!box) {
    throw new Error('Expected move handle box.')
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 48)
  await page.mouse.up()

  await expect
    .poll(async () => movedNode.getAttribute('style'))
    .not.toBe(beforePosition)

  const rootNode = page.getByRole('button', { name: /^You$/ })
  const rootBox = await rootNode.boundingBox()

  if (!rootBox) {
    throw new Error('Expected root node box.')
  }

  const touchEvent = {
    bubbles: true,
    pointerId: 91,
    pointerType: 'touch',
    clientX: rootBox.x + rootBox.width / 2,
    clientY: rootBox.y + rootBox.height / 2,
  }

  await rootNode.dispatchEvent('pointerdown', touchEvent)
  await page.waitForTimeout(500)
  await rootNode.dispatchEvent('pointerup', touchEvent)

  await expect(page.getByRole('dialog', { name: 'Node actions' })).toBeVisible()
})
