import { Pencil, Star, Trash2 } from 'lucide-react'
import { PartBadges } from '@/components/PartBadges'
import { SwipeAction, SwipeRow } from '@/components/SwipeRow'
import { Button } from '@/components/ui/button'
import type { Card } from '@/lib/cards'

// One word in the library list. On phones it is a two-line card whose edit/delete buttons
// sit behind a swipe; from md up it is a table row with all buttons visible.
export function CardRow({ card, selected, onToggleSelected, swiped, onSwipedChange, reviewSaving, onToggleReview, onEdit, onDelete }: {
  card: Card
  selected: boolean
  onToggleSelected: () => void
  swiped: boolean
  onSwipedChange: (open: boolean) => void
  reviewSaving: boolean
  onToggleReview: () => void
  onEdit: () => void
  onDelete: () => void
}) {
  return (
    <SwipeRow
      open={swiped}
      onOpenChange={onSwipedChange}
      actions={
        <>
          <SwipeAction label={`แก้ไข ${card.word}`} icon={<Pencil size={18} />} text="แก้ไข" tone="neutral" onClick={() => { onSwipedChange(false); onEdit() }} />
          <SwipeAction label={`ลบ ${card.word}`} icon={<Trash2 size={18} />} text="ลบ" tone="danger" onClick={onDelete} />
        </>
      }
    >
      <div className={`grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 md:grid-cols-[20px_1.2fr_1fr_1.5fr_120px] md:gap-4 md:px-6 md:py-4 ${selected ? 'bg-teal-50' : 'bg-surface'}`}>
        <input type="checkbox" aria-label={`เลือก ${card.word}`} checked={selected} onChange={onToggleSelected} className="h-4 w-4 accent-teal-700" />
        <span lang="en" title={card.word} className="min-w-0 truncate font-bold text-slate-900">{card.word}</span>
        <div className="col-span-2 col-start-2 md:col-auto"><PartBadges parts={card.partsOfSpeech} className="justify-start" /></div>
        <p title={card.meaning} className="col-span-2 col-start-2 line-clamp-2 min-w-0 break-words text-sm text-slate-600 md:col-auto">{card.meaning}</p>
        <div className="col-start-3 row-start-1 flex justify-end gap-0.5 md:col-auto md:row-auto md:gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label={card.needsReview ? `ยกเลิกทบทวน ${card.word}` : `เก็บไว้ทบทวน ${card.word}`}
            title={card.needsReview ? 'ยกเลิกทบทวน' : 'เก็บไว้ทบทวน'}
            onClick={onToggleReview}
            disabled={reviewSaving}
            className={card.needsReview ? 'text-amber-500' : ''}
          >
            <Star size={17} fill={card.needsReview ? 'currentColor' : 'none'} />
          </Button>
          {/* Phones reach these through the swipe instead. */}
          <Button variant="ghost" size="icon" aria-label={`แก้ไข ${card.word}`} title="แก้ไข" onClick={onEdit} className="hidden md:inline-flex"><Pencil size={16} /></Button>
          <Button variant="danger" size="icon" aria-label={`ลบ ${card.word}`} title="ลบ" onClick={onDelete} className="hidden md:inline-flex"><Trash2 size={16} /></Button>
        </div>
      </div>
    </SwipeRow>
  )
}
