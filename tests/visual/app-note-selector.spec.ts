import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

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

  await expect(page.getByLabel(/Track 1:/)).toBeChecked()
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

test('transpose controls shift the generated tab', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: '+1', exact: true }).click()

  await expect(page.getByTestId('transpose-value')).toHaveText('+1 semitones')
  await expect(page.getByTestId('active-note')).toHaveText('C#5 / MIDI 73')
  await expect(page.getByTestId('tab-step-0')).toContainText('C#5')
})

test('exported canonical tab JSON imports back into the app', async ({
  page,
}, testInfo) => {
  await page.goto('/')
  await page.getByRole('button', { name: '+1', exact: true }).click()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export tab' }).click()
  const download = await downloadPromise
  const exportPath = testInfo.outputPath('round-trip.ocarina-tab.json')
  await download.saveAs(exportPath)

  const exportedJson = JSON.parse(await readFile(exportPath, 'utf8')) as {
    schemaVersion: number
    transpositionSemitones: number
  }

  expect(exportedJson.schemaVersion).toBe(1)
  expect(exportedJson.transpositionSemitones).toBe(1)

  await page.getByRole('button', { name: 'Load sample' }).click()
  await expect(page.getByTestId('tab-step-0')).toContainText('C5')

  await page.locator('input[accept*="ocarina-tab"]').setInputFiles(exportPath)

  await expect(page.getByTestId('tab-step-0')).toContainText('C#5')
  await expect(page.getByTestId('active-note')).toHaveText('C#5 / MIDI 73')
})
