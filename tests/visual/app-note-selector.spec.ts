import { expect, test } from '@playwright/test'

test('clicking a note updates the selected fingering', async ({ page }) => {
  await page.goto('/')

  await page.getByTestId('note-button-D5').click()

  await expect(page.getByTestId('active-note')).toHaveText('D5 / MIDI 74')
  await expect(
    page
      .getByTestId('active-ocarina-diagram')
      .locator('[data-hole-id="left-index"]'),
  ).toHaveAttribute('data-filled', 'true')
  await expect(
    page
      .getByTestId('active-ocarina-diagram')
      .locator('[data-hole-id="right-pinky"]'),
  ).toHaveAttribute('data-filled', 'false')
})

test('sample preview advances the ocarina diagram through MIDI notes', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.getByLabel('Track', { exact: true })).toHaveValue('0')
  await expect(page.getByTestId('generated-tab').locator('svg')).toHaveCount(14)
  await page.getByRole('button', { name: 'Preview sample' }).click()

  await expect(page.getByTestId('active-note')).toHaveText('G5 / MIDI 79', {
    timeout: 2500,
  })
  await expect(
    page
      .getByTestId('active-ocarina-diagram')
      .locator('[data-hole-id="right-index"]'),
  ).toHaveAttribute('data-filled', 'false')
})
