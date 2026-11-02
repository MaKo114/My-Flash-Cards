import { expect, test } from '@playwright/test'

test('shows saved cards immediately while refreshing from the API', async ({ page }) => {
  const cached = { id: 1, word: 'Apple', partOfSpeech: 'noun', meaning: 'แอปเปิล', partsOfSpeech: ['noun'], meanings: ['แอปเปิล'], hint: '', needsReview: false }
  const fresh = { ...cached, id: 2, word: 'Book', meaning: 'หนังสือ', meanings: ['หนังสือ'] }
  await page.addInitScript(card => localStorage.setItem('flashcards.cards.v1', JSON.stringify([card])), cached)
  let releaseFetch: (() => void) | undefined
  let requestStarted: (() => void) | undefined
  const started = new Promise<void>(resolve => { requestStarted = resolve })
  await page.route('**/api/cards', async route => {
    requestStarted?.()
    await new Promise<void>(resolve => { releaseFetch = resolve })
    await route.fulfill({ json: [fresh] })
  })

  await page.goto('/')
  await started
  try {
    await expect(page.getByText('Apple', { exact: true })).toBeVisible({ timeout: 300 })
  } finally {
    releaseFetch?.()
  }
  await expect(page.getByText('Book', { exact: true })).toBeVisible()
  await expect(page.getByText('Apple', { exact: true })).not.toBeVisible()
})
