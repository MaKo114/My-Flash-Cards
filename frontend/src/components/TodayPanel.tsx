import { CalendarCheck, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

// Today's target and what is waiting: words due for review and new words to start.
// Shown in the sidebar on wide screens and at the top of the library on phones.
export function TodayPanel({ answersToday, dailyGoal, dueCount, newCount, onStart, className = '' }: {
  answersToday: number
  dailyGoal: number
  dueCount: number
  newCount: number
  onStart: () => void
  className?: string
}) {
  const goalPercent = dailyGoal ? Math.min(100, Math.round(answersToday / dailyGoal * 100)) : 0
  const goalReached = dailyGoal > 0 && answersToday >= dailyGoal
  const waiting = dueCount + newCount

  return (
    <section aria-label="ฝึกวันนี้" className={`rounded-2xl border border-teal-100 bg-teal-50/60 p-4 ${className}`}>
      {dailyGoal > 0 && (
        <div>
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold text-teal-800">เป้าหมายวันนี้</p>
            <p className="text-sm text-slate-600">
              <span className="text-lg font-bold text-slate-900">{answersToday}</span> / {dailyGoal} คำ
            </p>
          </div>
          <div
            role="progressbar"
            aria-label="ความคืบหน้าเป้าหมายวันนี้"
            aria-valuemin={0}
            aria-valuemax={dailyGoal}
            aria-valuenow={Math.min(answersToday, dailyGoal)}
            className="mt-2 h-2 overflow-hidden rounded-full bg-teal-100"
          >
            <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${goalPercent}%` }} />
          </div>
          {goalReached && <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-teal-800"><Sparkles size={13} /> ถึงเป้าหมายแล้ว เก่งมาก!</p>}
        </div>
      )}

      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-700 ${dailyGoal > 0 ? 'mt-3' : ''}`}>
        <span className="flex items-center gap-1.5"><CalendarCheck size={15} className="text-teal-700" /> ถึงกำหนดทบทวน <b className="text-slate-900">{dueCount}</b></span>
        <span>คำใหม่ <b className="text-slate-900">{newCount}</b></span>
      </div>
      {waiting > 0
        ? <Button size="sm" className="mt-3 w-full" onClick={onStart}>ฝึกวันนี้ ({waiting} คำ)</Button>
        : <p className="mt-2 text-xs text-slate-500">วันนี้ไม่มีคำค้างแล้ว ฝึกคำอื่นใน Challenge ได้</p>}
    </section>
  )
}
