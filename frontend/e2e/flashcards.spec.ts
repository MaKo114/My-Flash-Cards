import { expect, test } from '@playwright/test'

const api = 'http://127.0.0.1:3002/api'

test('manage, import and study cards', async ({ page, request }) => {
  const existing = await request.get(`${api}/cards`)
  expect(existing.ok()).toBeTruthy()
  for (const card of await existing.json() as { id: number }[]) {
    expect((await request.delete(`${api}/cards/${card.id}`)).ok()).toBeTruthy()
  }

  await page.goto('/')
  await expect(page.getByText('ยังไม่มีคำศัพท์')).toBeVisible()
  const pageWidth = await page.evaluate(() => document.documentElement.clientWidth)
  const sidebarHeight = async () => page.locator('aside').evaluate(element => Math.round(element.getBoundingClientRect().height))
  expect(await sidebarHeight()).toBe(page.viewportSize()!.height)

  async function add(word: string, pos: string, meaning: string, hint = '') {
    await page.getByRole('button', { name: 'เพิ่มคำศัพท์' }).first().click()
    await page.getByLabel('คำศัพท์ภาษาอังกฤษ').fill(word)
    await page.getByLabel('ชนิดของคำ').fill(pos)
    await page.getByLabel('ความหมายภาษาไทย').fill(meaning)
    if (hint) await page.getByRole('textbox', { name: /คำใบ้/ }).fill(hint)
    await page.getByRole('button', { name: 'เพิ่มคำศัพท์' }).last().click()
  }

  await add('Apple', 'noun', 'แอปเปิล', 'ผลไม้สีแดง')
  await add('Book', 'noun', 'หนังสือ')
  const duplicate = await request.post(`${api}/cards`, { data: { word: 'apple', partOfSpeech: 'NOUN', meaning: 'ซ้ำ' } })
  expect(duplicate.status()).toBe(409)
  const differentPart = await request.post(`${api}/cards`, { data: { word: 'Apple', partOfSpeech: 'verb', meaning: 'คำอีกชนิด' } })
  expect(differentPart.status()).toBe(201)
  expect((await request.delete(`${api}/cards/${(await differentPart.json()).id}`)).ok()).toBeTruthy()
  await expect(page.getByText('Apple', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'แก้ไข Apple' }).click()
  await expect(page.getByRole('textbox', { name: /คำใบ้/ })).toHaveValue('ผลไม้สีแดง')
  await page.getByLabel('ความหมายภาษาไทย').fill('ผลแอปเปิล')
  await page.getByRole('button', { name: 'บันทึกการแก้ไข' }).click()
  await expect(page.getByText('ผลแอปเปิล')).toBeVisible()
  await page.reload()
  await expect(page.getByText('ผลแอปเปิล')).toBeVisible()

  await page.locator('input[type="file"]').setInputFiles({
    name: 'words.csv', mimeType: 'text/csv',
    buffer: Buffer.from('\ufeffคำศัพท์,ชนิดของคำ,ความหมาย\nApple,noun,คำซ้ำ\nAnt,noun,มด\nBad,verb,\n'),
  })
  await expect(page.getByText('เพิ่ม 1 คำ · ข้ามคำซ้ำ 1 คำ · ข้อมูลไม่ครบ/ผิดรูปแบบ 1 แถว')).toBeVisible()
  await page.getByRole('button', { name: 'A', exact: true }).click()
  await expect(page.getByText('Apple', { exact: true })).toBeVisible()
  await expect(page.getByText('Ant', { exact: true })).toBeVisible()
  await expect(page.getByText('Book', { exact: true })).not.toBeVisible()

  await page.getByRole('button', { name: 'เก็บไว้ทบทวน Apple' }).click()
  await page.getByRole('button', { name: 'อ่านบัตรคำ' }).click()
  expect(await sidebarHeight()).toBe(page.viewportSize()!.height)
  expect(await page.evaluate(() => document.documentElement.clientWidth)).toBe(pageWidth)
  await page.getByLabel('หมวดอักษร').selectOption('A')
  if (await page.getByTestId('front-value').textContent() !== 'Apple') await page.getByRole('button', { name: 'บัตรถัดไป' }).click()
  await expect(page.getByTestId('front-value')).toHaveText('Apple')
  await page.getByRole('button', { name: 'ดูคำใบ้' }).click()
  await expect(page.getByText('ผลไม้สีแดง')).toBeVisible()
  await page.getByRole('button', { name: 'พลิกบัตร' }).click()
  await expect(page.getByText('ผลไม้สีแดง')).not.toBeVisible()
  await page.getByRole('button', { name: 'พลิกบัตร' }).click()
  await page.getByRole('button', { name: 'สุ่มคำ ปิด' }).click()
  await expect(page.getByText('บัตรที่ 1 จาก 2')).toBeVisible()
  const first = await page.getByTestId('front-value').textContent()
  await expect(page.getByRole('button', { name: `ออกเสียง ${first}` })).toBeVisible()
  await page.getByRole('button', { name: 'พลิกบัตร' }).click()
  await expect(page.getByRole('button', { name: 'พลิกบัตร' })).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'บัตรถัดไป' }).click()
  const second = await page.getByTestId('front-value').textContent()
  expect(second).not.toBe(first)
  await page.getByRole('button', { name: 'THAI ก่อน' }).click()
  await expect(page.getByTestId('front-value')).toHaveText(second === 'Apple' ? 'ผลแอปเปิล' : 'มด')
  await page.getByRole('button', { name: 'พลิกบัตร' }).click()
  await expect(page.getByTestId('back-value')).toHaveText(second || '')
  await page.getByRole('button', { name: 'ต้องทบทวน', exact: true }).last().click()
  await expect(page.getByText('บัตรที่ 1 จาก 1')).toBeVisible()
  await page.getByRole('button', { name: 'อยู่ในคำที่ต้องทบทวน' }).click()
  await expect(page.getByText('ยังไม่มีบัตรในหมวดนี้')).toBeVisible()

  await page.getByRole('button', { name: 'คลังคำศัพท์', exact: true }).click()
  await page.getByRole('button', { name: 'ทั้งหมด', exact: true }).click()
  await page.getByRole('button', { name: /เฉพาะคำที่ต้องทบทวน/ }).click()
  page.once('dialog', dialog => dialog.accept())
  await page.getByRole('button', { name: 'ลบ Book' }).click()
  await expect(page.getByText('Book', { exact: true })).not.toBeVisible()
})
