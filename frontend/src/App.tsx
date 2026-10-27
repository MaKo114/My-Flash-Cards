import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, FileUp, Layers3, Lightbulb, Pencil, Plus, RotateCcw, Search, Shuffle, Sparkles, Star, Target, Trash2, Volume2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { api } from '@/lib/api'
import { filterCards, searchCards, shuffleCards, type Card, type CardFields, type ImportResult } from '@/lib/cards'

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

function CardEditor({ card, onCancel, onSave }: { card: Card | null; onCancel: () => void; onSave: (fields: CardFields) => Promise<void> }) {
  const [fields, setFields] = useState<CardFields>({ word: card?.word || '', partOfSpeech: card?.partOfSpeech || '', meaning: card?.meaning || '', hint: card?.hint || '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSaving(true); setError('')
    try { await onSave(fields) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ') }
    finally { setSaving(false) }
  }

  return <form onSubmit={submit} className="space-y-5">
    <div><DialogTitle className="text-xl font-bold text-slate-900">{card ? 'แก้ไขคำศัพท์' : 'เพิ่มคำศัพท์ใหม่'}</DialogTitle><DialogDescription className="mt-1 text-sm text-slate-500">เติมรายละเอียดเพื่อสร้างบัตรคำศัพท์ของคุณ</DialogDescription></div>
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-slate-700">คำศัพท์ภาษาอังกฤษ<Input autoFocus value={fields.word} onChange={event => setFields({ ...fields, word: event.target.value })} placeholder="เช่น Serendipity" className="mt-2" required /></label>
      <label className="block text-sm font-semibold text-slate-700">ชนิดของคำ<Input value={fields.partOfSpeech} onChange={event => setFields({ ...fields, partOfSpeech: event.target.value })} placeholder="เช่น noun, verb, adjective" className="mt-2" required /></label>
      <label className="block text-sm font-semibold text-slate-700">ความหมายภาษาไทย<textarea value={fields.meaning} onChange={event => setFields({ ...fields, meaning: event.target.value })} placeholder="พิมพ์ความหมายของคำศัพท์" rows={3} required className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 shadow-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" /></label>
      <label className="block text-sm font-semibold text-slate-700">คำใบ้ <span className="font-normal text-slate-400">(ไม่บังคับ)</span><Input value={fields.hint} onChange={event => setFields({ ...fields, hint: event.target.value })} placeholder="เช่น ผลไม้สีแดง" className="mt-2" /></label>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" onClick={onCancel}>ยกเลิก</Button><Button type="submit" disabled={saving}>{saving ? 'กำลังบันทึก...' : card ? 'บันทึกการแก้ไข' : 'เพิ่มคำศัพท์'}</Button></div>
  </form>
}

function ImportNotice({ result, onClose }: { result: ImportResult; onClose: () => void }) {
  return <div className="mb-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-sm text-slate-700" role="status">
    <div className="flex items-start justify-between gap-2"><div><p className="font-bold text-slate-900">นำเข้า CSV เสร็จแล้ว</p><p className="mt-1">เพิ่ม {result.added} คำ · ข้ามคำซ้ำ {result.skipped} คำ · ข้อมูลไม่ครบ/ผิดรูปแบบ {result.invalid} แถว</p></div><button onClick={onClose} aria-label="ปิดผลนำเข้า" className="text-slate-500"><X size={18} /></button></div>
    {result.issues.length > 0 && <ul className="mt-3 space-y-1 border-t border-indigo-100 pt-3 text-red-700">{result.issues.map((issue, index) => <li key={index}>แถว {issue.row}: {issue.reason}</li>)}</ul>}
  </div>
}

function Empty({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center"><div className="mb-4 rounded-2xl bg-indigo-50 p-4 text-indigo-500">{icon}</div><h3 className="text-lg font-bold text-slate-800">{title}</h3><p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p>{action && <div className="mt-5">{action}</div>}</div>
}

function ChallengePanel({ card, firstLanguage, onAssess }: { card: Card; firstLanguage: 'ENG' | 'THAI'; onAssess: (remembered: boolean) => Promise<void> }) {
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [hintVisible, setHintVisible] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const prompt = firstLanguage === 'ENG' ? card.word : card.meaning
  const solution = firstLanguage === 'ENG' ? card.meaning : card.word

  async function assess(remembered: boolean) {
    setPending(true)
    setError('')
    try { await onAssess(remembered) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'บันทึกผลไม่สำเร็จ'); setPending(false) }
  }

  return <div className="mx-auto max-w-3xl">
    <div className="flex min-h-48 flex-col items-center justify-center rounded-[28px] border border-indigo-100 bg-gradient-to-br from-white to-indigo-50 px-6 py-6 text-center shadow-sm">
      <span className="mb-3 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">{firstLanguage === 'ENG' ? 'ENGLISH' : 'ความหมาย'}</span>
      <p data-testid="challenge-prompt" className="max-w-full break-words text-3xl font-bold leading-tight text-slate-900 sm:text-5xl">{prompt}</p>
      {firstLanguage === 'ENG' && <span className="mt-2 rounded-full bg-slate-100 px-3 py-1 text-sm italic text-slate-500">{card.partOfSpeech}</span>}
      {card.hint && !revealed && <div className="mt-3"><Button variant="ghost" size="sm" onClick={() => setHintVisible(value => !value)}><Lightbulb size={16} /> {hintVisible ? 'ซ่อนคำใบ้' : 'ดูคำใบ้'}</Button>{hintVisible && <p role="status" className="mt-2 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">{card.hint}</p>}</div>}
    </div>
    <form onSubmit={event => { event.preventDefault(); setRevealed(true) }} className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <label className="block text-sm font-semibold text-slate-700">คำตอบของฉัน<Input value={answer} disabled={revealed} onChange={event => setAnswer(event.target.value)} placeholder={firstLanguage === 'ENG' ? 'พิมพ์ความหมายภาษาไทย' : 'พิมพ์คำศัพท์ภาษาอังกฤษ'} className="mt-2" /></label>
      {!revealed ? <div className="mt-4 flex justify-end"><Button type="submit">ดูเฉลย <ArrowRight size={16} /></Button></div> : <>
        <div className="mt-5 rounded-xl bg-indigo-50 p-4"><p className="text-xs font-bold text-indigo-600">เฉลย</p><p className="mt-1 text-xl font-bold text-slate-900">{solution}</p>{firstLanguage === 'THAI' && <p className="mt-1 text-sm italic text-slate-500">{card.partOfSpeech}</p>}</div>
        <p className="mt-5 text-sm text-slate-500">เปรียบเทียบกับคำตอบของคุณ แล้วเลือกตามที่จำได้จริง</p>
        <div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={pending} onClick={() => void assess(false)}><Star size={16} /> ยังจำไม่ได้</Button><Button type="button" disabled={pending} onClick={() => void assess(true)}><Check size={16} /> จำได้</Button></div>
      </>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    </form>
  </div>
}

export default function App() {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<'library' | 'study' | 'challenge'>('library')
  const [letter, setLetter] = useState('ALL')
  const [reviewOnly, setReviewOnly] = useState(false)
  const [search, setSearch] = useState('')
  const [shuffled, setShuffled] = useState(false)
  const [shuffleRun, setShuffleRun] = useState(0)
  const [firstLanguage, setFirstLanguage] = useState<'ENG' | 'THAI'>('ENG')
  const [position, setPosition] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [hintVisible, setHintVisible] = useState(false)
  const [challengeIds, setChallengeIds] = useState<number[]>([])
  const [challengeRun, setChallengeRun] = useState(0)
  const [challengeDone, setChallengeDone] = useState(false)
  const [rememberedCount, setRememberedCount] = useState(0)
  const [missedCount, setMissedCount] = useState(0)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Card | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    api.list().then(value => { if (active) setCards(value) }).catch(cause => { if (active) setError(cause.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => filterCards(cards, letter, reviewOnly), [cards, letter, reviewOnly])
  const libraryCards = useMemo(() => searchCards(filtered, search), [filtered, search])
  const deck = useMemo(() => shuffled ? shuffleCards(filtered, seeded(shuffleRun)) : filtered, [filtered, shuffled, shuffleRun])
  const currentIndex = Math.min(position, Math.max(0, deck.length - 1))
  const current = deck[currentIndex]
  const challengeCard = cards.find(card => card.id === challengeIds[position])
  const reviewCount = cards.filter(card => card.needsReview).length
  const progressTotal = view === 'challenge' ? challengeIds.length : deck.length
  const progressPosition = progressTotal ? Math.min(position, progressTotal - 1) + 1 : 0
  const progressPercent = view === 'challenge' && challengeDone ? 100 : progressTotal ? progressPosition / progressTotal * 100 : 0

  function startChallengeSession(nextLetter = letter, nextReviewOnly = reviewOnly, nextShuffled = shuffled, nextSeed = shuffleRun) {
    const selected = filterCards(cards, nextLetter, nextReviewOnly)
    const ordered = nextShuffled ? shuffleCards(selected, seeded(nextSeed)) : selected
    setChallengeIds(ordered.map(card => card.id))
    setChallengeDone(false)
    setRememberedCount(0)
    setMissedCount(0)
    setChallengeRun(value => value + 1)
    setPosition(0)
    setFlipped(false)
    setHintVisible(false)
  }

  function openChallenge() { startChallengeSession(); setView('challenge') }
  function changeLetter(value: string) { setLetter(value); if (view === 'challenge') startChallengeSession(value); else { setPosition(0); setFlipped(false); setHintVisible(false) } }
  function changeReviewOnly(value: boolean) { setReviewOnly(value); if (view === 'challenge') startChallengeSession(letter, value); else { setPosition(0); setFlipped(false); setHintVisible(false) } }
  function toggleShuffle() { const next = !shuffled; const seed = Date.now(); setShuffled(next); setShuffleRun(seed); if (view === 'challenge') startChallengeSession(letter, reviewOnly, next, seed); else { setPosition(0); setFlipped(false); setHintVisible(false) } }
  function reshuffle() { const seed = Date.now(); setShuffleRun(seed); if (view === 'challenge') startChallengeSession(letter, reviewOnly, shuffled, seed); else { setPosition(0); setFlipped(false); setHintVisible(false) } }
  function navigate(next: number) { setPosition(next); setFlipped(false); setHintVisible(false) }
  function openNew() { setEditing(null); setEditorOpen(true) }
  function openEdit(card: Card) { setEditing(card); setEditorOpen(true) }

  async function save(fields: CardFields) {
    const saved = editing ? await api.update(editing.id, fields) : await api.create(fields)
    setCards(previous => editing ? previous.map(card => card.id === saved.id ? saved : card).sort(sortCards) : [...previous, saved].sort(sortCards))
    setEditorOpen(false)
    setError('')
  }

  async function toggleReview(card: Card) {
    try {
      const saved = await api.review(card.id, !card.needsReview)
      setCards(previous => previous.map(item => item.id === card.id ? saved : item))
      if (reviewOnly && card.needsReview) { setFlipped(false); setHintVisible(false) }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ') }
  }

  async function assessChallenge(remembered: boolean) {
    if (!challengeCard) return
    const needsReview = !remembered
    if (challengeCard.needsReview !== needsReview) {
      const saved = await api.review(challengeCard.id, needsReview)
      setCards(previous => previous.map(card => card.id === saved.id ? saved : card))
    }
    if (remembered) setRememberedCount(value => value + 1)
    else setMissedCount(value => value + 1)
    if (position + 1 >= challengeIds.length) setChallengeDone(true)
    else setPosition(value => value + 1)
  }

  async function remove(card: Card) {
    if (!window.confirm(`ลบคำว่า “${card.word}” ใช่ไหม?`)) return
    try { await api.delete(card.id); setCards(previous => previous.filter(item => item.id !== card.id)); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'ลบไม่สำเร็จ') }
  }

  async function importFile(file: File) {
    try {
      const result = await api.import(file)
      const updated = await api.list()
      setCards(updated); setImportResult(result); setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'นำเข้าไม่สำเร็จ') }
  }

  function speak(word: string) {
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(word)
    utterance.lang = 'en-US'
    window.speechSynthesis.speak(utterance)
  }

  return <div className="min-h-screen bg-[#f7f8fa] text-slate-700">
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white px-5 py-7 lg:sticky lg:top-0 lg:h-dvh lg:self-start lg:flex">
        <div className="flex items-center gap-3 px-2"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-100"><Layers3 size={22} strokeWidth={2.4} /></div><div><div className="text-xl font-bold tracking-tight text-slate-900">wordly<span className="text-indigo-600">.</span></div><div className="-mt-1 text-[10px] font-semibold uppercase tracking-[.19em] text-slate-400">flash cards</div></div></div>
        <div className="mt-12 px-3 text-[11px] font-bold uppercase tracking-[.17em] text-slate-400">เมนูหลัก</div>
        <nav className="mt-4 space-y-1" aria-label="เมนูหลัก">
          <button className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${view === 'library' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`} onClick={() => setView('library')}><BookOpen size={18} />คลังคำศัพท์</button>
          <button className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${view === 'study' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`} onClick={() => { setView('study'); setPosition(0); setFlipped(false); setHintVisible(false) }}><Layers3 size={18} />อ่านบัตรคำ</button>
          <button className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${view === 'challenge' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500 hover:bg-slate-50'}`} onClick={openChallenge}><Target size={18} />Challenge</button>
        </nav>
        <div className="mt-11 px-3 text-[11px] font-bold uppercase tracking-[.17em] text-slate-400">ตัวกรอง</div>
        <button className={`mt-4 flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm font-medium ${reviewOnly ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'}`} onClick={() => changeReviewOnly(!reviewOnly)}><span className="flex items-center gap-3"><Star size={18} />ต้องทบทวน</span><span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{reviewCount}</span></button>
        <div className="mt-auto rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 p-5 text-white"><Sparkles size={20} /><p className="mt-3 text-sm font-bold">เก่งขึ้นทีละคำ</p><p className="mt-1 text-xs leading-5 text-indigo-100">เปิดบัตร ฝึกจำ แล้วเก็บคำที่อยากทบทวนไว้ในที่เดียว</p></div>
      </aside>

      <main className="min-h-screen min-w-0 flex-1">
        <header className="flex min-h-20 items-center justify-between border-b border-slate-200/80 bg-white px-5 lg:px-10"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white lg:hidden"><Layers3 size={19} /></div><div><p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">My Flash Cards</p><h1 className="text-lg font-bold text-slate-900">{view === 'library' ? 'คลังคำศัพท์ของฉัน' : view === 'study' ? 'ฝึกจำคำศัพท์' : 'Challenge'}</h1></div></div><div className="flex items-center gap-2"><span className="hidden rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 sm:block">{cards.length} คำศัพท์</span><Button onClick={openNew} size="sm"><Plus size={16} /> <span className="hidden sm:inline">เพิ่มคำศัพท์</span><span className="sm:hidden">เพิ่ม</span></Button></div></header>
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-5 py-2 lg:hidden"><button onClick={() => setView('library')} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${view === 'library' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'}`}>คลังคำศัพท์</button><button onClick={() => { setView('study'); setPosition(0); setFlipped(false); setHintVisible(false) }} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${view === 'study' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'}`}>อ่านบัตรคำ</button><button onClick={openChallenge} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${view === 'challenge' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-500'}`}>Challenge</button></div>
        <div className="mx-auto min-h-[calc(100dvh-5rem)] w-full max-w-6xl px-5 py-6 lg:px-10 lg:py-8">
          {error && <div role="alert" className="mb-6 flex items-start justify-between rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><span>{error}</span><button aria-label="ปิดข้อความผิดพลาด" onClick={() => setError('')}><X size={18} /></button></div>}
          {loading ? <p role="status" className="py-20 text-center text-slate-500">กำลังโหลดคำศัพท์...</p> : view === 'library' ? <>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-600">YOUR COLLECTION</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">คำศัพท์ทั้งหมด</h2><p className="mt-2 text-sm text-slate-500">เก็บทุกคำใหม่ไว้ที่นี่ แล้วกลับมาทบทวนได้เสมอ</p></div><div><input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" aria-label="เลือกไฟล์ CSV" onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = '' }} /><Button variant="secondary" onClick={() => fileRef.current?.click()}><FileUp size={17} /> นำเข้า CSV</Button></div></div>
            {importResult && <ImportNotice result={importResult} onClose={() => setImportResult(null)} />}
            <div className="mb-7 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-indigo-50 p-2.5 text-indigo-600"><BookOpen size={20} /></div><span className="text-sm font-medium text-slate-500">คำศัพท์ทั้งหมด</span></div><p className="mt-3 text-3xl font-bold text-slate-900">{cards.length}<span className="ml-2 text-sm font-medium text-slate-400">คำ</span></p></div><div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-amber-50 p-2.5 text-amber-500"><Star size={20} /></div><span className="text-sm font-medium text-slate-500">ต้องทบทวน</span></div><p className="mt-3 text-3xl font-bold text-slate-900">{reviewCount}<span className="ml-2 text-sm font-medium text-slate-400">คำ</span></p></div></div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="text-base font-bold text-slate-900">รายการคำศัพท์</h3><p className="text-xs text-slate-400">เลือกอักษรแรกหรือค้นหาคำที่ต้องการ</p></div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <div role="search" className="relative w-full sm:w-72">
                  <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input aria-label="ค้นหาคำศัพท์" placeholder="ค้นหาคำศัพท์หรือความหมาย" value={search} onChange={event => setSearch(event.target.value)} className="pl-10 pr-10" />
                  {search && <button type="button" aria-label="ล้างคำค้น" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={16} /></button>}
                </div>
                <button onClick={() => changeReviewOnly(!reviewOnly)} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${reviewOnly ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-500'}`}><Star size={15} fill={reviewOnly ? 'currentColor' : 'none'} /> เฉพาะคำที่ต้องทบทวน {reviewOnly && <Check size={14} />}</button>
              </div>
            </div>
            <div className="mb-5 flex flex-wrap gap-1.5"><button onClick={() => changeLetter('ALL')} className={`h-8 rounded-lg px-3 text-xs font-bold ${letter === 'ALL' ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-500 hover:border-indigo-300'}`}>ทั้งหมด</button>{alphabet.map(item => <button key={item} onClick={() => changeLetter(item)} className={`h-8 min-w-8 rounded-lg px-1 text-xs font-bold ${letter === item ? 'bg-indigo-600 text-white' : 'border border-slate-200 bg-white text-slate-500 hover:border-indigo-300'}`}>{item}</button>)}</div>
            {libraryCards.length === 0 ? <Empty icon={<BookOpen size={28} />} title={cards.length === 0 ? 'ยังไม่มีคำศัพท์' : search.trim() ? 'ไม่พบคำที่ค้นหา' : 'ไม่พบคำศัพท์ในหมวดนี้'} description={cards.length === 0 ? 'เริ่มสะสมคำศัพท์คำแรก หรือจะนำเข้าจากไฟล์ CSV ก็ได้' : search.trim() ? 'ลองเปลี่ยนคำค้นหรือปิดตัวกรองอื่น' : 'ลองเลือกอักษรอื่น หรือปิดตัวกรองคำที่ต้องทบทวน'} action={cards.length === 0 ? <Button onClick={openNew}><Plus size={16} /> เพิ่มคำแรก</Button> : undefined} /> : <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm"><div className="hidden grid-cols-[1.2fr_1fr_1.5fr_100px] gap-4 border-b border-slate-100 bg-slate-50/70 px-6 py-3 text-xs font-bold text-slate-400 sm:grid"><span>คำศัพท์</span><span>ชนิดของคำ</span><span>ความหมาย</span><span className="text-right">จัดการ</span></div><div className="divide-y divide-slate-100">{libraryCards.map(card => <div key={card.id} className="grid gap-3 px-5 py-4 sm:grid-cols-[1.2fr_1fr_1.5fr_100px] sm:items-center sm:gap-4 sm:px-6"><div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-base font-bold text-indigo-600">{card.word[0]?.toUpperCase()}</span><span className="truncate font-bold text-slate-900">{card.word}</span></div><div><span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">{card.partOfSpeech}</span></div><p className="min-w-0 truncate text-sm text-slate-600">{card.meaning}</p><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" aria-label={card.needsReview ? `ยกเลิกทบทวน ${card.word}` : `เก็บไว้ทบทวน ${card.word}`} title={card.needsReview ? 'ยกเลิกทบทวน' : 'เก็บไว้ทบทวน'} onClick={() => void toggleReview(card)} className={card.needsReview ? 'text-amber-500' : ''}><Star size={17} fill={card.needsReview ? 'currentColor' : 'none'} /></Button><Button variant="ghost" size="icon" aria-label={`แก้ไข ${card.word}`} onClick={() => openEdit(card)}><Pencil size={16} /></Button><Button variant="danger" size="icon" aria-label={`ลบ ${card.word}`} onClick={() => void remove(card)}><Trash2 size={16} /></Button></div></div>)}</div></div>}
          </> : <>
            <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[.18em] text-indigo-600">{view === 'challenge' ? 'CHALLENGE MODE' : 'STUDY MODE'}</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{view === 'challenge' ? 'ท้าทายความจำ' : 'ฝึกจำทีละใบ'}</h2><p className="mt-2 text-sm text-slate-500">{view === 'challenge' ? 'พิมพ์คำตอบ ดูเฉลย แล้วประเมินตัวเองทีละคำ' : 'พลิกบัตรเพื่อเฉลย และเก็บคำที่ยังจำไม่ได้ไว้ทบทวน'}</p></div>
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"><label className="relative flex items-center gap-2 text-sm font-semibold text-slate-600"><span>หมวดอักษร</span><select aria-label="หมวดอักษร" value={letter} onChange={event => changeLetter(event.target.value)} className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-semibold text-slate-700 outline-none focus:border-indigo-400"><option value="ALL">ทั้งหมด</option>{alphabet.map(item => <option key={item} value={item}>{item}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3" size={14} /></label><button onClick={() => changeReviewOnly(!reviewOnly)} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${reviewOnly ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600'}`}><Star size={16} fill={reviewOnly ? 'currentColor' : 'none'} /> ต้องทบทวน</button><button onClick={toggleShuffle} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${shuffled ? 'border-indigo-200 bg-indigo-50 text-indigo-700' : 'border-slate-200 text-slate-600'}`}><Shuffle size={16} /> สุ่มคำ {shuffled ? 'เปิด' : 'ปิด'}</button>{shuffled && <Button variant="ghost" size="sm" onClick={reshuffle}><RotateCcw size={15} /> สุ่มใหม่</Button>}{view === 'challenge' && <div className="ml-auto flex items-center gap-2"><span className="text-xs font-medium text-slate-500">คำถาม</span><div className="flex rounded-xl border border-slate-200 bg-white p-1"><button onClick={() => setFirstLanguage('ENG')} className={firstLanguage === 'ENG' ? 'rounded-lg bg-indigo-600 px-3 py-1 text-xs font-bold text-white' : 'rounded-lg px-3 py-1 text-xs font-bold text-slate-500'}>ENG</button><button onClick={() => setFirstLanguage('THAI')} className={firstLanguage === 'THAI' ? 'rounded-lg bg-indigo-600 px-3 py-1 text-xs font-bold text-white' : 'rounded-lg px-3 py-1 text-xs font-bold text-slate-500'}>THAI</button></div></div>}</div>
            <div className="mx-auto max-w-3xl"><div className="mb-4 flex items-center justify-between text-xs font-semibold text-slate-500"><span>{view === 'challenge' ? 'คำที่' : 'บัตรที่'} {progressPosition} จาก {progressTotal}</span><span>{letter === 'ALL' ? 'ทุกหมวด' : `หมวด ${letter}`}{reviewOnly ? ' · ต้องทบทวน' : ''}</span></div><div className="mb-6 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${progressPercent}%` }} /></div>
              {view === 'challenge' ? (
                challengeIds.length === 0 ? <Empty icon={<Target size={28} />} title="ยังไม่มีคำสำหรับ Challenge" description="ลองเปลี่ยนหมวดอักษรหรือปิดตัวกรองคำที่ต้องทบทวน" action={<Button variant="secondary" onClick={() => setView('library')}>ไปคลังคำศัพท์</Button>} /> :
                challengeDone ? <div className="rounded-2xl border border-indigo-100 bg-white px-6 py-12 text-center shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600"><Target size={28} /></div><h3 className="mt-5 text-2xl font-bold text-slate-900">จบรอบ Challenge</h3><p className="mt-2 text-sm text-slate-500">จำได้ {rememberedCount} คำ · ยังจำไม่ได้ {missedCount} คำ</p><Button className="mt-6" onClick={() => startChallengeSession()}><RotateCcw size={17} /> เริ่มรอบใหม่</Button></div> :
                challengeCard ? <ChallengePanel key={challengeRun + '-' + challengeCard.id + '-' + firstLanguage} card={challengeCard} firstLanguage={firstLanguage} onAssess={assessChallenge} /> :
                <Empty icon={<Target size={28} />} title="ไม่พบคำศัพท์" description="กลับไปคลังคำศัพท์แล้วเริ่มรอบใหม่" action={<Button onClick={openChallenge}>เริ่มรอบใหม่</Button>} />
              ) : current ? <><div className="study-card h-[300px] cursor-pointer select-none sm:h-[320px]" onClick={() => { setFlipped(value => !value); setHintVisible(false) }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setFlipped(value => !value); setHintVisible(false) } }} role="button" tabIndex={0} aria-label="พลิกบัตร" aria-pressed={flipped}><div className="study-card-inner" style={{ transform: flipped ? 'rotateY(180deg)' : undefined }}><div className="study-face flex flex-col items-center justify-center rounded-[28px] border border-indigo-100 bg-gradient-to-br from-white via-white to-indigo-50 p-8 text-center shadow-[0_16px_50px_-20px_rgba(74,66,156,.22)]"><span className="absolute left-7 top-7 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-600">{firstLanguage === 'ENG' ? 'ENGLISH' : 'ความหมาย'}</span><span className="absolute right-7 top-7 text-xs font-medium text-slate-400">ด้านหน้า</span><span data-testid="front-value" className="max-w-full break-words text-3xl font-bold leading-tight text-slate-900 sm:text-5xl">{firstLanguage === 'ENG' ? current.word : current.meaning}</span>{firstLanguage === 'ENG' && <span className="mt-4 rounded-full bg-slate-100 px-3 py-1 text-sm italic text-slate-500">{current.partOfSpeech}</span>}{hintVisible && current.hint && <span role="status" className="mt-5 max-h-28 max-w-[90%] overflow-y-auto rounded-xl bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800"><Lightbulb size={16} className="mr-1 inline-block" />{current.hint}</span>}<span className="absolute bottom-8 text-xs font-medium text-slate-400">คลิกเพื่อดูเฉลย · พลิกบัตร</span></div><div className="study-face back flex flex-col items-center justify-center rounded-[28px] border border-indigo-200 bg-indigo-600 p-8 text-center text-white shadow-[0_16px_50px_-20px_rgba(74,66,156,.3)]"><span className="absolute left-7 top-7 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider">{firstLanguage === 'ENG' ? 'ความหมาย' : 'ENGLISH'}</span><span className="absolute right-7 top-7 text-xs text-indigo-200">ด้านหลัง</span><span data-testid="back-value" className="max-w-full break-words text-3xl font-bold leading-tight sm:text-5xl">{firstLanguage === 'ENG' ? current.meaning : current.word}</span>{firstLanguage === 'THAI' && <span className="mt-4 rounded-full bg-white/15 px-3 py-1 text-sm italic">{current.partOfSpeech}</span>}<span className="absolute bottom-8 text-xs text-indigo-200">คลิกเพื่อกลับไปด้านหน้า</span></div></div></div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{current.hint && !flipped && <Button variant="secondary" onClick={() => setHintVisible(value => !value)}><Lightbulb size={17} /> {hintVisible ? 'ซ่อนคำใบ้' : 'ดูคำใบ้'}</Button>}<Button variant="secondary" onClick={() => void toggleReview(current)} className={current.needsReview ? 'border-amber-200 bg-amber-50 text-amber-700' : ''}><Star size={17} fill={current.needsReview ? 'currentColor' : 'none'} /> {current.needsReview ? 'อยู่ในคำที่ต้องทบทวน' : 'จำไม่ได้ เก็บไว้ทบทวน'}</Button>{(firstLanguage === 'ENG' && !flipped || firstLanguage === 'THAI' && flipped) && 'speechSynthesis' in window && <Button variant="secondary" onClick={() => speak(current.word)} aria-label={`ออกเสียง ${current.word}`}><Volume2 size={17} /><span className="hidden sm:inline">ออกเสียง</span></Button>}</div><div className="flex gap-2"><Button variant="secondary" size="icon" onClick={() => navigate(currentIndex - 1)} disabled={currentIndex === 0} aria-label="บัตรก่อนหน้า"><ArrowLeft size={18} /></Button>{currentIndex + 1 === deck.length ? <Button onClick={() => { setPosition(0); setFlipped(false); setHintVisible(false); if (shuffled) reshuffle() }}><RotateCcw size={17} /> เริ่มรอบใหม่</Button> : <Button onClick={() => navigate(currentIndex + 1)}>บัตรถัดไป <ArrowRight size={17} /></Button>}</div></div>
              </> : <Empty icon={<Layers3 size={28} />} title="ยังไม่มีบัตรในหมวดนี้" description="ลองเปลี่ยนหมวดอักษรหรือปิดตัวกรองคำที่ต้องทบทวน" action={<Button variant="secondary" onClick={() => setView('library')}>ไปคลังคำศัพท์</Button>} />}
              {view === 'study' && <div className="mt-7 flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 pt-6 text-sm"><span className="font-medium text-slate-500">แสดงด้านหน้าเป็น</span><div className="flex rounded-xl border border-slate-200 bg-white p-1"><button onClick={() => { setFirstLanguage('ENG'); setFlipped(false); setHintVisible(false) }} className={`rounded-lg px-4 py-2 text-xs font-bold ${firstLanguage === 'ENG' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}>ENG ก่อน</button><button onClick={() => { setFirstLanguage('THAI'); setFlipped(false); setHintVisible(false) }} className={`rounded-lg px-4 py-2 text-xs font-bold ${firstLanguage === 'THAI' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-500'}`}>THAI ก่อน</button></div></div>}
            </div>
          </>}
        </div>
      </main>
    </div>
    <Dialog open={editorOpen} onOpenChange={setEditorOpen}><DialogContent><CardEditor key={editing?.id ?? 'new'} card={editing} onCancel={() => setEditorOpen(false)} onSave={save} /></DialogContent></Dialog>
  </div>
}

function sortCards(a: Card, b: Card) { return a.word.localeCompare(b.word, 'en', { sensitivity: 'base' }) || a.partOfSpeech.localeCompare(b.partOfSpeech, 'en', { sensitivity: 'base' }) }

function seeded(value: number) {
  let state = value || 1
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296 }
}
