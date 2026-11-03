import { Lightbulb } from 'lucide-react'
import { PartBadges } from '@/components/PartBadges'
import { fitTextClass, type Card } from '@/lib/cards'
import type { Language } from '@/lib/settings'

// A flash card that flips in 3D. Front and back are two faces stacked on top of each other;
// rotating the inner box 180° shows the back (see .study-card rules in index.css).
export function StudyCard({ card, firstLanguage, flipped, hintVisible, onFlip }: {
  card: Card
  firstLanguage: Language
  flipped: boolean
  hintVisible: boolean
  onFlip: () => void
}) {
  const englishFirst = firstLanguage === 'ENG'
  const frontText = englishFirst ? card.word : card.meaning
  const backText = englishFirst ? card.meaning : card.word

  return (
    <div
      className="study-card h-[300px] cursor-pointer select-none sm:h-[340px]"
      onClick={onFlip}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onFlip()
        }
      }}
      role="button"
      tabIndex={0}
      aria-label="พลิกบัตร"
      aria-pressed={flipped}
    >
      <div className="study-card-inner" style={{ transform: flipped ? 'rotateY(180deg)' : undefined }}>
        {/* Front */}
        <div className="study-face flex flex-col rounded-[28px] border border-teal-100 bg-gradient-to-br from-surface via-surface to-teal-50 p-5 shadow-[0_16px_50px_-20px_rgba(15,118,110,.18)] sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <span className="rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-teal-700">{englishFirst ? 'ENGLISH' : 'ความหมาย'}</span>
            <span className="text-xs font-medium text-slate-500">ด้านหน้า</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain py-3">
            <div className="my-auto flex flex-col items-center text-center">
              <span data-testid="front-value" lang={englishFirst ? 'en' : 'th'} className={`max-w-full break-words font-bold leading-tight text-slate-900 ${fitTextClass(frontText)}`}>{frontText}</span>
              {englishFirst && <PartBadges parts={card.partsOfSpeech} className="mt-3" />}
              {hintVisible && card.hint && (
                <span role="status" className="mt-4 max-w-[95%] rounded-xl bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
                  <Lightbulb size={16} className="mr-1 inline-block" />{card.hint}
                </span>
              )}
            </div>
          </div>
          <span className="text-center text-xs font-medium text-slate-500">แตะหรือคลิกเพื่อดูเฉลย</span>
        </div>

        {/* Back */}
        <div className="study-face back flex flex-col rounded-[28px] border border-teal-200 bg-accent p-5 text-white shadow-[0_16px_50px_-20px_rgba(15,118,110,.28)] sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider">{englishFirst ? 'ความหมาย' : 'ENGLISH'}</span>
            <span className="text-xs text-white/80">ด้านหลัง</span>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain py-3">
            <div className="my-auto flex flex-col items-center text-center">
              <span data-testid="back-value" lang={englishFirst ? 'th' : 'en'} className={`max-w-full break-words font-bold leading-tight ${fitTextClass(backText)}`}>{backText}</span>
              {!englishFirst && <PartBadges parts={card.partsOfSpeech} className="mt-3" />}
              {card.example && <p data-testid="back-example" lang="en" className="mt-4 max-w-[95%] text-sm italic leading-6 text-white/85">{card.example}</p>}
            </div>
          </div>
          <span className="text-center text-xs text-white/80">แตะหรือคลิกเพื่อกลับไปด้านหน้า</span>
        </div>
      </div>
    </div>
  )
}
