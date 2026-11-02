import { expect, test } from '@playwright/test'

test('shows import progress and explains rows that were not added', async ({ page }) => {
  const card = { id: 1, word: 'Run', partOfSpeech: 'verb', meaning: 'วิ่ง', partsOfSpeech: ['verb'], meanings: ['วิ่ง'], hint: '', needsReview: false }
  await page.route('**/api/cards', route => route.fulfill({ json: [card] }))
  let releaseImport: (() => void) | undefined
  let requestStarted: (() => void) | undefined
  const started = new Promise<void>(resolve => { requestStarted = resolve })
  await page.route('**/api/cards/import', async route => {
    requestStarted?.()
    await new Promise<void>(resolve => { releaseImport = resolve })
    await route.fulfill({ json: {
      added: 0, merged: 0, skipped: 1, invalid: 1,
      issues: [
        { row: 2, word: 'Run', kind: 'skipped', reason: 'ข้อมูลของคำนี้มีอยู่แล้ว' },
        { row: 3, word: 'bad', kind: 'invalid', reason: 'ไม่มีความหมาย' },
      ],
    } })
  })

  await page.goto('/')
  await page.locator('input[type="file"]').setInputFiles({
    name: 'words.csv', mimeType: 'text/csv',
    buffer: Buffer.from('คำศัพท์,ชนิดของคำ,ความหมาย\nrun,verb,วิ่ง\nbad,noun,\n'),
  })
  await started
  try {
    await expect(page.getByText('กำลังอัปโหลด CSV 0%')).toBeVisible({ timeout: 1000 })
    await expect(page.getByRole('progressbar', { name: 'ความคืบหน้าการนำเข้า CSV' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'นำเข้า CSV' })).toBeDisabled()
  } finally {
    releaseImport?.()
  }

  await expect(page.getByText('นำเข้า CSV เสร็จแล้ว')).toBeVisible()
  await expect(page.getByText('แถว 2 · Run · ข้าม: ข้อมูลของคำนี้มีอยู่แล้ว')).toBeVisible()
  await expect(page.getByText('แถว 3 · bad · นำเข้าไม่ได้: ไม่มีความหมาย')).toBeVisible()
})
