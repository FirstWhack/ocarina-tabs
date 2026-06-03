import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('composer mode records, appends text notes, edits, deletes, and exports', async ({
  page,
}, testInfo) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Composer' }).click()
  await page.getByRole('button', { name: 'Record' }).click()
  await page.getByTestId('note-button-C5').click()
  await page.getByRole('button', { name: 'Stop recording' }).click()

  await expect(page.getByTestId('tab-step-0')).toContainText('C5')

  await page.getByLabel('Composer notes').fill('D5 E5')
  await page.getByRole('button', { name: 'Add notes' }).click()

  await expect(page.getByTestId('tab-step-1')).toContainText('D5')
  await expect(page.getByTestId('tab-step-2')).toContainText('E5')

  await page.getByTestId('tab-step-1').click()
  await page.getByLabel('Selected note').selectOption('79')

  await expect(page.getByTestId('tab-step-1')).toContainText('G5')

  await page.getByRole('button', { name: 'Delete selected' }).click()

  await expect(page.getByTestId('tab-step-0')).toContainText('C5')
  await expect(page.getByTestId('tab-step-1')).toContainText('E5')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export tab' }).click()
  const download = await downloadPromise
  const exportPath = testInfo.outputPath('composer.ocarina-tab.json')

  await download.saveAs(exportPath)

  const exportedJson = JSON.parse(await readFile(exportPath, 'utf8')) as {
    source: { type: string }
    transpositionSemitones: number
    steps: { index: number; sourceMidiNote: number; midiNote: number }[]
  }

  expect(exportedJson.source.type).toBe('editor')
  expect(exportedJson.transpositionSemitones).toBe(0)
  expect(exportedJson.steps.map((step) => step.index)).toEqual([0, 1])
  expect(exportedJson.steps.map((step) => step.midiNote)).toEqual([72, 76])
  expect(exportedJson.steps.map((step) => step.sourceMidiNote)).toEqual([72, 76])
})
