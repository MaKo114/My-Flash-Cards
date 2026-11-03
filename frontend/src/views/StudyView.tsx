import { useEffect, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Layers3, Lightbulb, Pencil, RotateCcw, Star, Volume2 } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { LanguageToggle } from '@/components/LanguageToggle'
import { ProgressBar } from '@/components/ProgressBar'
import { StudyCard } from '@/components/study/StudyCard'
import { Button } from '@/components/ui/button'
import type { Card } from '@/lib/cards'
import type { Language } from '@/lib/settings'
import { speak, speechSupported } from '@/lib/speech'

function Key({ children }: { children: ReactNode }) {
  return <kbd className="rounded border border-slate-300 bg-surface px-1.5 py-0.5 font-sans">{children}</kbd>
}

// "อ่านบัตรคำ": flip through the filtered deck one card at a time.
// The parent remounts this view (via `key`) when the deck changes, which resets the position.
export function StudyView({ deck, detail, firstLanguage, onLanguageChange, paused, reviewSaving, onToggleReview, onEdit, onRestart, onGoToLibrary, toolbar }: {
  deck: Card[]
  detail: string
  firstLanguage: Language
  onLanguageChange: (language: Language) => void
  // True while a dialog is open, so the keyboard shortcuts do not fire behind it.
  paused: boolean
  reviewSaving: Set<number>
  onToggleReview: (card: Card) => void
  onEdit: (card: Card) => void
  onRestart: () => void
  onGoToLibrary: () => void
  toolbar: (options: { extra: ReactNode }) => ReactNode
}) {
  const [position, setPosition] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [hintVisible, setHintVisible] = useState(false)
  // Removing a star in "ต้องทบทวน" mode can shrink the deck under us, so clamp the index.
  const index = Math.min(position, Math.max(0, deck.length - 1))
  const card = deck[index]
  const last = index + 1 === deck.length

  function goTo(next: number) {
    setPosition(next)
    setFlipped(false)
    setHintVisible(false)
  }

  function flip() {
    setFlipped(value => !value)
    setHintVisible(false)
  }

  // ← → change card and Space flips, unless the user is typing or a dialog is open.
  useEffect(() => {
    if (paused) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, [role="combobox"], [role="listbox"], [role="dialog"]')) return
      if (event.key === 'ArrowRight' && index + 1 < deck.length) { event.preventDefault(); goTo(index + 1) }
      else if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); goTo(index - 1) }
      else if (event.key === ' ' && !target.closest('button, [role="button"]') && deck.length) { event.preventDefault(); flip() }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [paused, index, deck.length])

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">ฝึกจำทีละใบ</h2>
        <p className="mt-1 text-sm text-slate-500">พลิกบัตรเพื่อเฉลย และเก็บคำที่ยังจำไม่ได้ไว้ทบทวน</p>
      </div>
      {toolbar({ extra: <div className="sm:ml-auto"><LanguageToggle label="ด้านหน้า" value={firstLanguage} onChange={language => { onLanguageChange(language); setFlipped(false); setHintVisible(false) }} /></div> })}

      {!card ? (
        <EmptyState
          icon={<Layers3 size={28} />}
          title="ยังไม่มีบัตรในหมวดนี้"
          description="ลองเปลี่ยนหมวดอักษรหรือปิดตัวกรองคำที่ต้องทบทวนและถึงกำหนด"
          action={<Button variant="secondary" onClick={onGoToLibrary}>ไปคลังคำศัพท์</Button>}
        />
      ) : (
        <>
          <ProgressBar label={`บัตรที่ ${index + 1} จาก ${deck.length}`} detail={detail} percent={(index + 1) / deck.length * 100} />
          <StudyCard card={card} firstLanguage={firstLanguage} flipped={flipped} hintVisible={hintVisible} onFlip={flip} />

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
            <div className="flex w-full flex-wrap gap-2 sm:w-auto">
              {card.hint && !flipped && (
                <Button variant="secondary" onClick={() => setHintVisible(value => !value)}><Lightbulb size={17} /> {hintVisible ? 'ซ่อนคำใบ้' : 'ดูคำใบ้'}</Button>
              )}
              <Button
                variant="secondary"
                onClick={() => onToggleReview(card)}
                disabled={reviewSaving.has(card.id)}
                className={card.needsReview ? 'border-amber-200 bg-amber-50 text-amber-700' : ''}
              >
                <Star size={17} fill={card.needsReview ? 'currentColor' : 'none'} />
                <span className="sm:hidden">{card.needsReview ? 'ต้องทบทวน' : 'เก็บไว้ทบทวน'}</span>
                <span className="hidden sm:inline">{card.needsReview ? 'อยู่ในคำที่ต้องทบทวน' : 'จำไม่ได้ เก็บไว้ทบทวน'}</span>
              </Button>
              {speechSupported && (
                <Button variant="secondary" onClick={() => speak(card.word)} aria-label={`ออกเสียง ${card.word}`} title="ออกเสียง">
                  <Volume2 size={17} /><span className="hidden sm:inline">ออกเสียง</span>
                </Button>
              )}
              <Button variant="secondary" size="icon" className="h-10 w-10" onClick={() => onEdit(card)} aria-label="แก้ไขคำนี้" title="แก้ไขคำนี้">
                <Pencil size={16} />
              </Button>
            </div>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button variant="secondary" size="icon" className="h-10 w-10 shrink-0" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="บัตรก่อนหน้า" title="บัตรก่อนหน้า (←)">
                <ArrowLeft size={18} />
              </Button>
              {last
                ? <Button className="flex-1 sm:flex-none" onClick={() => { goTo(0); onRestart() }}><RotateCcw size={17} /> เริ่มรอบใหม่</Button>
                : <Button className="flex-1 sm:flex-none" onClick={() => goTo(index + 1)} title="บัตรถัดไป (→)">บัตรถัดไป <ArrowRight size={17} /></Button>}
            </div>
          </div>
          <p className="mt-5 hidden text-center text-xs text-slate-500 lg:block">
            ปุ่มลัด: <Key>Space</Key> พลิกบัตร · <Key>←</Key> <Key>→</Key> เปลี่ยนบัตร
          </p>
        </>
      )}
    </div>
  )
}
