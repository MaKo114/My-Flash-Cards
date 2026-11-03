import { useState } from 'react'
import { CalendarCheck, Flame, Target, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isDue, localDay, memoryLevel, studyStreak, type Card, type MemoryLevel, type StudyDay } from '@/lib/cards'

// One teal ramp from pale (new) to deep (mastered); in dark mode it runs from dim to bright instead.
const levels: { key: MemoryLevel; label: string; description: string; color: string }[] = [
  { key: 'new', label: 'ยังไม่เคยฝึก', description: 'ยังไม่เคยตอบใน Challenge', color: 'bg-teal-100 dark:bg-[#134e4a]' },
  { key: 'learning', label: 'กำลังจำ', description: 'เพิ่งเริ่ม หรือเพิ่งตอบผิด', color: 'bg-teal-300 dark:bg-[#0f766e]' },
  { key: 'familiar', label: 'เริ่มคุ้น', description: 'ตอบถูกติดกัน 2–3 ครั้ง', color: 'bg-teal-600 dark:bg-[#14b8a6]' },
  { key: 'mastered', label: 'จำได้แม่น', description: 'ตอบถูกติดกัน 4 ครั้งขึ้นไป', color: 'bg-teal-800 dark:bg-[#99f6e4]' },
]

const shortDate = new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'short' })

function lastDays(today: string, count: number) {
  const cursor = new Date(`${today}T12:00:00`)
  cursor.setDate(cursor.getDate() - count + 1)
  return Array.from({ length: count }, () => { const day = localDay(cursor); cursor.setDate(cursor.getDate() + 1); return day })
}

function percent(part: number, whole: number) {
  return whole ? Math.round(part / whole * 100) : 0
}

function Tile({ icon, label, value, unit, note, action }: { icon: React.ReactNode; label: string; value: number | string; unit?: string; note?: string; action?: React.ReactNode }) {
  return <div className="flex flex-col rounded-2xl border border-slate-200/80 bg-surface p-4 shadow-sm sm:p-5">
    <div className="flex items-center gap-2 text-sm font-medium text-slate-600">{icon}{label}</div>
    <p className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{value}{unit && <span className="ml-1.5 text-sm font-medium text-slate-500">{unit}</span>}</p>
    {note && <p className="mt-1 text-xs text-slate-500">{note}</p>}
    {action && <div className="mt-auto pt-3">{action}</div>}
  </div>
}

function ActivityChart({ days, today }: { days: StudyDay[]; today: string }) {
  const [active, setActive] = useState<string | null>(null)
  const byDate = new Map(days.map(day => [day.date, day]))
  const series = lastDays(today, 14).map(date => byDate.get(date) ?? { date, answers: 0, correct: 0 })
  const max = Math.max(1, ...series.map(day => day.answers))
  const shown = series.find(day => day.date === active)
  const label = (day: StudyDay) => `${shortDate.format(new Date(`${day.date}T12:00:00`))}: ตอบ ${day.answers} คำ${day.answers ? ` · ถูก ${percent(day.correct, day.answers)}%` : ''}`
  return <div>
    <div className="flex min-h-5 items-baseline justify-between gap-3 text-xs text-slate-500"><span>สูงสุด {max} คำต่อวัน</span><span aria-live="polite" className="font-medium text-slate-700">{shown ? label(shown) : 'แตะหรือชี้แท่งเพื่อดูรายละเอียด'}</span></div>
    <div className="mt-2 flex h-36 items-end gap-[2px] border-b border-slate-200" aria-hidden="true" onMouseLeave={() => setActive(null)}>
      {series.map(day => <button key={day.date} type="button" tabIndex={-1} onMouseEnter={() => setActive(day.date)} onFocus={() => setActive(day.date)} onClick={() => setActive(day.date)} className="group flex h-full min-w-0 flex-1 items-end justify-center">
        <span className={`w-full max-w-7 rounded-t-[4px] ${day.answers ? active === day.date ? 'bg-teal-800' : 'bg-teal-600 group-hover:bg-teal-700' : ''}`} style={{ height: day.answers ? `${Math.max(4, day.answers / max * 100)}%` : 0 }} />
      </button>)}
    </div>
    <div className="mt-1.5 flex justify-between text-[11px] text-slate-500" aria-hidden="true"><span>{shortDate.format(new Date(`${series[0].date}T12:00:00`))}</span><span>วันนี้</span></div>
    <table className="sr-only"><caption>จำนวนคำที่ตอบใน Challenge 14 วันล่าสุด</caption><thead><tr><th>วันที่</th><th>ตอบ</th><th>ถูก</th></tr></thead><tbody>{series.map(day => <tr key={day.date}><td>{day.date}</td><td>{day.answers}</td><td>{day.correct}</td></tr>)}</tbody></table>
  </div>
}

function MemoryBar({ cards }: { cards: Card[] }) {
  const counts = levels.map(level => ({ ...level, count: cards.filter(card => memoryLevel(card) === level.key).length }))
  return <div>
    <div className="flex h-2.5 gap-[2px]" aria-hidden="true">{counts.filter(level => level.count > 0).map(level => <span key={level.key} title={`${level.label} ${level.count} คำ`} className={`${level.color} h-full rounded-full`} style={{ flexGrow: level.count, flexBasis: 0 }} />)}</div>
    <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{counts.map(level => <li key={level.key} className="flex items-start gap-2"><span aria-hidden="true" className={`mt-1 h-3 w-3 shrink-0 rounded-sm ${level.color}`} /><div className="min-w-0"><p className="text-sm font-semibold text-slate-800">{level.label} <span className="font-bold text-slate-900">{level.count}</span></p><p className="text-xs leading-5 text-slate-500">{level.description}</p></div></li>)}</ul>
  </div>
}

// "สถิติ": streak, today's answers against the goal, a 14-day chart, memory levels and hard words.
export function StatsView({ cards, days, loading, error, dailyGoal, onReviewDue, footer }: {
  cards: Card[]
  days: StudyDay[]
  loading: boolean
  error: string
  dailyGoal: number
  onReviewDue: () => void
  footer?: React.ReactNode
}) {
  const today = localDay()
  const todayStats = days.find(day => day.date === today)
  const answers = days.reduce((sum, day) => sum + day.answers, 0)
  const correct = days.reduce((sum, day) => sum + day.correct, 0)
  const due = cards.filter(card => isDue(card, today)).length
  const streak = studyStreak(days, today)
  const hardest = cards.filter(card => card.wrongCount > 0).sort((a, b) => b.wrongCount - a.wrongCount || a.correctCount - b.correctCount || a.word.localeCompare(b.word)).slice(0, 10)

  return <div className="space-y-6">
    <div><h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">สถิติการฝึก</h2><p className="mt-1 text-sm text-slate-500">นับจากคำตอบใน Challenge ทุกรูปแบบ</p></div>
    {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
    <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
      <Tile icon={<Flame size={16} className="text-orange-500" />} label="ฝึกต่อเนื่อง" value={loading ? '–' : streak} unit="วัน" note={todayStats ? 'วันนี้ฝึกแล้ว' : streak ? 'ฝึกวันนี้เพื่อไม่ให้ขาด' : 'เริ่มฝึกวันนี้'} />
      <Tile icon={<Target size={16} className="text-teal-700" />} label="วันนี้ตอบ" value={loading ? '–' : todayStats?.answers ?? 0} unit="คำ" note={[dailyGoal ? `เป้าหมาย ${dailyGoal} คำ` : '', todayStats ? `ถูก ${percent(todayStats.correct, todayStats.answers)}%` : ''].filter(Boolean).join(' · ') || undefined} />
      <Tile icon={<CalendarCheck size={16} className="text-amber-600" />} label="ถึงกำหนดทบทวน" value={due} unit="คำ" action={due > 0 ? <Button size="sm" onClick={onReviewDue}>ทบทวนเลย</Button> : <p className="text-xs text-slate-500">ไม่มีคำค้างทบทวน</p>} />
      <Tile icon={<TrendingUp size={16} className="text-teal-700" />} label="ตอบถูกรวม" value={loading ? '–' : `${percent(correct, answers)}%`} note={`จาก ${answers} คำตอบ`} />
    </div>
    <section className="rounded-2xl border border-slate-200/80 bg-surface p-4 shadow-sm sm:p-6"><h3 className="text-base font-bold text-slate-900">จำนวนคำที่ตอบ 14 วันล่าสุด</h3><div className="mt-3"><ActivityChart days={days} today={today} /></div></section>
    <section className="rounded-2xl border border-slate-200/80 bg-surface p-4 shadow-sm sm:p-6"><h3 className="text-base font-bold text-slate-900">ระดับความจำ</h3><p className="mt-1 text-xs text-slate-500">ตอบถูกครั้งต่อไปจะเว้นนานขึ้นก่อนถามซ้ำ: 1, 3, 7, 14, 30 และ 60 วัน ตอบผิดจะกลับไปเริ่มใหม่</p><div className="mt-4"><MemoryBar cards={cards} /></div></section>
    <section className="rounded-2xl border border-slate-200/80 bg-surface p-4 shadow-sm sm:p-6"><h3 className="text-base font-bold text-slate-900">คำที่ตอบผิดบ่อย</h3>
      {hardest.length === 0 ? <p className="mt-2 text-sm text-slate-500">ยังไม่มีคำที่ตอบผิด</p> : <ol className="mt-3 divide-y divide-slate-100">{hardest.map((card, index) => <li key={card.id} className="flex items-baseline gap-3 py-2.5"><span className="w-5 shrink-0 text-right text-xs font-bold text-slate-400">{index + 1}</span><span lang="en" className="shrink-0 font-bold text-slate-900">{card.word}</span><span className="min-w-0 flex-1 truncate text-sm text-slate-600" title={card.meaning}>{card.meaning}</span><span className="shrink-0 text-xs font-semibold text-rose-700">ผิด {card.wrongCount}</span><span className="shrink-0 text-xs text-slate-500">ถูก {card.correctCount}</span></li>)}</ol>}
    </section>
    {footer}
  </div>
}
