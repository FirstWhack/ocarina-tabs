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
