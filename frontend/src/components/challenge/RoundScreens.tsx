import { ArrowRight, RotateCcw, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Card } from '@/lib/cards'

// Before a round: how many words and which ones, plus the start button.
// Nothing is spoken until the user presses start.
export function RoundStart({ count, rangeLabel, description, onStart }: {
  count: number
  rangeLabel?: string
  description: string
  onStart: () => void
}) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center rounded-[28px] border border-teal-100 bg-gradient-to-br from-surface to-teal-50 px-6 py-10 text-center shadow-sm">
      <div className="rounded-2xl bg-teal-100 p-4 text-teal-700"><Target size={28} /></div>
      <h3 className="mt-5 text-xl font-bold text-slate-900">พร้อมฝึก {count} คำ</h3>
      {rangeLabel && <p className="mt-1 text-sm font-medium text-teal-800">{rangeLabel}</p>}
      <p className="mt-2 text-sm text-slate-600">{description}</p>
      <Button className="mt-6" onClick={onStart}>เริ่ม Challenge <ArrowRight size={17} /></Button>
    </div>
  )
}

// After a round: the score, the words still missed, and what to do next.
export function RoundSummary({ rememberedCount, missedWords, nextBatch, onRetryMissed, onNextBatch, onRestart }: {
  rememberedCount: number
  missedWords: Card[]
  nextBatch?: { from: number; to: number }
  onRetryMissed: () => void
  onNextBatch: () => void
  onRestart: () => void
}) {
  const missed = missedWords.length > 0
  // The most useful next step gets the filled (primary) button.
  const restartButton = <Button variant={missed || nextBatch ? 'secondary' : 'default'} onClick={onRestart}><RotateCcw size={17} /> เริ่มรอบใหม่</Button>

  return (
    <div className="rounded-2xl border border-teal-100 bg-surface px-5 py-10 text-center shadow-sm sm:px-8">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><Target size={28} /></div>
      <h3 className="mt-5 text-2xl font-bold text-slate-900">จบรอบ Challenge</h3>
      <p className="mt-2 text-sm text-slate-600">จำได้ {rememberedCount} คำ · ยังจำไม่ได้ {missedWords.length} คำ</p>

      {missed && (
        <div className="mx-auto mt-6 max-w-lg text-left">
          <h4 className="text-sm font-bold text-slate-700">คำที่ยังจำไม่ได้</h4>
          <ul aria-label="คำที่ยังจำไม่ได้" className="mt-2 max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-xl border border-slate-200">
            {missedWords.map(card => (
              <li key={card.id} className="flex items-baseline gap-3 px-4 py-2.5">
                <span lang="en" className="shrink-0 font-bold text-slate-900">{card.word}</span>
                <span className="min-w-0 truncate text-sm text-slate-600" title={card.meaning}>{card.meaning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-6 flex flex-col-reverse justify-center gap-2 sm:flex-row">
        {restartButton}
        {nextBatch && (
          <Button variant={missed ? 'secondary' : 'default'} onClick={onNextBatch}>
            ชุดถัดไป (คำที่ {nextBatch.from}–{nextBatch.to}) <ArrowRight size={17} />
          </Button>
        )}
        {missed && <Button onClick={onRetryMissed}><Target size={17} /> ฝึกเฉพาะคำที่ผิดอีกรอบ</Button>}
      </div>
    </div>
  )
}
