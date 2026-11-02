import type { Card, CardFields, ImportProgress, ImportResult } from './cards'

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

function importCsv(file: File, onProgress: (progress: ImportProgress) => void): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const body = new FormData()
    body.append('file', file)
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/cards/import')
    xhr.upload.onprogress = event => {
      if (event.lengthComputable && event.total > 0) {
        onProgress({ phase: 'uploading', percent: Math.min(100, Math.round(event.loaded / event.total * 100)) })
      }
    }
    xhr.upload.onload = () => onProgress({ phase: 'processing', percent: 100 })
    xhr.onload = () => {
      let parsed: unknown
      try { parsed = JSON.parse(xhr.responseText) }
      catch { parsed = null }
      const response = parsed && typeof parsed === 'object' ? parsed as { error?: string } & Partial<ImportResult> : {}
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(response.error || 'นำเข้า CSV ไม่สำเร็จ'))
      } else if (typeof response.added !== 'number' || typeof response.merged !== 'number' || typeof response.skipped !== 'number' || typeof response.invalid !== 'number' || !Array.isArray(response.issues)) {
        reject(new Error('เซิร์ฟเวอร์ตอบผลนำเข้า CSV ไม่ถูกต้อง'))
      } else {
        resolve(response as ImportResult)
      }
    }
    xhr.onerror = () => reject(new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองอีกครั้ง'))
    xhr.onabort = () => reject(new Error('ยกเลิกการนำเข้า CSV'))
    xhr.send(body)
  })
}

export const api = {
  list: () => request<Card[]>('/api/cards'),
  create: (fields: CardFields) => request<Card>('/api/cards', { method: 'POST', ...json(fields) }),
  update: (id: number, fields: CardFields) => request<Card>(`/api/cards/${id}`, { method: 'PUT', ...json(fields) }),
  review: (id: number, needsReview: boolean) => request<Card>(`/api/cards/${id}/review`, { method: 'PATCH', ...json({ needsReview }) }),
  delete: (id: number) => request<void>(`/api/cards/${id}`, { method: 'DELETE' }),
  import: importCsv,
}
