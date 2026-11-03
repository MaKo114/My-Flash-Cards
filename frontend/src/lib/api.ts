import { normalizeCard, type Card, type CardFields, type ImportProgress, type ImportResult, type StudyDay } from './cards'

const tokenKey = 'flashcards.token.v1'
let unauthorizedHandler: (() => void) | null = null

export class UnauthorizedError extends Error {
  constructor() { super('กรุณาเข้าสู่ระบบ') }
}

export function readToken() {
  try { return localStorage.getItem(tokenKey) || '' } catch { return '' }
}

export function writeToken(token: string) {
  try {
    if (token) localStorage.setItem(tokenKey, token)
    else localStorage.removeItem(tokenKey)
  } catch {
    // Without storage the session lasts until the page is reloaded.
  }
}

// The app shows the sign-in screen when any request comes back 401.
export function onUnauthorized(handler: (() => void) | null) { unauthorizedHandler = handler }

function authHeaders(): Record<string, string> {
  const token = readToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

function unauthorized() {
  writeToken('')
  unauthorizedHandler?.()
  return new UnauthorizedError()
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response
  try { response = await fetch(url, { ...init, headers: { ...authHeaders(), ...init.headers } }) }
  catch { throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจว่า backend กำลังทำงาน') }
  if (response.status === 401 && !url.endsWith('/api/login')) throw unauthorized()
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
    for (const [name, value] of Object.entries(authHeaders())) xhr.setRequestHeader(name, value)
    xhr.upload.onprogress = event => {
      if (event.lengthComputable && event.total > 0) {
        onProgress({ phase: 'uploading', percent: Math.min(100, Math.round(event.loaded / event.total * 100)) })
      }
    }
    xhr.upload.onload = () => onProgress({ phase: 'processing', percent: 100 })
    xhr.onload = () => {
      if (xhr.status === 401) { reject(unauthorized()); return }
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

const card = (value: Promise<Card>) => value.then(normalizeCard)

export const api = {
  session: () => request<{ authRequired: boolean; authenticated: boolean }>('/api/session'),
  login: async (password: string) => {
    const { token } = await request<{ token: string }>('/api/login', { method: 'POST', ...json({ password }) })
    writeToken(token)
  },
  list: () => request<Card[]>('/api/cards').then(cards => cards.map(normalizeCard)),
  create: (fields: CardFields) => card(request<Card>('/api/cards', { method: 'POST', ...json(fields) })),
  update: (id: number, fields: CardFields) => card(request<Card>(`/api/cards/${id}`, { method: 'PUT', ...json(fields) })),
  review: (id: number, needsReview: boolean) => card(request<Card>(`/api/cards/${id}/review`, { method: 'PATCH', ...json({ needsReview }) })),
  answer: (id: number, correct: boolean, today: string) => card(request<Card>(`/api/cards/${id}/answer`, { method: 'POST', ...json({ correct, today }) })),
  studyDays: () => request<StudyDay[]>('/api/study-days'),
  delete: (id: number) => request<void>(`/api/cards/${id}`, { method: 'DELETE' }),
  // keepalive lets pending deletes finish while the page is closing.
  deleteOnExit: (id: number) => { void fetch(`/api/cards/${id}`, { method: 'DELETE', keepalive: true, headers: authHeaders() }).catch(() => undefined) },
  import: importCsv,
}
