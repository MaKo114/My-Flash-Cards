import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, FileUp, Layers3, Lightbulb, Pencil, Plus, RotateCcw, Search, Shuffle, Sparkles, Star, Target, Trash2, Volume2, VolumeX, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { api } from '@/lib/api'
import { playAnswerSound } from '@/lib/answer-sound'
import { filterByPartOfSpeech, filterCards, isTypingMatch, searchCards, shuffleCards, typingFeedback, type Card, type CardFields, type ImportResult } from '@/lib/cards'

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const partsOfSpeech = ['noun', 'verb', 'adjective', 'adverb', 'pronoun', 'preposition', 'conjunction', 'interjection', 'determiner', 'phrase']
const partColors: Record<string, string> = {
  noun: 'bg-sky-50 text-sky-800 ring-sky-200',
  verb: 'bg-orange-50 text-orange-800 ring-orange-200',
  adjective: 'bg-violet-50 text-violet-800 ring-violet-200',
  adverb: 'bg-rose-50 text-rose-800 ring-rose-200',
  pronoun: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  preposition: 'bg-amber-50 text-amber-900 ring-amber-200',
  conjunction: 'bg-cyan-50 text-cyan-800 ring-cyan-200',
  interjection: 'bg-pink-50 text-pink-800 ring-pink-200',
  determiner: 'bg-slate-100 text-slate-700 ring-slate-200',
  phrase: 'bg-purple-50 text-purple-800 ring-purple-200',
}

function PartBadge({ part, className = '' }: { part: string; className?: string }) {
  const normalized = part.trim().toLowerCase()
  return <span data-part-of-speech={normalized} className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${partColors[normalized] || 'bg-slate-100 text-slate-700 ring-slate-200'} ${className}`}>{part}</span>
}

function CardEditor({ card, onCancel, onSave }: { card: Card | null; onCancel: () => void; onSave: (fields: CardFields) => Promise<void> }) {
  const [fields, setFields] = useState<CardFields>({ word: card?.word || '', partOfSpeech: card?.partOfSpeech || '', meaning: card?.meaning || '', hint: card?.hint || '' })
  const [partSelection, setPartSelection] = useState(() => card?.partOfSpeech && !partsOfSpeech.includes(card.partOfSpeech.toLowerCase()) ? 'other' : card?.partOfSpeech.toLowerCase() || '')
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
      <div><label htmlFor="card-part-of-speech" className="block text-sm font-semibold text-slate-700">ชนิดของคำ</label><Select id="card-part-of-speech" label="ชนิดของคำ" name="partOfSpeech" value={partSelection} onValueChange={value => { setPartSelection(value); setFields({ ...fields, partOfSpeech: value === 'other' ? '' : value }) }} required placeholder="เลือกชนิดของคำ" options={[...partsOfSpeech.map(part => ({ value: part, label: part })), { value: 'other', label: 'อื่น ๆ' }]} className="mt-2 h-11 w-full" />{partSelection === 'other' && <Input aria-label="ระบุชนิดของคำ" value={fields.partOfSpeech} onChange={event => setFields({ ...fields, partOfSpeech: event.target.value })} placeholder="ระบุชนิดของคำ" className="mt-2" required />}</div>
      <label className="block text-sm font-semibold text-slate-700">ความหมายภาษาไทย<textarea value={fields.meaning} onChange={event => setFields({ ...fields, meaning: event.target.value })} placeholder="พิมพ์ความหมายของคำศัพท์" rows={3} required className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 shadow-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" /></label>
      <label className="block text-sm font-semibold text-slate-700">คำใบ้ <span className="font-normal text-slate-400">(ไม่บังคับ)</span><Input value={fields.hint} onChange={event => setFields({ ...fields, hint: event.target.value })} placeholder="เช่น ผลไม้สีแดง" className="mt-2" /></label>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" onClick={onCancel}>ยกเลิก</Button><Button type="submit" disabled={saving}>{saving ? 'กำลังบันทึก...' : card ? 'บันทึกการแก้ไข' : 'เพิ่มคำศัพท์'}</Button></div>
  </form>
}

function ImportNotice({ result, onClose }: { result: ImportResult; onClose: () => void }) {
  return <div className="mb-6 rounded-2xl border border-teal-100 bg-teal-50/60 p-4 text-sm text-slate-700" role="status">
    <div className="flex items-start justify-between gap-2"><div><p className="font-bold text-slate-900">นำเข้า CSV เสร็จแล้ว</p><p className="mt-1">เพิ่ม {result.added} คำ · ข้ามคำซ้ำ {result.skipped} คำ · ข้อมูลไม่ครบ/ผิดรูปแบบ {result.invalid} แถว</p></div><button onClick={onClose} aria-label="ปิดผลนำเข้า" className="text-slate-500"><X size={18} /></button></div>
    {result.issues.length > 0 && <ul className="mt-3 space-y-1 border-t border-teal-100 pt-3 text-red-700">{result.issues.map((issue, index) => <li key={index}>แถว {issue.row}: {issue.reason}</li>)}</ul>}
  </div>
}

function Empty({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 text-center"><div className="mb-4 rounded-2xl bg-teal-50 p-4 text-teal-500">{icon}</div><h3 className="text-lg font-bold text-slate-800">{title}</h3><p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p>{action && <div className="mt-5">{action}</div>}</div>
}

type ChallengeMode = 'meaning' | 'copy' | 'listen'

function speak(word: string) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(word)
  utterance.lang = 'en-US'
  window.speechSynthesis.speak(utterance)
}

function ChallengePanel({ card, mode, firstLanguage, soundEffects, onToggleSoundEffects, onAssess }: { card: Card; mode: ChallengeMode; firstLanguage: 'ENG' | 'THAI'; soundEffects: boolean; onToggleSoundEffects: () => void; onAssess: (remembered: boolean) => Promise<void> }) {
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [hintVisible, setHintVisible] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const [assessment, setAssessment] = useState<boolean | null>(null)
  const assessing = useRef(false)
  const mounted = useRef(true)
  const prompt = mode === 'copy' ? card.word : firstLanguage === 'ENG' ? card.word : card.meaning
  const solution = mode === 'meaning' && firstLanguage === 'ENG' ? card.meaning : card.word
  const hint = card.hint || (mode === 'meaning' ? '' : card.meaning)
  const feedback = mode === 'meaning' ? [] : typingFeedback(card.word, answer)
  const correct = isTypingMatch(card.word, answer)
  const wordLetters = Array.from(card.word)

  useEffect(() => {
    if (mode === 'meaning') return
    speak(card.word)
    return () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel() }
  }, [card.id, card.word, mode])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (mode === 'meaning') { setRevealed(true); return }
    if (!pending) void assess(revealed ? false : correct)
  }

  async function assess(remembered: boolean) {
    if (assessing.current) return
    assessing.current = true
    setPending(true)
    setError('')
    setAssessment(remembered)
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    if (soundEffects) playAnswerSound(remembered)
    await new Promise(resolve => window.setTimeout(resolve, 400))
    if (!mounted.current) return
    try { await onAssess(remembered) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'บันทึกผลไม่สำเร็จ'); setPending(false); setAssessment(null); assessing.current = false }
  }

  return <form onSubmit={submit} className="mx-auto w-full max-w-3xl rounded-[28px] border border-teal-100 bg-gradient-to-br from-white to-teal-50 px-5 py-6 shadow-sm sm:px-8">
    <div className="flex min-h-44 flex-col items-center justify-center px-2 pb-4 text-center">
      <span className="mb-3 rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800">{mode === 'listen' ? 'ฟังแล้วพิมพ์' : mode === 'copy' ? 'พิมพ์ตามคำศัพท์' : firstLanguage === 'ENG' ? 'ENGLISH' : 'ความหมาย'}</span>
      {mode === 'copy' ? <p data-testid="challenge-prompt" aria-label={card.word} className="max-w-full break-words text-3xl font-bold leading-tight sm:text-5xl"><span data-testid="typing-feedback" aria-hidden="true">{wordLetters.map((character, index) => <span key={index} data-state={feedback[index] ? feedback[index].correct ? 'correct' : 'wrong' : 'pending'} className={feedback[index] ? feedback[index].correct ? 'text-emerald-600' : 'text-red-600' : 'text-slate-900'}>{character === ' ' ? '\u00a0' : character}</span>)}{feedback.slice(wordLetters.length).map((letter, index) => <span key={`extra-${index}`} data-state="wrong" className="text-red-600">{letter.character === ' ' ? '\u00a0' : letter.character}</span>)}</span></p> : mode === 'listen' ? <><p data-testid="challenge-prompt" className="text-lg font-semibold text-slate-700">ฟังเสียงแล้วพิมพ์คำศัพท์</p><div data-testid="typing-feedback" aria-label="อักษรที่พิมพ์" className="mt-3 min-h-12 max-w-full break-words text-3xl font-bold leading-tight sm:text-5xl">{feedback.map((letter, index) => <span key={index} data-state={letter.correct ? 'correct' : 'wrong'} className={letter.correct ? 'text-emerald-600' : 'text-red-600'}>{letter.character === ' ' ? '\u00a0' : letter.character}</span>)}</div>{revealed && <p data-testid="challenge-answer" className="mt-2 text-xl font-bold text-slate-900">{card.word}</p>}</> : <p data-testid="challenge-prompt" className="max-w-full break-words text-3xl font-bold leading-tight text-slate-900 sm:text-5xl">{prompt}</p>}
      {mode === 'meaning' && firstLanguage === 'ENG' && <PartBadge part={card.partOfSpeech} className="mt-2" />}
      {assessment !== null && <p data-testid="answer-result" role="status" className={`mt-3 rounded-full px-3 py-1 text-sm font-bold ${assessment ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{assessment ? 'ถูกต้อง!' : 'ยังไม่ถูก เก็บไว้ทบทวน'}</p>}
      {mode !== 'meaning' && 'speechSynthesis' in window && <Button variant="secondary" size="sm" type="button" onClick={() => speak(card.word)} className="mt-4"><Volume2 size={16} /> ฟังอีกครั้ง</Button>}
      {mode === 'listen' && !('speechSynthesis' in window) && <p role="alert" className="mt-3 text-sm text-amber-700">เบราว์เซอร์นี้ไม่รองรับเสียงอ่าน ลองใช้โหมดพิมพ์ตามคำศัพท์</p>}
      {hint && !revealed && <div className="mt-3"><Button variant="ghost" size="sm" type="button" onClick={() => setHintVisible(value => !value)}><Lightbulb size={16} /> {hintVisible ? 'ซ่อนคำใบ้' : 'ดูคำใบ้'}</Button>{hintVisible && <p role="status" className="mt-2 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">{hint}</p>}</div>}
    </div>
    <div className="mx-auto w-full max-w-xl border-t border-teal-100 pt-5">
      <div className="mb-3 flex justify-end"><button type="button" aria-pressed={soundEffects} onClick={onToggleSoundEffects} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">{soundEffects ? <Volume2 size={14} /> : <VolumeX size={14} />} เสียงตอบรับ {soundEffects ? 'เปิด' : 'ปิด'}</button></div>
      <label className="block text-sm font-semibold text-slate-700">{mode === 'meaning' ? 'คำตอบของฉัน' : 'พิมพ์คำศัพท์ภาษาอังกฤษ'}<Input autoFocus value={answer} disabled={(mode === 'meaning' && revealed) || pending} readOnly={mode !== 'meaning' && revealed} aria-invalid={mode !== 'meaning' && feedback.some(letter => !letter.correct)} onChange={event => setAnswer(event.target.value)} placeholder={mode !== 'meaning' || firstLanguage === 'THAI' ? 'พิมพ์คำศัพท์ภาษาอังกฤษ' : 'พิมพ์ความหมายภาษาไทย'} className="mt-2" required={mode !== 'meaning' && !revealed} /></label>
      {mode !== 'meaning' && <><p className="mt-3 text-sm text-slate-500">อักษรบนการ์ดจะแสดงสีเขียวเมื่อถูก สีแดงเมื่อผิด · กด Enter เพื่อไปคำถัดไป</p>{revealed && <p className="mt-2 text-sm text-amber-700">ดูเฉลยแล้ว คำนี้จะถูกเก็บไว้ทบทวน</p>}<div className="mt-4 flex justify-end gap-2">{!revealed && <Button type="button" variant="secondary" onClick={() => setRevealed(true)}>ดูเฉลย</Button>}<Button type="submit" disabled={pending || (!revealed && !answer.trim())}>{pending ? 'กำลังบันทึก...' : 'คำถัดไป'} <ArrowRight size={16} /></Button></div></>}
      {mode === 'meaning' && (!revealed ? <div className="mt-4 flex justify-end"><Button type="submit">ดูเฉลย <ArrowRight size={16} /></Button></div> : <>
        <div className="mt-5 rounded-xl bg-teal-50 p-4"><p className="text-xs font-bold text-teal-700">เฉลย</p><p className="mt-1 text-xl font-bold text-slate-900">{solution}</p>{mode === 'meaning' && firstLanguage === 'THAI' && <PartBadge part={card.partOfSpeech} className="mt-2" />}</div>
        <p className="mt-5 text-sm text-slate-500">เลือกตามที่จำได้จริงเพื่อบันทึกผลและไปคำถัดไป</p>
        <div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="secondary" disabled={pending} onClick={() => void assess(false)}><Star size={16} /> ยังจำไม่ได้</Button><Button type="button" disabled={pending} onClick={() => void assess(true)}><Check size={16} /> จำได้</Button></div>
      </>)}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    </div>
  </form>
}

export default function App() {
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState<'library' | 'study' | 'challenge'>('library')
  const [letter, setLetter] = useState('ALL')
  const [reviewOnly, setReviewOnly] = useState(false)
  const [partFilter, setPartFilter] = useState('ALL')
  const [search, setSearch] = useState('')
  const [shuffled, setShuffled] = useState(false)
  const [shuffleRun, setShuffleRun] = useState(0)
  const [firstLanguage, setFirstLanguage] = useState<'ENG' | 'THAI'>('ENG')
  const [challengeMode, setChallengeMode] = useState<ChallengeMode>('copy')
  const [soundEffects, setSoundEffects] = useState(true)
  const [position, setPosition] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [hintVisible, setHintVisible] = useState(false)
  const [challengeIds, setChallengeIds] = useState<number[]>([])
  const [challengeRun, setChallengeRun] = useState(0)
  const [challengeStarted, setChallengeStarted] = useState(false)
  const [challengeDone, setChallengeDone] = useState(false)
  const [rememberedCount, setRememberedCount] = useState(0)
  const [missedCount, setMissedCount] = useState(0)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Card | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set())
  const [deletingSelected, setDeletingSelected] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let active = true
    api.list().then(value => { if (active) setCards(value) }).catch(cause => { if (active) setError(cause.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const filtered = useMemo(() => filterCards(cards, letter, reviewOnly), [cards, letter, reviewOnly])
  const partOptions = useMemo(() => [...new Set([...cards.map(card => card.partOfSpeech.trim().toLowerCase()), ...(partFilter === 'ALL' ? [] : [partFilter])])].filter(Boolean).sort(), [cards, partFilter])
  const libraryCards = useMemo(() => searchCards(filterByPartOfSpeech(filtered, partFilter), search), [filtered, partFilter, search])
  const selectedVisibleIds = libraryCards.filter(card => selectedIds.has(card.id)).map(card => card.id)
  const deck = useMemo(() => shuffled ? shuffleCards(filtered, seeded(shuffleRun)) : filtered, [filtered, shuffled, shuffleRun])
  const currentIndex = Math.min(position, Math.max(0, deck.length - 1))
  const current = deck[currentIndex]
  const challengeCard = cards.find(card => card.id === challengeIds[position])
  const reviewCount = cards.filter(card => card.needsReview).length
  const progressTotal = view === 'challenge' ? challengeIds.length : deck.length
  const progressPosition = view === 'challenge' && !challengeStarted ? 0 : progressTotal ? Math.min(position, progressTotal - 1) + 1 : 0
  const progressPercent = view === 'challenge' && challengeDone ? 100 : progressTotal ? progressPosition / progressTotal * 100 : 0

  function startChallengeSession(nextLetter = letter, nextReviewOnly = reviewOnly, nextShuffled = shuffled, nextSeed = shuffleRun) {
    const selected = filterCards(cards, nextLetter, nextReviewOnly)
    const ordered = nextShuffled ? shuffleCards(selected, seeded(nextSeed)) : selected
    setChallengeIds(ordered.map(card => card.id))
    setChallengeStarted(false)
    setChallengeDone(false)
    setRememberedCount(0)
    setMissedCount(0)
    setChallengeRun(value => value + 1)
    setPosition(0)
    setFlipped(false)
    setHintVisible(false)
  }

  function openChallenge() { startChallengeSession(); setView('challenge') }
  function changeChallengeMode(mode: ChallengeMode) { setChallengeMode(mode); startChallengeSession() }
  function changeLetter(value: string) { setLetter(value); setSelectedIds(new Set()); if (view === 'challenge') startChallengeSession(value); else { setPosition(0); setFlipped(false); setHintVisible(false) } }
  function changeReviewOnly(value: boolean) { setReviewOnly(value); setSelectedIds(new Set()); if (view === 'challenge') startChallengeSession(letter, value); else { setPosition(0); setFlipped(false); setHintVisible(false) } }
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

  function toggleSelected(id: number) {
    setSelectedIds(previous => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAllVisible() {
    const allSelected = selectedVisibleIds.length === libraryCards.length
    setSelectedIds(previous => {
      const next = new Set(previous)
      for (const card of libraryCards) {
        if (allSelected) next.delete(card.id)
        else next.add(card.id)
      }
      return next
    })
  }

  async function removeSelected() {
    const ids = selectedVisibleIds
    if (!ids.length || !window.confirm(`ลบคำศัพท์ที่เลือก ${ids.length} คำใช่ไหม?`)) return
    setDeletingSelected(true)
    const results = await Promise.allSettled(ids.map(id => api.delete(id)))
    const deleted = new Set(ids.filter((_, index) => results[index].status === 'fulfilled'))
    setCards(previous => previous.filter(card => !deleted.has(card.id)))
    setSelectedIds(previous => new Set([...previous].filter(id => !deleted.has(id))))
    const failures = ids.length - deleted.size
    setError(failures ? `ลบไม่สำเร็จ ${failures} คำ กรุณาลองอีกครั้ง` : '')
    setDeletingSelected(false)
  }

  async function importFile(file: File) {
    try {
      const result = await api.import(file)
      const updated = await api.list()
      setCards(updated); setImportResult(result); setError('')
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'นำเข้าไม่สำเร็จ') }
  }

  return <div className="min-h-screen bg-[#f4f8f7] text-slate-700">
    <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200/80 bg-white px-5 py-7 lg:sticky lg:top-0 lg:h-dvh lg:self-start lg:flex">
        <div className="flex items-center gap-3 px-2"><img src="/wordly-mark.svg" alt="" className="h-10 w-10 shrink-0 rounded-2xl shadow-md shadow-teal-100" /><div><div className="text-xl font-bold tracking-tight text-slate-900">wordly<span className="text-teal-700">.</span></div><div className="-mt-1 text-[10px] font-semibold uppercase tracking-[.19em] text-slate-400">flash cards</div></div></div>
        <div className="mt-12 px-3 text-[11px] font-bold uppercase tracking-[.17em] text-slate-400">เมนูหลัก</div>
        <nav className="mt-4 space-y-1" aria-label="เมนูหลัก">
          <button className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${view === 'library' ? 'bg-teal-50 text-teal-800' : 'text-slate-500 hover:bg-slate-50'}`} onClick={() => setView('library')}><BookOpen size={18} />คลังคำศัพท์</button>
          <button className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${view === 'study' ? 'bg-teal-50 text-teal-800' : 'text-slate-500 hover:bg-slate-50'}`} onClick={() => { setView('study'); setPosition(0); setFlipped(false); setHintVisible(false) }}><Layers3 size={18} />อ่านบัตรคำ</button>
          <button className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${view === 'challenge' ? 'bg-teal-50 text-teal-800' : 'text-slate-500 hover:bg-slate-50'}`} onClick={openChallenge}><Target size={18} />Challenge</button>
        </nav>
        <div className="mt-11 px-3 text-[11px] font-bold uppercase tracking-[.17em] text-slate-400">ตัวกรอง</div>
        <button className={`mt-4 flex w-full items-center justify-between rounded-xl px-3 py-3 text-sm font-medium ${reviewOnly ? 'bg-amber-50 text-amber-700' : 'text-slate-500 hover:bg-slate-50'}`} onClick={() => changeReviewOnly(!reviewOnly)}><span className="flex items-center gap-3"><Star size={18} />ต้องทบทวน</span><span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-500">{reviewCount}</span></button>
        <div className="mt-auto rounded-2xl bg-gradient-to-br from-teal-700 to-cyan-700 p-5 text-white"><Sparkles size={20} /><p className="mt-3 text-sm font-bold">เก่งขึ้นทีละคำ</p><p className="mt-1 text-xs leading-5 text-teal-100">เปิดบัตร ฝึกจำ แล้วเก็บคำที่อยากทบทวนไว้ในที่เดียว</p></div>
      </aside>

      <main className="min-h-screen min-w-0 flex-1">
        <header className="flex min-h-20 items-center justify-between border-b border-slate-200/80 bg-white px-5 lg:px-10"><div className="flex items-center gap-3"><img src="/wordly-mark.svg" alt="" className="h-9 w-9 shrink-0 lg:hidden" /><div><p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">My Flash Cards</p><h1 className="text-lg font-bold text-slate-900">{view === 'library' ? 'คลังคำศัพท์ของฉัน' : view === 'study' ? 'ฝึกจำคำศัพท์' : 'Challenge'}</h1></div></div><div className="flex items-center gap-2"><span className="hidden rounded-full bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-800 sm:block">{cards.length} คำศัพท์</span><Button onClick={openNew} size="sm"><Plus size={16} /> <span className="hidden sm:inline">เพิ่มคำศัพท์</span><span className="sm:hidden">เพิ่ม</span></Button></div></header>
        <div className="flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-5 py-2 lg:hidden"><button onClick={() => setView('library')} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${view === 'library' ? 'bg-teal-50 text-teal-800' : 'text-slate-500'}`}>คลังคำศัพท์</button><button onClick={() => { setView('study'); setPosition(0); setFlipped(false); setHintVisible(false) }} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${view === 'study' ? 'bg-teal-50 text-teal-800' : 'text-slate-500'}`}>อ่านบัตรคำ</button><button onClick={openChallenge} className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${view === 'challenge' ? 'bg-teal-50 text-teal-800' : 'text-slate-500'}`}>Challenge</button></div>
        <div className="mx-auto min-h-[calc(100dvh-5rem)] w-full max-w-6xl px-5 py-6 lg:px-10 lg:py-8">
          {error && <div role="alert" className="mb-6 flex items-start justify-between rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><span>{error}</span><button aria-label="ปิดข้อความผิดพลาด" onClick={() => setError('')}><X size={18} /></button></div>}
          {loading ? <p role="status" className="py-20 text-center text-slate-500">กำลังโหลดคำศัพท์...</p> : view === 'library' ? <>
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-teal-700">YOUR COLLECTION</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">คำศัพท์ทั้งหมด</h2><p className="mt-2 text-sm text-slate-500">เก็บทุกคำใหม่ไว้ที่นี่ แล้วกลับมาทบทวนได้เสมอ</p></div><div><input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" aria-label="เลือกไฟล์ CSV" onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = '' }} /><Button variant="secondary" onClick={() => fileRef.current?.click()}><FileUp size={17} /> นำเข้า CSV</Button></div></div>
            {importResult && <ImportNotice result={importResult} onClose={() => setImportResult(null)} />}
            <div className="mb-7 grid gap-4 sm:grid-cols-2"><div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-teal-50 p-2.5 text-teal-700"><BookOpen size={20} /></div><span className="text-sm font-medium text-slate-500">คำศัพท์ทั้งหมด</span></div><p className="mt-3 text-3xl font-bold text-slate-900">{cards.length}<span className="ml-2 text-sm font-medium text-slate-400">คำ</span></p></div><div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><div className="rounded-xl bg-amber-50 p-2.5 text-amber-500"><Star size={20} /></div><span className="text-sm font-medium text-slate-500">ต้องทบทวน</span></div><p className="mt-3 text-3xl font-bold text-slate-900">{reviewCount}<span className="ml-2 text-sm font-medium text-slate-400">คำ</span></p></div></div>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><h3 className="text-base font-bold text-slate-900">รายการคำศัพท์</h3><p className="text-xs text-slate-400">เลือกอักษรแรก ชนิดของคำ หรือค้นหาคำที่ต้องการ</p></div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <div className="flex items-center gap-2 whitespace-nowrap text-xs font-semibold text-slate-600"><label htmlFor="part-filter">ชนิดของคำ</label><Select id="part-filter" label="กรองชนิดของคำ" value={partFilter} onValueChange={value => { setPartFilter(value); setSelectedIds(new Set()) }} options={[{ value: 'ALL', label: 'ทุกชนิด' }, ...partOptions.map(part => ({ value: part, label: part }))]} className="w-36" /></div>
                <div role="search" className="relative w-full sm:w-72">
                  <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input aria-label="ค้นหาคำศัพท์" placeholder="ค้นหาคำศัพท์หรือความหมาย" value={search} onChange={event => { setSearch(event.target.value); setSelectedIds(new Set()) }} className="pl-10 pr-10" />
                  {search && <button type="button" aria-label="ล้างคำค้น" onClick={() => { setSearch(''); setSelectedIds(new Set()) }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={16} /></button>}
                </div>
                <button onClick={() => changeReviewOnly(!reviewOnly)} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${reviewOnly ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-500'}`}><Star size={15} fill={reviewOnly ? 'currentColor' : 'none'} /> เฉพาะคำที่ต้องทบทวน {reviewOnly && <Check size={14} />}</button>
              </div>
            </div>
            <div className="mb-5 flex flex-wrap gap-1.5"><button onClick={() => changeLetter('ALL')} className={`h-8 rounded-lg px-3 text-xs font-bold ${letter === 'ALL' ? 'bg-teal-700 text-white' : 'border border-slate-200 bg-white text-slate-500 hover:border-teal-300'}`}>ทั้งหมด</button>{alphabet.map(item => <button key={item} onClick={() => changeLetter(item)} className={`h-8 min-w-8 rounded-lg px-1 text-xs font-bold ${letter === item ? 'bg-teal-700 text-white' : 'border border-slate-200 bg-white text-slate-500 hover:border-teal-300'}`}>{item}</button>)}</div>
            {libraryCards.length > 0 && <div className="mb-3 flex flex-wrap items-center gap-3"><label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600"><input type="checkbox" aria-label="เลือกทั้งหมดที่แสดง" checked={selectedVisibleIds.length === libraryCards.length} onChange={toggleAllVisible} className="h-4 w-4 accent-teal-700" />เลือกทั้งหมดที่แสดง</label>{selectedVisibleIds.length > 0 && <><span className="text-sm text-slate-500">เลือก {selectedVisibleIds.length} คำ</span><Button variant="danger" size="sm" disabled={deletingSelected} onClick={() => void removeSelected()}><Trash2 size={15} /> {deletingSelected ? 'กำลังลบ...' : 'ลบที่เลือก'}</Button><Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>ยกเลิกการเลือก</Button></>}</div>}
            {libraryCards.length === 0 ? <Empty icon={<BookOpen size={28} />} title={cards.length === 0 ? 'ยังไม่มีคำศัพท์' : search.trim() ? 'ไม่พบคำที่ค้นหา' : 'ไม่พบคำศัพท์ในหมวดนี้'} description={cards.length === 0 ? 'เริ่มสะสมคำศัพท์คำแรก หรือจะนำเข้าจากไฟล์ CSV ก็ได้' : search.trim() ? 'ลองเปลี่ยนคำค้นหรือปิดตัวกรองอื่น' : 'ลองเปลี่ยนตัวกรองอักษร ชนิดของคำ หรือคำที่ต้องทบทวน'} action={cards.length === 0 ? <Button onClick={openNew}><Plus size={16} /> เพิ่มคำแรก</Button> : undefined} /> : <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="hidden grid-cols-[28px_1.2fr_1fr_1.5fr_100px] gap-4 border-b border-slate-100 bg-slate-50/70 px-6 py-3 text-xs font-bold text-slate-400 sm:grid"><span /><span>คำศัพท์</span><span>ชนิดของคำ</span><span>ความหมาย</span><span className="text-right">จัดการ</span></div>
              <div className="divide-y divide-slate-100">{libraryCards.map(card => <div key={card.id} className="grid grid-cols-[28px_minmax(0,1fr)] items-center gap-3 px-5 py-4 sm:grid-cols-[28px_1.2fr_1fr_1.5fr_100px] sm:gap-4 sm:px-6">
                <input type="checkbox" aria-label={`เลือก ${card.word}`} checked={selectedIds.has(card.id)} onChange={() => toggleSelected(card.id)} className="h-4 w-4 accent-teal-700" />
                <div className="flex min-w-0 items-center gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-base font-bold text-teal-700">{card.word[0]?.toUpperCase()}</span><span className="truncate font-bold text-slate-900">{card.word}</span></div>
                <div className="col-start-2 sm:col-auto"><PartBadge part={card.partOfSpeech} /></div>
                <p className="col-start-2 min-w-0 truncate text-sm text-slate-600 sm:col-auto">{card.meaning}</p>
                <div className="col-start-2 flex justify-end gap-1 sm:col-auto"><Button variant="ghost" size="icon" aria-label={card.needsReview ? `ยกเลิกทบทวน ${card.word}` : `เก็บไว้ทบทวน ${card.word}`} title={card.needsReview ? 'ยกเลิกทบทวน' : 'เก็บไว้ทบทวน'} onClick={() => void toggleReview(card)} className={card.needsReview ? 'text-amber-500' : ''}><Star size={17} fill={card.needsReview ? 'currentColor' : 'none'} /></Button><Button variant="ghost" size="icon" aria-label={`แก้ไข ${card.word}`} onClick={() => openEdit(card)}><Pencil size={16} /></Button><Button variant="danger" size="icon" aria-label={`ลบ ${card.word}`} onClick={() => void remove(card)}><Trash2 size={16} /></Button></div>
              </div>)}</div>
            </div>}
          </> : <>
            {(view !== 'challenge' || !challengeStarted) && <div className={`mb-6 ${view === 'challenge' ? 'mx-auto max-w-3xl' : ''}`}><p className="text-xs font-bold uppercase tracking-[.18em] text-teal-700">{view === 'challenge' ? 'CHALLENGE MODE' : 'STUDY MODE'}</p><h2 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">{view === 'challenge' ? 'ท้าทายความจำ' : 'ฝึกจำทีละใบ'}</h2><p className="mt-2 text-sm text-slate-500">{view === 'challenge' ? 'ฝึกพิมพ์คำศัพท์ ฟังเสียง หรือทบทวนความหมายทีละคำ' : 'พลิกบัตรเพื่อเฉลย และเก็บคำที่ยังจำไม่ได้ไว้ทบทวน'}</p></div>}
            <div className={view === 'challenge' ? 'mx-auto max-w-3xl' : ''}>
            {view === 'challenge' && <div className="mb-4 flex flex-wrap gap-2" aria-label="รูปแบบ Challenge">{([['copy', 'เห็นคำแล้วพิมพ์'], ['listen', 'ฟังแล้วพิมพ์'], ['meaning', 'ทบทวนความหมาย']] as const).map(([mode, label]) => <button key={mode} type="button" aria-pressed={challengeMode === mode} onClick={() => changeChallengeMode(mode)} className={`rounded-xl border px-3 py-2 text-sm font-semibold ${challengeMode === mode ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-600 hover:border-teal-200'}`}>{label}</button>)}</div>}
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"><div className="flex items-center gap-2 text-sm font-semibold text-slate-600"><label htmlFor="letter-filter">หมวดอักษร</label><Select id="letter-filter" label="หมวดอักษร" value={letter} onValueChange={changeLetter} options={[{ value: 'ALL', label: 'ทั้งหมด' }, ...alphabet.map(item => ({ value: item, label: item }))]} className="w-32" /></div><button onClick={() => changeReviewOnly(!reviewOnly)} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${reviewOnly ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600'}`}><Star size={16} fill={reviewOnly ? 'currentColor' : 'none'} /> ต้องทบทวน</button><button onClick={toggleShuffle} className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${shuffled ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600'}`}><Shuffle size={16} /> สุ่มคำ {shuffled ? 'เปิด' : 'ปิด'}</button>{shuffled && <Button variant="ghost" size="sm" onClick={reshuffle}><RotateCcw size={15} /> สุ่มใหม่</Button>}{view === 'challenge' && challengeMode === 'meaning' && <div className="ml-auto flex items-center gap-2"><span className="text-xs font-medium text-slate-500">คำถาม</span><div className="flex rounded-xl border border-slate-200 bg-white p-1"><button onClick={() => setFirstLanguage('ENG')} className={firstLanguage === 'ENG' ? 'rounded-lg bg-teal-700 px-3 py-1 text-xs font-bold text-white' : 'rounded-lg px-3 py-1 text-xs font-bold text-slate-500'}>ENG</button><button onClick={() => setFirstLanguage('THAI')} className={firstLanguage === 'THAI' ? 'rounded-lg bg-teal-700 px-3 py-1 text-xs font-bold text-white' : 'rounded-lg px-3 py-1 text-xs font-bold text-slate-500'}>THAI</button></div></div>}</div>
            </div>
            <div className="mx-auto max-w-3xl"><div className="mb-3 flex items-center justify-between text-xs font-semibold text-slate-500"><span>{view === 'challenge' ? 'คำที่' : 'บัตรที่'} {progressPosition} จาก {progressTotal}</span><span>{letter === 'ALL' ? 'ทุกหมวด' : `หมวด ${letter}`}{reviewOnly ? ' · ต้องทบทวน' : ''}</span></div><div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-teal-700 transition-all" style={{ width: `${progressPercent}%` }} /></div>
              {view === 'challenge' ? (
                challengeIds.length === 0 ? <Empty icon={<Target size={28} />} title="ยังไม่มีคำสำหรับ Challenge" description="ลองเปลี่ยนหมวดอักษรหรือปิดตัวกรองคำที่ต้องทบทวน" action={<Button variant="secondary" onClick={() => setView('library')}>ไปคลังคำศัพท์</Button>} /> :
                challengeDone ? <div className="rounded-2xl border border-teal-100 bg-white px-6 py-12 text-center shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><Target size={28} /></div><h3 className="mt-5 text-2xl font-bold text-slate-900">จบรอบ Challenge</h3><p className="mt-2 text-sm text-slate-500">จำได้ {rememberedCount} คำ · ยังจำไม่ได้ {missedCount} คำ</p><Button className="mt-6" onClick={() => startChallengeSession()}><RotateCcw size={17} /> เริ่มรอบใหม่</Button></div> :
                !challengeStarted ? <div className="flex min-h-72 flex-col items-center justify-center rounded-[28px] border border-teal-100 bg-gradient-to-br from-white to-teal-50 px-6 text-center shadow-sm"><div className="rounded-2xl bg-teal-100 p-4 text-teal-700"><Target size={28} /></div><h3 className="mt-5 text-xl font-bold text-slate-900">พร้อมฝึก {challengeIds.length} คำ</h3><p className="mt-2 text-sm text-slate-500">{challengeMode === 'meaning' ? 'กดเริ่มเมื่อพร้อมทบทวนความหมาย' : 'เสียงคำศัพท์จะเล่นหลังจากกดเริ่ม'}</p><Button className="mt-6" onClick={() => setChallengeStarted(true)}>เริ่ม Challenge <ArrowRight size={17} /></Button></div> :
                challengeCard ? <ChallengePanel key={challengeRun + '-' + challengeCard.id + '-' + firstLanguage + '-' + challengeMode} card={challengeCard} mode={challengeMode} firstLanguage={firstLanguage} soundEffects={soundEffects} onToggleSoundEffects={() => setSoundEffects(value => !value)} onAssess={assessChallenge} /> :
                <Empty icon={<Target size={28} />} title="ไม่พบคำศัพท์" description="กลับไปคลังคำศัพท์แล้วเริ่มรอบใหม่" action={<Button onClick={openChallenge}>เริ่มรอบใหม่</Button>} />
              ) : current ? <><div className="study-card h-[300px] cursor-pointer select-none sm:h-[320px]" onClick={() => { setFlipped(value => !value); setHintVisible(false) }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setFlipped(value => !value); setHintVisible(false) } }} role="button" tabIndex={0} aria-label="พลิกบัตร" aria-pressed={flipped}><div className="study-card-inner" style={{ transform: flipped ? 'rotateY(180deg)' : undefined }}><div className="study-face flex flex-col items-center justify-center rounded-[28px] border border-teal-100 bg-gradient-to-br from-white via-white to-teal-50 p-8 text-center shadow-[0_16px_50px_-20px_rgba(15,118,110,.18)]"><span className="absolute left-7 top-7 rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-teal-700">{firstLanguage === 'ENG' ? 'ENGLISH' : 'ความหมาย'}</span><span className="absolute right-7 top-7 text-xs font-medium text-slate-400">ด้านหน้า</span><span data-testid="front-value" className="max-w-full break-words text-3xl font-bold leading-tight text-slate-900 sm:text-5xl">{firstLanguage === 'ENG' ? current.word : current.meaning}</span>{firstLanguage === 'ENG' && <PartBadge part={current.partOfSpeech} className="mt-4" />}{hintVisible && current.hint && <span role="status" className="mt-5 max-h-28 max-w-[90%] overflow-y-auto rounded-xl bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800"><Lightbulb size={16} className="mr-1 inline-block" />{current.hint}</span>}<span className="absolute bottom-8 text-xs font-medium text-slate-400">คลิกเพื่อดูเฉลย · พลิกบัตร</span></div><div className="study-face back flex flex-col items-center justify-center rounded-[28px] border border-teal-200 bg-teal-700 p-8 text-center text-white shadow-[0_16px_50px_-20px_rgba(15,118,110,.28)]"><span className="absolute left-7 top-7 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider">{firstLanguage === 'ENG' ? 'ความหมาย' : 'ENGLISH'}</span><span className="absolute right-7 top-7 text-xs text-teal-200">ด้านหลัง</span><span data-testid="back-value" className="max-w-full break-words text-3xl font-bold leading-tight sm:text-5xl">{firstLanguage === 'ENG' ? current.meaning : current.word}</span>{firstLanguage === 'THAI' && <PartBadge part={current.partOfSpeech} className="mt-4" />}<span className="absolute bottom-8 text-xs text-teal-200">คลิกเพื่อกลับไปด้านหน้า</span></div></div></div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{current.hint && !flipped && <Button variant="secondary" onClick={() => setHintVisible(value => !value)}><Lightbulb size={17} /> {hintVisible ? 'ซ่อนคำใบ้' : 'ดูคำใบ้'}</Button>}<Button variant="secondary" onClick={() => void toggleReview(current)} className={current.needsReview ? 'border-amber-200 bg-amber-50 text-amber-700' : ''}><Star size={17} fill={current.needsReview ? 'currentColor' : 'none'} /> {current.needsReview ? 'อยู่ในคำที่ต้องทบทวน' : 'จำไม่ได้ เก็บไว้ทบทวน'}</Button>{(firstLanguage === 'ENG' && !flipped || firstLanguage === 'THAI' && flipped) && 'speechSynthesis' in window && <Button variant="secondary" onClick={() => speak(current.word)} aria-label={`ออกเสียง ${current.word}`}><Volume2 size={17} /><span className="hidden sm:inline">ออกเสียง</span></Button>}</div><div className="flex gap-2"><Button variant="secondary" size="icon" onClick={() => navigate(currentIndex - 1)} disabled={currentIndex === 0} aria-label="บัตรก่อนหน้า"><ArrowLeft size={18} /></Button>{currentIndex + 1 === deck.length ? <Button onClick={() => { setPosition(0); setFlipped(false); setHintVisible(false); if (shuffled) reshuffle() }}><RotateCcw size={17} /> เริ่มรอบใหม่</Button> : <Button onClick={() => navigate(currentIndex + 1)}>บัตรถัดไป <ArrowRight size={17} /></Button>}</div></div>
              </> : <Empty icon={<Layers3 size={28} />} title="ยังไม่มีบัตรในหมวดนี้" description="ลองเปลี่ยนหมวดอักษรหรือปิดตัวกรองคำที่ต้องทบทวน" action={<Button variant="secondary" onClick={() => setView('library')}>ไปคลังคำศัพท์</Button>} />}
              {view === 'study' && <div className="mt-7 flex flex-wrap items-center justify-center gap-3 border-t border-slate-200 pt-6 text-sm"><span className="font-medium text-slate-500">แสดงด้านหน้าเป็น</span><div className="flex rounded-xl border border-slate-200 bg-white p-1"><button onClick={() => { setFirstLanguage('ENG'); setFlipped(false); setHintVisible(false) }} className={`rounded-lg px-4 py-2 text-xs font-bold ${firstLanguage === 'ENG' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-500'}`}>ENG ก่อน</button><button onClick={() => { setFirstLanguage('THAI'); setFlipped(false); setHintVisible(false) }} className={`rounded-lg px-4 py-2 text-xs font-bold ${firstLanguage === 'THAI' ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-500'}`}>THAI ก่อน</button></div></div>}
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
