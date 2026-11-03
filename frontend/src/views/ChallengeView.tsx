import { useEffect, useState, type ReactNode } from 'react'
import { SlidersHorizontal, Target } from 'lucide-react'
import { ChallengePanel } from '@/components/challenge/ChallengePanel'
import { RoundStart, RoundSummary } from '@/components/challenge/RoundScreens'
import { EmptyState } from '@/components/EmptyState'
import { LanguageToggle } from '@/components/LanguageToggle'
import { filterLabel } from '@/components/PracticeToolbar'
import { ProgressBar } from '@/components/ProgressBar'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import type { ChallengeRound, Filters } from '@/hooks/useChallengeRound'
import type { Card } from '@/lib/cards'
import { roundSizes, type ChallengeMode, type Language } from '@/lib/settings'

const modes: { mode: ChallengeMode; label: string }[] = [
  { mode: 'copy', label: 'เห็นคำแล้วพิมพ์' },
  { mode: 'listen', label: 'ฟังแล้วพิมพ์' },
  { mode: 'meaning', label: 'ทบทวนความหมาย' },
  { mode: 'choice', label: 'เลือกคำตอบ' },
]

const startHints: Record<ChallengeMode, string> = {
  copy: 'เสียงคำศัพท์จะเล่นหลังจากกดเริ่ม',
  listen: 'เสียงคำศัพท์จะเล่นหลังจากกดเริ่ม',
  meaning: 'กดเริ่มเมื่อพร้อมทบทวนความหมาย',
  choice: 'เลือกคำตอบที่ถูกจาก 4 ตัวเลือก',
}

// The Challenge page: mode tabs, filters, then the start screen, one question at a time, or the summary.
export function ChallengeView({ round, cards, filters, mode, onModeChange, firstLanguage, onLanguageChange, roundSize, onRoundSizeChange, shuffled, soundEffects, onToggleSoundEffects, onRestart, onEdit, onGoToLibrary, toolbar }: {
  round: ChallengeRound
  cards: Card[]
  filters: Filters
  mode: ChallengeMode
  onModeChange: (mode: ChallengeMode) => void
  firstLanguage: Language
  onLanguageChange: (language: Language) => void
  roundSize: number
  onRoundSizeChange: (size: number) => void
  shuffled: boolean
  soundEffects: boolean
  onToggleSoundEffects: () => void
  onRestart: () => void
  onEdit: (card: Card) => void
  onGoToLibrary: () => void
  toolbar: (options: { extra: ReactNode; className?: string }) => ReactNode
}) {
  // On phones the settings fold into one line once a round is running, so the question stays on screen.
  const [settingsOpen, setSettingsOpen] = useState(false)
  useEffect(() => { setSettingsOpen(false) }, [round.run])
  const running = round.started && !round.done
  const folded = running && !settingsOpen
  const asksLanguage = mode === 'meaning' || mode === 'choice'
  const roundLabel = round.kind === 'retry' ? 'ฝึกคำที่ยังจำไม่ได้' : round.kind === 'daily' ? 'ฝึกวันนี้' : filterLabel(filters)
  const missedWords = round.missedIds.map(id => cards.find(card => card.id === id)).filter((card): card is Card => card !== undefined)
  const position = round.started ? Math.min(round.position, round.ids.length - 1) + 1 : 0
  const percent = round.done ? 100 : round.ids.length ? position / round.ids.length * 100 : 0

  const roundOptions = (
    <div className="flex w-full flex-wrap items-center gap-x-6 gap-y-2 border-t border-slate-100 pt-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
        <label htmlFor="round-size">คำต่อรอบ</label>
        <Select
          id="round-size"
          label="จำนวนคำต่อรอบ"
          value={String(roundSize)}
          onValueChange={value => onRoundSizeChange(Number(value))}
          options={roundSizes.map(size => ({ value: String(size), label: size ? `${size} คำ` : 'ทุกคำ' }))}
          className="w-28"
        />
      </div>
      {asksLanguage && <LanguageToggle label="คำถาม" value={firstLanguage} onChange={onLanguageChange} />}
    </div>
  )

  function content() {
    if (round.ids.length === 0) {
      return (
        <EmptyState
          icon={<Target size={28} />}
          title={filters.dueOnly ? 'วันนี้ไม่มีคำถึงกำหนดทบทวน' : 'ยังไม่มีคำสำหรับ Challenge'}
          description={filters.dueOnly ? 'ทบทวนครบแล้ว หรือปิดตัวกรองถึงกำหนดเพื่อฝึกคำอื่น' : 'ลองเปลี่ยนหมวดอักษรหรือปิดตัวกรองคำที่ต้องทบทวนและถึงกำหนด'}
          action={<Button variant="secondary" onClick={onGoToLibrary}>ไปคลังคำศัพท์</Button>}
        />
      )
    }
    if (round.done) {
      return (
        <RoundSummary
          rememberedCount={round.rememberedCount}
          missedWords={missedWords}
          nextBatch={round.hasNextBatch ? { from: round.roundStart + roundSize + 1, to: Math.min(round.roundStart + 2 * roundSize, round.poolSize) } : undefined}
          onRetryMissed={round.retryMissed}
          onNextBatch={round.nextBatch}
          onRestart={onRestart}
        />
      )
    }
    if (!round.started) {
      const partial = round.kind === 'filters' && round.ids.length < round.poolSize
      return (
        <RoundStart
          count={round.ids.length}
          rangeLabel={partial ? `คำที่ ${round.roundStart + 1}–${round.roundStart + round.ids.length} จาก ${round.poolSize} คำ${shuffled ? ' (สุ่มลำดับ)' : ''}` : undefined}
          description={`${roundLabel} · ${startHints[mode]}`}
          onStart={() => round.setStarted(true)}
        />
      )
    }
    if (!round.current) {
      return <EmptyState icon={<Target size={28} />} title="ไม่พบคำศัพท์" description="กลับไปคลังคำศัพท์แล้วเริ่มรอบใหม่" action={<Button onClick={onRestart}>เริ่มรอบใหม่</Button>} />
    }
    return (
      <ChallengePanel
        key={`${round.run}-${round.current.id}-${firstLanguage}-${mode}`}
        card={round.current}
        pool={cards}
        mode={mode}
        firstLanguage={firstLanguage}
        soundEffects={soundEffects}
        onToggleSoundEffects={onToggleSoundEffects}
        onAssess={round.assess}
        onEdit={() => onEdit(round.current!)}
      />
    )
  }

  return (
    <div className="mx-auto max-w-3xl">
      {!round.started && (
        <div className="mb-5">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">ท้าทายความจำ</h2>
          <p className="mt-1 text-sm text-slate-500">ฝึกพิมพ์ ฟังเสียง ทบทวนความหมาย หรือทำข้อสอบแบบเลือกตอบทีละคำ</p>
        </div>
      )}

      {running && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-slate-200/80 bg-surface px-3 py-2 sm:hidden">
          <span className="min-w-0 truncate text-sm font-semibold text-slate-700">
            {modes.find(item => item.mode === mode)?.label}{asksLanguage ? ` · ถาม ${firstLanguage}` : ''}
          </span>
          <button
            type="button"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen(value => !value)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-teal-800 hover:bg-teal-50"
          >
            <SlidersHorizontal size={15} /> {settingsOpen ? 'ซ่อน' : 'ตั้งค่ารอบ'}
          </button>
        </div>
      )}

      <div className={`mb-3 grid-cols-2 gap-2 sm:grid sm:grid-cols-4 ${folded ? 'hidden' : 'grid'}`} role="group" aria-label="รูปแบบ Challenge">
        {modes.map(item => (
          <button
            key={item.mode}
            type="button"
            aria-pressed={mode === item.mode}
            onClick={() => onModeChange(item.mode)}
            className={`whitespace-nowrap rounded-xl border px-1 py-2 text-sm font-semibold sm:px-2 ${mode === item.mode ? 'border-teal-300 bg-teal-50 text-teal-800' : 'border-slate-200 bg-surface text-slate-600 hover:border-teal-200'}`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {toolbar({ extra: roundOptions, className: folded ? 'hidden sm:flex' : undefined })}
      {round.started && <ProgressBar label={`คำที่ ${position} จาก ${round.ids.length}`} detail={roundLabel} percent={percent} />}
      {content()}
    </div>
  )
}
