import type { Card, CardFields, ImportResult } from './cards'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  let response: Response
  try { response = await fetch(url, init) }
  catch { throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจว่า backend กำลังทำงาน') }
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error || 'ทำรายการไม่สำเร็จ')
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

const json = (body: unknown) => ({ headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

export const api = {
  list: () => request<Card[]>('/api/cards'),
  create: (fields: CardFields) => request<Card>('/api/cards', { method: 'POST', ...json(fields) }),
  update: (id: number, fields: CardFields) => request<Card>(`/api/cards/${id}`, { method: 'PUT', ...json(fields) }),
  review: (id: number, needsReview: boolean) => request<Card>(`/api/cards/${id}/review`, { method: 'PATCH', ...json({ needsReview }) }),
  delete: (id: number) => request<void>(`/api/cards/${id}`, { method: 'DELETE' }),
  import: (file: File) => { const body = new FormData(); body.append('file', file); return request<ImportResult>('/api/cards/import', { method: 'POST', body }) },
}
