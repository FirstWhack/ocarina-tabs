import { expect, test } from '@playwright/test'
import { readFile } from 'node:fs/promises'

test('composer mode records, appends text notes, edits, deletes, and exports', async ({
  page,
}, testInfo) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Composer' }).click()
  await page.getByRole('checkbox', { name: 'Record' }).check()
  await page.getByTestId('note-button-C5').click()
  await page.getByRole('checkbox', { name: 'Record' }).uncheck()

  await expect(page.getByTestId('tab-step-0')).toContainText('C5')

  await page.getByLabel('Composer notes').fill('D5 E5')
  await page.getByRole('button', { name: 'Add' }).click()

  await expect(page.getByTestId('tab-step-1')).toContainText('D5')
  await expect(page.getByTestId('tab-step-2')).toContainText('E5')

  await page.getByTestId('tab-step-1').click()
  await page
    .getByLabel('Composer controls')
    .getByRole('combobox', { name: 'Note' })
    .selectOption('79')

  await expect(page.getByTestId('tab-step-1')).toContainText('G5')

  await page.getByRole('button', { name: 'Delete' }).click()

  await expect(page.getByTestId('tab-step-0')).toContainText('C5')
  await expect(page.getByTestId('tab-step-1')).toContainText('E5')

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export' }).click()
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

test('composer mode transposes unsupported notes and exports either pitch set', async ({
  page,
}, testInfo) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Composer' }).click()
  await page.getByLabel('Composer notes').fill('G4')
  await page.getByRole('button', { name: 'Add' }).click()

  await expect(page.getByText(/G4 is outside this ocarina profile/)).toBeVisible()
  await expect(page.getByTestId('tab-step-0')).toContainText('MIDI 67')
  await expect(page.getByTestId('tab-step-0')).toContainText('Unsupported')

  await page
    .getByLabel('Composer transposition controls')
    .getByRole('button', { name: '+1', exact: true })
    .click()

  await expect(page.getByTestId('composer-transpose-value')).toHaveText(
    '+1 semitones',
  )
  await expect(page.getByTestId('tab-step-0')).toContainText('MIDI 68')

  const suggestedButton = page
    .getByLabel('Composer transposition controls')
    .getByRole('button', { name: 'Suggested' })

  await suggestedButton.focus()
  await page.keyboard.press('Enter')

  await expect(page.getByTestId('composer-transpose-value')).toHaveText(
    '+2 semitones',
  )
  await expect(page.getByTestId('tab-step-0')).toContainText('A4')
  await expect(page.getByTestId('tab-step-0')).not.toContainText('Unsupported')

  page.once('dialog', (dialog) => dialog.accept())
  const transposedDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export' }).click()
  const transposedDownload = await transposedDownloadPromise
  const transposedPath = testInfo.outputPath('composer-transposed.ocarina-tab.json')
  await transposedDownload.saveAs(transposedPath)

  const transposedJson = JSON.parse(await readFile(transposedPath, 'utf8')) as {
    transpositionSemitones: number
    steps: { sourceMidiNote: number; midiNote: number }[]
  }

  expect(transposedJson.transpositionSemitones).toBe(0)
  expect(transposedJson.steps[0].sourceMidiNote).toBe(69)
  expect(transposedJson.steps[0].midiNote).toBe(69)

  page.once('dialog', (dialog) => dialog.dismiss())
  const originalDownloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export' }).click()
  const originalDownload = await originalDownloadPromise
  const originalPath = testInfo.outputPath('composer-original.ocarina-tab.json')
  await originalDownload.saveAs(originalPath)

  const originalJson = JSON.parse(await readFile(originalPath, 'utf8')) as {
    transpositionSemitones: number
    steps: { sourceMidiNote: number; midiNote: number }[]
  }

  expect(originalJson.transpositionSemitones).toBe(0)
  expect(originalJson.steps[0].sourceMidiNote).toBe(67)
  expect(originalJson.steps[0].midiNote).toBe(67)
})

test('composer mode supports physical keyboard piano controls', async ({
  page,
}) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Composer' }).click()

  await page.keyboard.press('Tab')
  await expect(page.getByTestId('active-note')).toContainText('A4 / MIDI 69')

  await page.keyboard.press('3')
  await expect(page.getByTestId('active-note')).toContainText('C#5 / MIDI 73')

  await page.getByLabel('Composer notes').focus()
  await page.keyboard.press('w')
  await expect(page.getByTestId('active-note')).toContainText('C#5 / MIDI 73')

  await page.getByRole('checkbox', { name: 'Record' }).check()
  await expect(page.getByRole('checkbox', { name: 'Record' })).toBeChecked()
  await page.keyboard.down('w')
  await page.keyboard.down('w')
  await page.waitForTimeout(300)
  await page.keyboard.up('w')

  await expect(page.getByTestId('tab-step-0')).toContainText('C5')
  await expect(page.getByTestId('tab-step-1')).toHaveCount(0)
})
