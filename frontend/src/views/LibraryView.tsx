import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { BookOpen, CalendarCheck, Download, FileUp, Plus, Search, Star, Trash2, X } from 'lucide-react'
import { EmptyState } from '@/components/EmptyState'
import { ImportProgressNotice, ImportResultNotice } from '@/components/ImportNotices'
import { CardRow } from '@/components/library/CardRow'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import type { Filters } from '@/hooks/useChallengeRound'
import type { CardLibrary } from '@/hooks/useCardLibrary'
import { filterByPartOfSpeech, searchCards, type Card } from '@/lib/cards'
import type { ConfirmRequest } from '@/components/ConfirmDialog'

const pageSize = 50
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function StatTile({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-surface p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden rounded-xl bg-slate-50 p-2.5 sm:block">{icon}</div>
        <span className="text-sm font-medium text-slate-600">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900 sm:mt-3 sm:text-3xl">{value}<span className="ml-1.5 text-sm font-medium text-slate-500">คำ</span></p>
    </div>
  )
}

function FilterToggle({ pressed, onClick, tone, children }: { pressed: boolean; onClick: () => void; tone: 'amber' | 'teal'; children: ReactNode }) {
  const on = tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-teal-300 bg-teal-50 text-teal-800'
  const off = tone === 'amber' ? 'hover:border-amber-200' : 'hover:border-teal-200'
  return (
    <button aria-pressed={pressed} onClick={onClick} className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${pressed ? on : `border-slate-200 bg-surface text-slate-600 ${off}`}`}>
      {children}
    </button>
  )
}

// "คลังคำศัพท์": search, filter, select, import/export and manage every word.
export function LibraryView({ library, cards, filtered, filters, onFiltersChange, dueCount, reviewCount, today, onAdd, onEdit, confirm }: {
  library: CardLibrary
  cards: Card[]
  // Cards after the shared letter/star/due filters; search and part of speech are applied here.
  filtered: Card[]
  filters: Filters
  onFiltersChange: (patch: Partial<Filters>) => void
  dueCount: number
  reviewCount: number
  // Today's practice panel, shown at the top on phones (the sidebar shows it on wide screens).
  today: ReactNode
  onAdd: () => void
  onEdit: (card: Card) => void
  confirm: (request: ConfirmRequest) => void
}) {
  const [search, setSearch] = useState('')
  const [partFilter, setPartFilter] = useState('ALL')
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set())
  const [swipedId, setSwipedId] = useState<number | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const partOptions = useMemo(() => {
    const parts = new Set(cards.flatMap(card => card.partsOfSpeech.map(part => part.trim().toLowerCase())))
    if (partFilter !== 'ALL') parts.add(partFilter)
    return [...parts].filter(Boolean).sort()
  }, [cards, partFilter])
  const listed = useMemo(() => searchCards(filterByPartOfSpeech(filtered, partFilter), search), [filtered, partFilter, search])
  const shown = listed.slice(0, visibleCount)
  const selectedListed = listed.filter(card => selectedIds.has(card.id))
  const allShownSelected = shown.length > 0 && shown.every(card => selectedIds.has(card.id))
  const importing = library.importState !== null

  // Any change to what is listed starts again from the first page with nothing selected.
  useEffect(() => {
    setSelectedIds(new Set())
    setVisibleCount(pageSize)
  }, [filters, search, partFilter])

  function toggleSelected(id: number) {
    setSelectedIds(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllShown() {
    setSelectedIds(previous => {
      const next = new Set(previous)
      for (const card of shown) {
        if (allShownSelected) next.delete(card.id)
        else next.add(card.id)
      }
      return next
    })
  }

  function remove(card: Card) {
    setSwipedId(null)
    library.scheduleDelete([card], `ลบ “${card.word}” แล้ว`)
  }

  function removeSelected() {
    const chosen = selectedListed
    if (!chosen.length) return
    confirm({
      title: `ลบคำศัพท์ที่เลือก ${chosen.length} คำใช่ไหม?`,
      description: 'บัตรคำที่เลือกทั้งหมดจะถูกลบ กดเลิกทำได้ภายในไม่กี่วินาทีหลังลบ',
      confirmLabel: 'ลบ',
      danger: true,
      onConfirm: () => {
        setSelectedIds(new Set())
        library.scheduleDelete(chosen, `ลบ ${chosen.length} คำแล้ว`)
      },
    })
  }

  function clearAllFilters() {
    setSearch('')
    setPartFilter('ALL')
    onFiltersChange({ letter: 'ALL', reviewOnly: false, dueOnly: false })
  }

  const importButton = (
    <Button variant="secondary" disabled={importing} onClick={() => fileRef.current?.click()}><FileUp size={17} /> นำเข้า CSV</Button>
  )

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">คำศัพท์ทั้งหมด</h2>
          <p className="mt-1 text-sm text-slate-500">เก็บทุกคำใหม่ไว้ที่นี่ แล้วกลับมาทบทวนได้เสมอ</p>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          disabled={importing}
          className="hidden"
          aria-label="เลือกไฟล์ CSV"
          onChange={event => {
            const file = event.target.files?.[0]
            if (file) void library.importFile(file)
            event.target.value = ''
          }}
        />
        {cards.length > 0 && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={library.exportCsv}><Download size={17} /> ส่งออก CSV</Button>
            {importButton}
          </div>
        )}
      </div>

      {library.importState && <ImportProgressNotice fileName={library.importState.fileName} progress={library.importState.progress} />}
      {library.importResult && <ImportResultNotice result={library.importResult} onClose={library.clearImportResult} />}

      {cards.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={28} />}
          title="ยังไม่มีคำศัพท์"
          description="เริ่มสะสมคำศัพท์คำแรก หรือนำเข้าจากไฟล์ CSV ที่มีคอลัมน์ คำศัพท์, ชนิดของคำ, ความหมาย"
          action={<div className="flex flex-wrap justify-center gap-2"><Button onClick={onAdd}><Plus size={16} /> เพิ่มคำแรก</Button>{importButton}</div>}
        />
      ) : (
        <>
          <div className="mb-4 lg:hidden">{today}</div>
          <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4">
            <StatTile icon={<BookOpen size={18} className="text-teal-700" />} label="คำศัพท์ทั้งหมด" value={cards.length} />
            <StatTile icon={<Star size={18} className="text-amber-600" />} label="ต้องทบทวน" value={reviewCount} />
          </div>

          {/* Search and filters */}
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="hidden sm:block">
              <h3 className="text-base font-bold text-slate-900">รายการคำศัพท์</h3>
              <p className="text-xs text-slate-500">เลือกอักษรแรก ชนิดของคำ หรือค้นหาคำที่ต้องการ</p>
            </div>
            <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto">
              <div role="search" className="relative w-full sm:w-auto sm:min-w-64 sm:flex-1 xl:w-72 xl:flex-none">
                <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <Input aria-label="ค้นหาคำศัพท์" placeholder="ค้นหาคำศัพท์หรือความหมาย" value={search} onChange={event => setSearch(event.target.value)} className="pl-10 pr-10" />
                {search && (
                  <button type="button" aria-label="ล้างคำค้น" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                    <X size={16} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-slate-600">
                <label htmlFor="part-filter" className="sr-only sm:not-sr-only">ชนิดของคำ</label>
                <Select
                  id="part-filter"
                  label="กรองชนิดของคำ"
                  value={partFilter}
                  onValueChange={setPartFilter}
                  options={[{ value: 'ALL', label: 'ทุกชนิด' }, ...partOptions.map(part => ({ value: part, label: part }))]}
                  className="w-36"
                />
              </div>
              <FilterToggle tone="amber" pressed={filters.reviewOnly} onClick={() => onFiltersChange({ reviewOnly: !filters.reviewOnly })}>
                <Star size={15} fill={filters.reviewOnly ? 'currentColor' : 'none'} /> เฉพาะคำที่ต้องทบทวน
              </FilterToggle>
              <FilterToggle tone="teal" pressed={filters.dueOnly} onClick={() => onFiltersChange({ dueOnly: !filters.dueOnly })}>
                <CalendarCheck size={15} /> ถึงกำหนดทบทวน {dueCount}
              </FilterToggle>
            </div>
          </div>

          <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0" role="group" aria-label="กรองตามอักษรแรก">
            {['ALL', ...alphabet].map(letter => (
              <button
                key={letter}
                aria-pressed={filters.letter === letter}
                onClick={() => onFiltersChange({ letter })}
                className={`h-9 shrink-0 rounded-lg text-xs font-bold sm:h-8 ${letter === 'ALL' ? 'px-3' : 'min-w-9 px-1 sm:min-w-8'} ${filters.letter === letter ? 'bg-accent text-white' : 'border border-slate-200 bg-surface text-slate-600 hover:border-teal-300'}`}
              >
                {letter === 'ALL' ? 'ทั้งหมด' : letter}
              </button>
            ))}
          </div>

          {/* Selection bar */}
          {listed.length > 0 && (
            <div className="mb-3 flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600">
                <input type="checkbox" checked={allShownSelected} onChange={toggleAllShown} className="h-4 w-4 accent-teal-700" />
                เลือกทั้งหมดที่แสดง
              </label>
              {selectedListed.length > 0 ? (
                <>
                  <span className="text-sm text-slate-600">เลือก {selectedListed.length} คำ</span>
                  <Button variant="danger" size="sm" onClick={removeSelected}><Trash2 size={15} /> ลบที่เลือก</Button>
                  <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>ยกเลิกการเลือก</Button>
                </>
              ) : (
                <span className="ml-auto text-sm text-slate-500">พบ {listed.length} คำ</span>
              )}
              <p className="w-full text-xs text-slate-500 md:hidden">ปัดแถวไปทางซ้ายเพื่อแก้ไขหรือลบ</p>
            </div>
          )}

          {/* The list */}
          {listed.length === 0 ? (
            <EmptyState
              icon={<Search size={28} />}
              title={search.trim() ? 'ไม่พบคำที่ค้นหา' : 'ไม่พบคำศัพท์ในหมวดนี้'}
              description={search.trim() ? 'ลองเปลี่ยนคำค้นหรือปิดตัวกรองอื่น' : 'ลองเปลี่ยนตัวกรองอักษร ชนิดของคำ คำที่ต้องทบทวน หรือคำที่ถึงกำหนด'}
              action={<Button variant="secondary" onClick={clearAllFilters}><X size={16} /> ล้างตัวกรองทั้งหมด</Button>}
            />
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-surface shadow-sm">
              <div className="hidden grid-cols-[20px_1.2fr_1fr_1.5fr_120px] gap-4 border-b border-slate-100 bg-slate-50/70 px-6 py-3 text-xs font-bold text-slate-500 md:grid">
                <span /><span>คำศัพท์</span><span>ชนิดของคำ</span><span>ความหมาย</span><span className="text-right">จัดการ</span>
              </div>
              <div className="divide-y divide-slate-100">
                {shown.map(card => (
                  <CardRow
                    key={card.id}
                    card={card}
                    selected={selectedIds.has(card.id)}
                    onToggleSelected={() => toggleSelected(card.id)}
                    swiped={swipedId === card.id}
                    onSwipedChange={open => setSwipedId(open ? card.id : null)}
                    reviewSaving={library.reviewSaving.has(card.id)}
                    onToggleReview={() => void library.toggleReview(card)}
                    onEdit={() => onEdit(card)}
                    onDelete={() => remove(card)}
                  />
                ))}
              </div>
              {listed.length > shown.length && (
                <div className="flex flex-col items-center gap-2 border-t border-slate-100 px-4 py-4 sm:flex-row sm:justify-between sm:px-6">
                  <span className="text-sm text-slate-500">แสดง {shown.length} จาก {listed.length} คำ</span>
                  <Button variant="secondary" size="sm" onClick={() => setVisibleCount(value => value + pageSize)}>
                    แสดงเพิ่มอีก {Math.min(pageSize, listed.length - shown.length)} คำ
                  </Button>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </>
  )
}
