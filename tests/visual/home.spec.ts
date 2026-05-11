import { expect, test } from '@playwright/test'

test('home page keeps its current visual appearance', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveScreenshot('home-page.png', { fullPage: true })
})
