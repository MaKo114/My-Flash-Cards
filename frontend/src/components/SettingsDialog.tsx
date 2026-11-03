import type { ReactNode } from 'react'
import { Monitor, Moon, Sun, Volume2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { dailyGoals, newPerDayOptions, speechRates, type Settings, type Theme } from '@/lib/settings'
import { speak, speechSupported } from '@/lib/speech'

const themes: { value: Theme; label: string; icon: ReactNode }[] = [
  { value: 'system', label: 'ตามระบบ', icon: <Monitor size={16} /> },
  { value: 'light', label: 'สว่าง', icon: <Sun size={16} /> },
  { value: 'dark', label: 'มืด', icon: <Moon size={16} /> },
]
const rateLabels: Record<number, string> = { 0.75: 'ช้า', 1: 'ปกติ', 1.25: 'เร็ว' }

function Row({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3">
      <div className="min-w-0">
        <label htmlFor={htmlFor} className="text-sm font-semibold text-slate-800">{label}</label>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      {children}
    </div>
  )
}

// Preferences that apply on this device: daily targets, the reading voice and the color theme.
export function SettingsDialog({ open, onOpenChange, settings, onChange }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  settings: Settings
  onChange: (patch: Partial<Settings>) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle className="text-xl font-bold text-slate-900">ตั้งค่า</DialogTitle>
        <DialogDescription className="mt-1 text-sm text-slate-500">บันทึกไว้ในเบราว์เซอร์ของอุปกรณ์นี้</DialogDescription>

        <section className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">ฝึกประจำวัน</h3>
          <div className="divide-y divide-slate-100">
            <Row label="เป้าหมายต่อวัน" hint="จำนวนคำที่ตั้งใจตอบใน Challenge" htmlFor="daily-goal">
              <Select
                id="daily-goal"
                label="เป้าหมายต่อวัน"
                value={String(settings.dailyGoal)}
                onValueChange={value => onChange({ dailyGoal: Number(value) })}
                options={dailyGoals.map(goal => ({ value: String(goal), label: goal ? `${goal} คำ` : 'ไม่ตั้ง' }))}
                className="w-32"
              />
            </Row>
            <Row label="คำใหม่ต่อวัน" hint="คำที่ยังไม่เคยฝึกซึ่งเพิ่มเข้า “ฝึกวันนี้”" htmlFor="new-per-day">
              <Select
                id="new-per-day"
                label="คำใหม่ต่อวัน"
                value={String(settings.newPerDay)}
                onValueChange={value => onChange({ newPerDay: Number(value) })}
                options={newPerDayOptions.map(count => ({ value: String(count), label: count ? `${count} คำ` : 'ไม่เพิ่ม' }))}
                className="w-32"
              />
            </Row>
          </div>
        </section>

        <section className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">เสียงอ่าน</h3>
          <div className="divide-y divide-slate-100">
            <Row label="ความเร็ว" htmlFor="speech-rate">
              <Select
                id="speech-rate"
                label="ความเร็วเสียงอ่าน"
                value={String(settings.speechRate)}
                onValueChange={value => onChange({ speechRate: Number(value) })}
                options={speechRates.map(rate => ({ value: String(rate), label: rateLabels[rate] }))}
                className="w-32"
              />
            </Row>
            <Row label="สำเนียง" htmlFor="speech-accent">
              <Select
                id="speech-accent"
                label="สำเนียงเสียงอ่าน"
                value={settings.accent}
                onValueChange={value => onChange({ accent: value as Settings['accent'] })}
                options={[{ value: 'en-US', label: 'อเมริกัน' }, { value: 'en-GB', label: 'อังกฤษ' }]}
                className="w-32"
              />
            </Row>
          </div>
          {speechSupported && (
            <Button variant="secondary" size="sm" className="mt-1" onClick={() => speak('Practice makes perfect.')}>
              <Volume2 size={15} /> ทดลองฟัง
            </Button>
          )}
        </section>

        <section className="mt-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">ธีม</h3>
          <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="ธีม">
            {themes.map(theme => (
              <button
                key={theme.value}
                type="button"
                aria-pressed={settings.theme === theme.value}
                onClick={() => onChange({ theme: theme.value })}
                className={`flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border px-1 py-2.5 text-sm font-semibold ${settings.theme === theme.value ? 'border-teal-300 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600 hover:border-teal-200'}`}
              >
                {theme.icon}
                {theme.label}
              </button>
            ))}
          </div>
        </section>
      </DialogContent>
    </Dialog>
  )
}
