import { expect, test } from '@playwright/test'

const card = {
  id: 1,
  word: 'Apple',
  partOfSpeech: 'noun',
  meaning: 'แอปเปิล',
  partsOfSpeech: ['noun'],
  meanings: ['แอปเปิล'],
  hint: '',
  needsReview: true,
}

test('review button responds while saving and keeps the saved state', async ({ page }) => {
  await page.route('**/api/cards', route => route.fulfill({ json: [card] }))
  let releaseReview: (() => void) | undefined
  let requestStarted: (() => void) | undefined
  const started = new Promise<void>(resolve => { requestStarted = resolve })
  await page.route('**/api/cards/1/review', async route => {
    requestStarted?.()
    await new Promise<void>(resolve => { releaseReview = resolve })
    await route.fulfill({ json: { ...card, needsReview: false } })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'อ่านบัตรคำ' }).click()
  await page.getByRole('button', { name: 'อยู่ในคำที่ต้องทบทวน' }).click()
  await started
  try {
    const button = page.getByRole('button', { name: 'จำไม่ได้ เก็บไว้ทบทวน' })
    await expect(button).toBeVisible({ timeout: 300 })
    await expect(button).toBeDisabled()
  } finally {
    releaseReview?.()
  }
  await expect(page.getByRole('button', { name: 'จำไม่ได้ เก็บไว้ทบทวน' })).toBeEnabled()
})

test('failed review save restores the previous state', async ({ page }) => {
  await page.route('**/api/cards', route => route.fulfill({ json: [card] }))
  let releaseReview: (() => void) | undefined
  let requestStarted: (() => void) | undefined
  const started = new Promise<void>(resolve => { requestStarted = resolve })
  await page.route('**/api/cards/1/review', async route => {
    requestStarted?.()
    await new Promise<void>(resolve => { releaseReview = resolve })
    await route.fulfill({ status: 503, json: { error: 'บันทึกไม่สำเร็จ' } })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'อ่านบัตรคำ' }).click()
  await page.getByRole('button', { name: 'อยู่ในคำที่ต้องทบทวน' }).click()
  await started
  await expect(page.getByRole('button', { name: 'จำไม่ได้ เก็บไว้ทบทวน' })).toBeVisible()
  releaseReview?.()
  await expect(page.getByRole('button', { name: 'อยู่ในคำที่ต้องทบทวน' })).toBeEnabled()
  await expect(page.getByRole('alert')).toContainText('บันทึกไม่สำเร็จ')
})

test('review-only deck removes the card immediately and restores it on failure', async ({ page }) => {
  await page.route('**/api/cards', route => route.fulfill({ json: [card] }))
  let releaseReview: (() => void) | undefined
  let requestStarted: (() => void) | undefined
  const started = new Promise<void>(resolve => { requestStarted = resolve })
  await page.route('**/api/cards/1/review', async route => {
    requestStarted?.()
    await new Promise<void>(resolve => { releaseReview = resolve })
    await route.fulfill({ status: 503, json: { error: 'บันทึกไม่สำเร็จ' } })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'อ่านบัตรคำ' }).click()
  await page.getByRole('button', { name: 'ต้องทบทวน', exact: true }).first().click()
  await page.getByRole('button', { name: 'อยู่ในคำที่ต้องทบทวน' }).click()
  await started
  await expect(page.getByText('ยังไม่มีบัตรในหมวดนี้')).toBeVisible({ timeout: 300 })
  releaseReview?.()
  await expect(page.getByRole('button', { name: 'อยู่ในคำที่ต้องทบทวน' })).toBeEnabled()
})
