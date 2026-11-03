import type { ReactNode } from 'react'
import { CalendarCheck, RotateCcw, Shuffle, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import type { Filters } from '@/hooks/useChallengeRound'

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const letterOptions = [{ value: 'ALL', label: 'ทั้งหมด' }, ...alphabet.map(letter => ({ value: letter, label: letter }))]

function ToggleButton({ pressed, onClick, tone, children }: { pressed: boolean; onClick: () => void; tone: 'amber' | 'teal'; children: ReactNode }) {
  const on = tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-teal-300 bg-teal-50 text-teal-800'
  return (
    <button aria-pressed={pressed} onClick={onClick} className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${pressed ? on : 'border-slate-200 text-slate-600'}`}>
      {children}
    </button>
  )
}

// Filters shared by "อ่านบัตรคำ" and Challenge: letter, starred words, due words and shuffle.
// `extra` is a second row the page can add (round size and question language in Challenge).
export function PracticeToolbar({ filters, onFiltersChange, dueCount, shuffled, onToggleShuffle, onReshuffle, extra, className = '' }: {
  filters: Filters
  onFiltersChange: (patch: Partial<Filters>) => void
  dueCount: number
  shuffled: boolean
  onToggleShuffle: () => void
  onReshuffle: () => void
  extra?: ReactNode
  className?: string
}) {
  return (
    <div className={`mb-4 flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-surface p-3 shadow-sm sm:gap-3 sm:p-4 ${className || 'flex'}`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
        <label htmlFor="letter-filter">หมวดอักษร</label>
        <Select id="letter-filter" label="หมวดอักษร" value={filters.letter} onValueChange={letter => onFiltersChange({ letter })} options={letterOptions} className="w-28" />
      </div>
      <ToggleButton tone="amber" pressed={filters.reviewOnly} onClick={() => onFiltersChange({ reviewOnly: !filters.reviewOnly })}>
        <Star size={16} fill={filters.reviewOnly ? 'currentColor' : 'none'} /> ต้องทบทวน
      </ToggleButton>
      <ToggleButton tone="teal" pressed={filters.dueOnly} onClick={() => onFiltersChange({ dueOnly: !filters.dueOnly })}>
        <CalendarCheck size={16} /> ถึงกำหนด {dueCount}
      </ToggleButton>
      <ToggleButton tone="teal" pressed={shuffled} onClick={onToggleShuffle}>
        <Shuffle size={16} /> สุ่มคำ {shuffled ? 'เปิด' : 'ปิด'}
      </ToggleButton>
      {shuffled && <Button variant="ghost" size="sm" onClick={onReshuffle}><RotateCcw size={15} /> สุ่มใหม่</Button>}
      {extra}
    </div>
  )
}

// Short text describing the active filters, e.g. "หมวด A · ต้องทบทวน".
export function filterLabel(filters: Filters) {
  return [
    filters.letter === 'ALL' ? 'ทุกหมวด' : `หมวด ${filters.letter}`,
    filters.reviewOnly && 'ต้องทบทวน',
    filters.dueOnly && 'ถึงกำหนด',
  ].filter(Boolean).join(' · ')
}
