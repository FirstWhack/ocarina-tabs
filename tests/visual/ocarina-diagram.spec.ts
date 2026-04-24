import { expect, test } from '@playwright/test'
import { ocarinaHoleIds } from '../../src/components/OcarinaDiagram/OcarinaDiagram.constants'

const visualCaseNames = [
  'empty',
  ...ocarinaHoleIds,
  'all-filled',
] as const

test.beforeEach(async ({ page }) => {
  await page.goto('/tests/visual/ocarina-diagram.html')
})

for (const visualCaseName of visualCaseNames) {
  test(`renders ${visualCaseName}`, async ({ page }) => {
    const fixture = page.getByTestId(`ocarina-${visualCaseName}`)

    await expect(fixture).toBeVisible()
    await expect(fixture).toHaveScreenshot(`${visualCaseName}.png`)
  })
}
