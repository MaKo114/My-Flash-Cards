import { useState, type FormEvent } from 'react'
import { LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Shown instead of the app when the server requires APP_PASSWORD and this device has no valid session.
export function LoginScreen({ appName, onLogin }: { appName: string; onLogin: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!password) {
      setError('กรุณาใส่รหัสผ่าน')
      return
    }
    setPending(true)
    setError('')
    try {
      await onLogin(password)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'เข้าสู่ระบบไม่สำเร็จ')
      setPending(false)
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-canvas px-4 py-10">
      <form onSubmit={submit} noValidate className="w-full max-w-sm rounded-[28px] border border-slate-200/80 bg-surface p-6 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <img src="/app-icon.svg" alt="" className="h-11 w-11 rounded-2xl shadow-md shadow-teal-100" />
          <div>
            <h1 className="text-lg font-bold text-slate-900">{appName}</h1>
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-slate-500">English · Thai</p>
          </div>
        </div>

        <div className="mt-8 flex items-center gap-2 text-sm font-semibold text-slate-700">
          <LockKeyhole size={16} className="text-teal-700" />
          <label htmlFor="password">รหัสผ่าน</label>
        </div>
        <Input
          id="password"
          type="password"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={event => { setPassword(event.target.value); setError('') }}
          aria-invalid={!!error}
          aria-describedby={error ? 'password-error' : undefined}
          className={`mt-2 ${error ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''}`}
        />
        {error && <p id="password-error" role="alert" className="mt-2 text-sm font-medium text-red-700">{error}</p>}

        <Button type="submit" disabled={pending} className="mt-5 w-full">{pending ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}</Button>
        <p className="mt-4 text-center text-xs leading-5 text-slate-500">เข้าสู่ระบบครั้งเดียวใช้งานได้ 30 วันบนอุปกรณ์นี้</p>
      </form>
    </main>
  )
}
