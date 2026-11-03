import { readFile } from 'node:fs/promises'
import { expect, test, type APIRequestContext } from '@playwright/test'

const api = 'http://127.0.0.1:3002/api'

function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function reset(request: APIRequestContext, cards: { word: string; partOfSpeech: string; meaning: string; example?: string }[]) {
  for (const card of await (await request.get(`${api}/cards`)).json() as { id: number }[]) {
    expect((await request.delete(`${api}/cards/${card.id}`)).ok()).toBeTruthy()
  }
  const created: Record<string, number> = {}
  for (const card of cards) {
    const response = await request.post(`${api}/cards`, { data: card })
    expect(response.ok()).toBeTruthy()
    created[card.word] = (await response.json() as { id: number }).id
  }
  return created
}

test('schedules reviews, shows statistics and round-trips CSV export', async ({ page, request }) => {
  const ids = await reset(request, [
    { word: 'Apple', partOfSpeech: 'noun', meaning: 'แอปเปิล', example: 'An apple a day keeps the doctor away.' },
    { word: 'Book', partOfSpeech: 'noun', meaning: 'หนังสือ' },
  ])
  const today = localDay()
  // The study log outlives deleted cards, so compare with what was already logged today.
  const before = (await (await request.get(`${api}/study-days`)).json() as { date: string; answers: number; correct: number }[]).find(day => day.date === today) ?? { date: today, answers: 0, correct: 0 }
  const wrong = await (await request.post(`${api}/cards/${ids.Apple}/answer`, { data: { correct: false, today } })).json() as { dueOn: string; needsReview: boolean; wrongCount: number }
  expect(wrong).toMatchObject({ dueOn: today, needsReview: true, wrongCount: 1 })
  const right = await (await request.post(`${api}/cards/${ids.Book}/answer`, { data: { correct: true, today } })).json() as { dueOn: string; srsStep: number }
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  expect(right).toMatchObject({ dueOn: localDay(tomorrow), srsStep: 1 })

  await page.goto('/')
  const sidebar = page.locator('aside')
  await expect(sidebar.getByText('ถึงกำหนดทบทวน')).toBeVisible()
  await sidebar.getByRole('button', { name: 'ฝึกวันนี้ (1 คำ)' }).click()
  await expect(page.getByText('พร้อมฝึก 1 คำ')).toBeVisible()
  await page.getByRole('button', { name: 'เลือกคำตอบ' }).click()
  await expect(page.getByText('พร้อมฝึก 1 คำ')).toBeVisible()
  await page.getByRole('button', { name: 'เริ่ม Challenge' }).click()
  await expect(page.getByTestId('challenge-prompt')).toHaveText('Apple')
  await page.getByTestId('choice').filter({ hasText: 'แอปเปิล' }).click()
  await expect(page.getByText('An apple a day keeps the doctor away.')).toBeVisible()
  await expect(page.getByText('จบรอบ Challenge')).toBeVisible()
  await expect(page.getByRole('button', { name: /ถึงกำหนด 0/ })).toBeVisible()

  await page.getByRole('button', { name: 'สถิติ' }).first().click()
  await expect(page).toHaveTitle('สถิติ · My Flash Cards')
  const tiles = page.getByText('วันนี้ตอบ').locator('..').locator('..').locator('..')
  await expect(tiles).toContainText(/ฝึกต่อเนื่อง[1-9]\d*วันวันนี้ฝึกแล้ว/)
  await expect(tiles).toContainText(`วันนี้ตอบ${before.answers + 3}คำ`)
  await expect(page.getByRole('list').filter({ hasText: 'Apple' })).toContainText('ผิด 1')
  await expect(page.getByText('จำได้แม่น 0')).toBeVisible()
  const days = await (await request.get(`${api}/study-days`)).json() as { date: string; answers: number; correct: number }[]
  expect(days[0]).toEqual({ date: today, answers: before.answers + 3, correct: before.correct + 2 })

  await page.getByRole('button', { name: 'อ่านบัตรคำ' }).first().click()
  await expect(page.getByTestId('front-value')).toHaveText('Apple')
  await page.getByRole('button', { name: 'พลิกบัตร' }).click()
  await expect(page.getByTestId('back-example')).toHaveText('An apple a day keeps the doctor away.')

  await page.getByRole('button', { name: 'คลังคำศัพท์' }).first().click()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'ส่งออก CSV' }).click()
  const file = await (await download).path()
  const csv = await readFile(file, 'utf-8')
  expect(csv).toContain('คำศัพท์,ชนิดของคำ,ความหมาย,คำใบ้,ตัวอย่างประโยค')
  expect(csv).toContain('"Apple","noun","แอปเปิล","","An apple a day keeps the doctor away."')
  await page.locator('input[type="file"]').setInputFiles({ name: 'backup.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await expect(page.getByText('เพิ่ม 0 คำ · รวมข้อมูล 0 แถว · ข้ามคำซ้ำ 2 แถว · ข้อมูลไม่ครบ/ผิดรูปแบบ 0 แถว')).toBeVisible()
})

test('mobile rows swipe to edit or delete and the challenge settings fold away', async ({ page, request }) => {
  await reset(request, [
    { word: 'Apple', partOfSpeech: 'noun', meaning: 'แอปเปิล' },
    { word: 'Book', partOfSpeech: 'noun', meaning: 'หนังสือ' },
  ])
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'เก็บไว้ทบทวน Apple' })).toBeVisible()
  const editApple = page.getByRole('button', { name: 'แก้ไข Apple' })
  await expect(editApple).toHaveCount(1)
  const row = page.locator('[data-swipe-row]').filter({ hasText: 'Apple' })
  async function swipe(dx: number) {
    await row.scrollIntoViewIfNeeded()
    const box = (await row.boundingBox())!
    const y = box.y + box.height / 2
    await page.mouse.move(box.x + box.width - 40, y)
    await page.mouse.down()
    for (let step = 1; step <= 8; step++) await page.mouse.move(box.x + box.width - 40 + dx * step / 8, y)
    await page.mouse.up()
  }
  await swipe(-200)
  await expect.poll(async () => (await row.boundingBox())!.x).toBeLessThan(-100)
  await editApple.click()
  await expect(page.getByRole('dialog')).toContainText('แก้ไขคำศัพท์')
  await page.getByRole('dialog').getByRole('button', { name: 'ยกเลิก' }).click()

  await swipe(-200)
  await page.getByRole('button', { name: 'ลบ Apple' }).click()
  await expect(page.getByText('Apple', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'เลิกทำ' }).click()
  await expect(page.getByText('Apple', { exact: true })).toBeVisible()
  await expect.poll(async () => (await row.boundingBox())!.x).toBeGreaterThanOrEqual(0)

  await swipe(-200)
  await swipe(200)
  await expect.poll(async () => (await row.boundingBox())!.x).toBeGreaterThanOrEqual(0)

  await page.getByRole('button', { name: 'Challenge', exact: true }).click()
  await page.getByRole('button', { name: 'เริ่ม Challenge' }).click()
  await expect(page.getByRole('button', { name: 'เลือกคำตอบ' })).toBeHidden()
  await expect(page.getByTestId('challenge-prompt')).toBeInViewport()
  await page.getByRole('button', { name: 'ตั้งค่ารอบ' }).click()
  await expect(page.getByRole('button', { name: 'เลือกคำตอบ' })).toBeVisible()
  await page.getByRole('button', { name: 'ซ่อน' }).click()
  await expect(page.getByRole('button', { name: 'เลือกคำตอบ' })).toBeHidden()
})

test('asks for the password and signs in', async ({ page }) => {
  await page.route('**/api/session', route => route.fulfill({ json: { authRequired: true, authenticated: false } }))
  await page.route('**/api/login', async route => {
    const { password } = route.request().postDataJSON() as { password: string }
    if (password === 'open sesame') await route.fulfill({ json: { token: 'signed-token' } })
    else await route.fulfill({ status: 401, json: { error: 'รหัสผ่านไม่ถูกต้อง' } })
  })
  await page.route('**/api/cards', route => route.request().headers().authorization === 'Bearer signed-token'
    ? route.fulfill({ json: [] })
    : route.fulfill({ status: 401, json: { error: 'กรุณาเข้าสู่ระบบ' } }))
  await page.route('**/api/study-days', route => route.fulfill({ json: [] }))

  await page.goto('/')
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click()
  await expect(page.getByRole('alert')).toHaveText('กรุณาใส่รหัสผ่าน')
  await page.getByLabel('รหัสผ่าน').fill('guess')
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click()
  await expect(page.getByRole('alert')).toHaveText('รหัสผ่านไม่ถูกต้อง')
  await page.getByLabel('รหัสผ่าน').fill('open sesame')
  await page.getByRole('button', { name: 'เข้าสู่ระบบ' }).click()
  await expect(page.getByText('ยังไม่มีคำศัพท์')).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('flashcards.token.v1'))).toBe('signed-token')

  await page.evaluate(() => localStorage.setItem('flashcards.token.v1', 'expired'))
  await page.getByRole('button', { name: 'อ่านบัตรคำ' }).first().click()
  await page.getByRole('button', { name: 'คลังคำศัพท์' }).first().click()
  await page.reload()
  await expect(page.getByLabel('รหัสผ่าน')).toBeVisible()
})

test('settings, dark theme, daily practice with new words and editing from a challenge', async ({ page, request }) => {
  await reset(request, [
    { word: 'Apple', partOfSpeech: 'noun', meaning: 'แอปเปิล' },
    { word: 'Book', partOfSpeech: 'noun', meaning: 'หนังสือ' },
    { word: 'Cat', partOfSpeech: 'noun', meaning: 'แมว' },
  ])
  // Answers logged by earlier tests stay in the study history, so count from what is there today.
  const before = (await (await request.get(`${api}/study-days`)).json() as { date: string; answers: number }[]).find(day => day.date === localDay())?.answers ?? 0
  await page.goto('/')
  await expect(page.locator('aside').getByRole('button', { name: 'ฝึกวันนี้ (3 คำ)' })).toBeVisible()

  await page.locator('aside').getByRole('button', { name: 'ตั้งค่า' }).click()
  const settings = page.getByRole('dialog')
  await settings.getByRole('combobox', { name: 'คำใหม่ต่อวัน' }).click()
  await page.getByRole('option', { name: '5 คำ', exact: true }).click()
  await settings.getByRole('combobox', { name: 'เป้าหมายต่อวัน' }).click()
  await page.getByRole('option', { name: '10 คำ', exact: true }).click()
  await settings.getByRole('button', { name: 'มืด' }).click()
  await expect(page.locator('html')).toHaveClass(/dark/)
  await page.keyboard.press('Escape')
  await expect(page.locator('aside')).toContainText(`${before} / 10 คำ`)

  await page.reload()
  await expect(page.locator('html')).toHaveClass(/dark/)
  const background = await page.locator('body > #root > div').evaluate(element => getComputedStyle(element).backgroundColor)
  expect(background).not.toBe('rgb(244, 248, 247)')

  await page.locator('aside').getByRole('button', { name: 'ฝึกวันนี้ (3 คำ)' }).click()
  await expect(page.getByText('พร้อมฝึก 3 คำ')).toBeVisible()
  await expect(page.getByText(/ฝึกวันนี้ ·/)).toBeVisible()
  await page.getByRole('button', { name: 'ทบทวนความหมาย' }).click()
  await page.getByRole('button', { name: 'เริ่ม Challenge' }).click()
  await expect(page.getByTestId('challenge-prompt')).toHaveText('Apple')
  await page.getByRole('button', { name: 'แก้ไขคำนี้' }).click()
  await page.getByLabel('ความหมายภาษาไทย').fill('ผลแอปเปิล')
  await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click()
  await expect(page.getByRole('dialog')).toBeHidden()
  await page.getByRole('button', { name: 'ดูเฉลย' }).click()
  await expect(page.getByText('ผลแอปเปิล', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'จำได้', exact: true }).click()
  await expect(page.getByTestId('challenge-prompt')).toHaveText('Book')
  await expect(page.locator('aside')).toContainText(`${before + 1} / 10 คำ`)
  await expect(page.locator('aside')).toContainText('คำใหม่ 2')
})

test('the next question appears without waiting for the server to save', async ({ page, request }) => {
  await reset(request, [
    { word: 'Apple', partOfSpeech: 'noun', meaning: 'แอปเปิล' },
    { word: 'Book', partOfSpeech: 'noun', meaning: 'หนังสือ' },
  ])
  let release: (() => void) | undefined
  await page.route('**/api/cards/*/answer', async route => {
    await new Promise<void>(resolve => { release = resolve })
    await route.continue()
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Challenge', exact: true }).click()
  await page.getByRole('button', { name: 'เห็นคำแล้วพิมพ์' }).click()
  await page.getByRole('button', { name: 'เริ่ม Challenge' }).click()
  await page.getByLabel('พิมพ์คำศัพท์ภาษาอังกฤษ').fill('apple')
  await page.getByLabel('พิมพ์คำศัพท์ภาษาอังกฤษ').press('Enter')
  // The save is still held back by the route above, yet the round has moved on.
  await expect(page.getByText('คำที่ 2 จาก 2')).toBeVisible({ timeout: 1500 })
  release?.()
  await expect.poll(async () => (await (await request.get(`${api}/cards`)).json() as { word: string; correctCount: number }[]).find(card => card.word === 'Apple')?.correctCount).toBe(1)
})
