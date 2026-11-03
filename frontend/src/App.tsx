import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, Check, FileUp, Layers3, Lightbulb, Pencil, Plus, RotateCcw, Search, Shuffle, Sparkles, Star, Target, Trash2, Volume2, VolumeX, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { api } from '@/lib/api'
import { readCachedCards, writeCachedCards } from '@/lib/card-cache'
import { playAnswerSound } from '@/lib/answer-sound'
import { filterByPartOfSpeech, filterCards, isTypingMatch, searchCards, shuffleCards, typingFeedback, type Card, type CardFields, type ImportProgress, type ImportResult } from '@/lib/cards'

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
const pageSize = 50
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

function PartBadges({ parts, className = '' }: { parts: string[]; className?: string }) {
  return <div className={`flex flex-wrap items-center justify-center gap-1.5 ${className}`}>{parts.map(part => <PartBadge key={part.toLowerCase()} part={part} />)}</div>
}

function CardEditor({ card, onCancel, onSave }: { card: Card | null; onCancel: () => void; onSave: (fields: CardFields) => Promise<void> }) {
  const [fields, setFields] = useState<CardFields>({ word: card?.word || '', partsOfSpeech: card?.partsOfSpeech || [''], meanings: card?.meanings || [''], hint: card?.hint || '' })
  const [partSelections, setPartSelections] = useState(() => (card?.partsOfSpeech || ['']).map(part => part && !partsOfSpeech.includes(part.toLowerCase()) ? 'other' : part.toLowerCase()))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function setPart(index: number, value: string, selection = value) {
    setFields(previous => ({ ...previous, partsOfSpeech: previous.partsOfSpeech.map((part, at) => at === index ? value : part) }))
    setPartSelections(previous => previous.map((part, at) => at === index ? selection : part))
  }

  function removePart(index: number) {
    setFields(previous => ({ ...previous, partsOfSpeech: previous.partsOfSpeech.filter((_, at) => at !== index) }))
    setPartSelections(previous => previous.filter((_, at) => at !== index))
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (fields.partsOfSpeech.some(part => !part.trim())) {
      setError('กรุณาเลือกชนิดของคำให้ครบ')
      document.getElementById('card-part-of-speech')?.focus()
      return
    }
    setSaving(true); setError('')
    try { await onSave(fields) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ') }
    finally { setSaving(false) }
  }

  return <form onSubmit={submit} className="space-y-5">
    <div><DialogTitle className="text-xl font-bold text-slate-900">{card ? 'แก้ไขคำศัพท์' : 'เพิ่มคำศัพท์ใหม่'}</DialogTitle><DialogDescription className="mt-1 text-sm text-slate-500">เติมรายละเอียดเพื่อสร้างบัตรคำศัพท์ของคุณ</DialogDescription></div>
    <div className="space-y-4">
      <label className="block text-sm font-semibold text-slate-700">คำศัพท์ภาษาอังกฤษ<Input autoFocus value={fields.word} onChange={event => setFields({ ...fields, word: event.target.value })} placeholder="เช่น Serendipity" className="mt-2" required /></label>
      <div><p className="text-sm font-semibold text-slate-700">ชนิดของคำ</p><div className="mt-2 space-y-2">{fields.partsOfSpeech.map((part, index) => <div key={index} className="flex items-start gap-2"><div className="min-w-0 flex-1"><Select id={index === 0 ? 'card-part-of-speech' : `card-part-of-speech-${index}`} label={index === 0 ? 'ชนิดของคำ' : `ชนิดของคำ ${index + 1}`} value={partSelections[index]} onValueChange={value => setPart(index, value === 'other' ? '' : value, value)} required placeholder="เลือกชนิดของคำ" options={[...partsOfSpeech.map(item => ({ value: item, label: item })), { value: 'other', label: 'อื่น ๆ' }]} className="h-11 w-full" />{partSelections[index] === 'other' && <Input aria-label={`ระบุชนิดของคำ ${index + 1}`} value={part} onChange={event => setPart(index, event.target.value, 'other')} placeholder="ระบุชนิดของคำ" className="mt-2" required />}</div>{fields.partsOfSpeech.length > 1 && <Button type="button" variant="ghost" size="icon" aria-label={`ลบชนิดของคำ ${index + 1}`} onClick={() => removePart(index)}><X size={16} /></Button>}</div>)}</div><Button type="button" variant="ghost" size="sm" onClick={() => { setFields(previous => ({ ...previous, partsOfSpeech: [...previous.partsOfSpeech, ''] })); setPartSelections(previous => [...previous, '']) }} className="mt-2"><Plus size={15} /> เพิ่มชนิดของคำ</Button></div>
      <div><label htmlFor="card-meanings" className="block text-sm font-semibold text-slate-700">ความหมายภาษาไทย</label><textarea id="card-meanings" value={fields.meanings.join('\n')} onChange={event => setFields({ ...fields, meanings: event.target.value.split('\n') })} placeholder="หนึ่งความหมายต่อบรรทัด" rows={3} required className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm text-slate-800 shadow-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" /><p className="mt-1 text-xs text-slate-500">ขึ้นบรรทัดใหม่เพื่อเพิ่มความหมาย ไม่จำเป็นต้องเรียงให้ตรงกับชนิดของคำ</p></div>
      <label className="block text-sm font-semibold text-slate-700">คำใบ้ <span className="font-normal text-slate-400">(ไม่บังคับ)</span><Input value={fields.hint} onChange={event => setFields({ ...fields, hint: event.target.value })} placeholder="เช่น ผลไม้สีแดง" className="mt-2" /></label>
    </div>
    {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    <div className="flex justify-end gap-2 border-t border-slate-100 pt-4"><Button type="button" variant="secondary" onClick={onCancel}>ยกเลิก</Button><Button type="submit" disabled={saving}>{saving ? 'กำลังบันทึก...' : card ? 'บันทึกการแก้ไข' : 'เพิ่มคำศัพท์'}</Button></div>
  </form>
}

function ImportNotice({ result, onClose }: { result: ImportResult; onClose: () => void }) {
  return <div className="mb-6 rounded-2xl border border-teal-100 bg-teal-50/60 p-4 text-sm text-slate-700">
    <div className="flex items-start justify-between gap-2"><div role="status"><p className="font-bold text-slate-900">นำเข้า CSV เสร็จแล้ว</p><p className="mt-1">เพิ่ม {result.added} คำ · รวมข้อมูล {result.merged} แถว · ข้ามคำซ้ำ {result.skipped} แถว · ข้อมูลไม่ครบ/ผิดรูปแบบ {result.invalid} แถว</p></div><button onClick={onClose} aria-label="ปิดผลนำเข้า" className="text-slate-500"><X size={18} /></button></div>
    {result.issues.length > 0 && <details className="mt-3 border-t border-teal-100 pt-3" open={result.invalid > 0}>
      <summary className="cursor-pointer font-semibold text-teal-800">ดูรายการที่ไม่ได้เพิ่ม ({result.issues.length})</summary>
      <ul className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-2">{result.issues.map((issue, index) => <li key={index} className={`rounded-lg bg-white px-3 py-2 ${issue.kind === 'skipped' ? 'text-slate-600' : 'text-red-700'}`}>แถว {issue.row} · {issue.word || 'ไม่ระบุคำศัพท์'} · {issue.kind === 'skipped' ? 'ข้าม' : 'นำเข้าไม่ได้'}: {issue.reason}</li>)}</ul>
    </details>}
  </div>
}

function ImportProgressNotice({ fileName, progress }: { fileName: string; progress: ImportProgress }) {
  const label = progress.phase === 'uploading' ? `กำลังอัปโหลด CSV ${progress.percent}%` : progress.phase === 'processing' ? 'กำลังตรวจและบันทึกคำศัพท์' : 'กำลังโหลดรายการคำศัพท์ล่าสุด'
  return <div className="mb-6 rounded-2xl border border-teal-100 bg-white p-4 shadow-sm" aria-busy="true">
    <div className="flex items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-medium text-slate-500">{fileName}</p><p role="status" className="mt-1 text-sm font-semibold text-teal-800">{label}</p></div><FileUp size={20} className="shrink-0 text-teal-700" /></div>
    <div role="progressbar" aria-label="ความคืบหน้าการนำเข้า CSV" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.phase === 'uploading' ? progress.percent : undefined} className="mt-3 h-2 overflow-hidden rounded-full bg-teal-100"><div className={`h-full rounded-full bg-teal-600 transition-[width] ${progress.phase === 'uploading' ? '' : 'animate-pulse'}`} style={{ width: progress.phase === 'uploading' ? `${progress.percent}%` : '100%' }} /></div>
  </div>
}

type ConfirmRequest = { title: string; description: string; confirmLabel: string; danger?: boolean; onConfirm: () => void }

function ConfirmDialog({ request, onClose }: { request: ConfirmRequest | null; onClose: () => void }) {
  return <Dialog open={request !== null} onOpenChange={open => { if (!open) onClose() }}>
    <DialogContent className="max-w-md">
      {request && <>
        <DialogTitle className="pr-8 text-lg font-bold text-slate-900">{request.title}</DialogTitle>
        <DialogDescription className="mt-2 text-sm leading-6 text-slate-600">{request.description}</DialogDescription>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button variant="secondary" onClick={onClose}>ยกเลิก</Button><Button className={request.danger ? 'bg-red-600 hover:bg-red-700' : ''} onClick={() => { onClose(); request.onConfirm() }}>{request.confirmLabel}</Button></div>
      </>}
    </DialogContent>
  </Dialog>
}

function LanguageToggle({ label, value, onChange }: { label: string; value: 'ENG' | 'THAI'; onChange: (value: 'ENG' | 'THAI') => void }) {
  return <div className="flex items-center gap-2" role="group" aria-label={label}><span className="text-sm font-semibold text-slate-600">{label}</span><div className="flex rounded-xl border border-slate-200 bg-white p-1">{(['ENG', 'THAI'] as const).map(item => <button key={item} type="button" aria-pressed={value === item} onClick={() => onChange(item)} className={`rounded-lg px-3 py-1 text-xs font-bold ${value === item ? 'bg-teal-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}>{item}</button>)}</div></div>
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
  const assessRef = useRef<HTMLDivElement>(null)
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
    if (mode === 'meaning' && revealed) assessRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [mode, revealed])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  function submit(event: FormEvent) {
    event.preventDefault()
    if (mode === 'meaning') { if (!revealed) setRevealed(true); else if (!pending) void assess(true); return }
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

  return <form onSubmit={submit} className="mx-auto w-full max-w-3xl rounded-[28px] border border-teal-100 bg-gradient-to-br from-white to-teal-50 px-5 py-5 shadow-sm sm:px-8 sm:py-6">
    <div className="flex min-h-32 flex-col items-center justify-center px-2 pb-4 text-center sm:min-h-40">
      <span className="mb-3 rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800">{mode === 'listen' ? 'ฟังแล้วพิมพ์' : mode === 'copy' ? 'พิมพ์ตามคำศัพท์' : firstLanguage === 'ENG' ? 'ENGLISH' : 'ความหมาย'}</span>
      {mode === 'copy' ? <p data-testid="challenge-prompt" aria-label={card.word} className="max-w-full break-words text-3xl font-bold leading-tight sm:text-5xl"><span data-testid="typing-feedback" aria-hidden="true">{wordLetters.map((character, index) => <span key={index} data-state={feedback[index] ? feedback[index].correct ? 'correct' : 'wrong' : 'pending'} className={feedback[index] ? feedback[index].correct ? 'text-emerald-600' : 'text-red-600' : 'text-slate-900'}>{character === ' ' ? '\u00a0' : character}</span>)}{feedback.slice(wordLetters.length).map((letter, index) => <span key={`extra-${index}`} data-state="wrong" className="text-red-600">{letter.character === ' ' ? '\u00a0' : letter.character}</span>)}</span></p> : mode === 'listen' ? <><p data-testid="challenge-prompt" className="text-lg font-semibold text-slate-700">ฟังเสียงแล้วพิมพ์คำศัพท์</p><div data-testid="typing-feedback" aria-label="อักษรที่พิมพ์" className="mt-3 min-h-12 max-w-full break-words text-3xl font-bold leading-tight sm:text-5xl">{feedback.map((letter, index) => <span key={index} data-state={letter.correct ? 'correct' : 'wrong'} className={letter.correct ? 'text-emerald-600' : 'text-red-600'}>{letter.character === ' ' ? '\u00a0' : letter.character}</span>)}</div>{revealed && <p data-testid="challenge-answer" className="mt-2 text-xl font-bold text-slate-900">{card.word}</p>}</> : <p data-testid="challenge-prompt" className="max-w-full break-words text-3xl font-bold leading-tight text-slate-900 sm:text-5xl">{prompt}</p>}
      {mode === 'meaning' && firstLanguage === 'ENG' && <PartBadges parts={card.partsOfSpeech} className="mt-2" />}
      {assessment !== null && <p data-testid="answer-result" role="status" className={`mt-3 rounded-full px-3 py-1 text-sm font-bold ${assessment ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>{assessment ? 'ถูกต้อง!' : 'ยังไม่ถูก เก็บไว้ทบทวน'}</p>}
      {mode !== 'meaning' && 'speechSynthesis' in window && <Button variant="secondary" size="sm" type="button" onClick={() => speak(card.word)} className="mt-4"><Volume2 size={16} /> ฟังอีกครั้ง</Button>}
      {mode === 'listen' && !('speechSynthesis' in window) && <p role="alert" className="mt-3 text-sm text-amber-700">เบราว์เซอร์นี้ไม่รองรับเสียงอ่าน ลองใช้โหมดพิมพ์ตามคำศัพท์</p>}
      {hint && !revealed && <div className="mt-3"><Button variant="ghost" size="sm" type="button" onClick={() => setHintVisible(value => !value)}><Lightbulb size={16} /> {hintVisible ? 'ซ่อนคำใบ้' : 'ดูคำใบ้'}</Button>{hintVisible && <p role="status" className="mt-2 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">{hint}</p>}</div>}
    </div>
    <div className="mx-auto w-full max-w-xl border-t border-teal-100 pt-5">
      <div className="mb-2 flex items-center justify-between gap-2"><label htmlFor="challenge-answer" className="whitespace-nowrap text-sm font-semibold text-slate-700">{mode === 'meaning' ? 'คำตอบของฉัน' : 'พิมพ์คำศัพท์ภาษาอังกฤษ'}</label><button type="button" aria-pressed={soundEffects} aria-label={`เสียงตอบรับ ${soundEffects ? "เปิด" : "ปิด"}`} onClick={onToggleSoundEffects} className="inline-flex shrink-0 items-center whitespace-nowrap gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700">{soundEffects ? <Volume2 size={14} /> : <VolumeX size={14} />} <span className="hidden sm:inline">เสียงตอบรับ</span> {soundEffects ? 'เปิด' : 'ปิด'}</button></div>
      <Input id="challenge-answer" autoFocus value={answer} disabled={pending} readOnly={revealed} aria-invalid={mode !== 'meaning' && feedback.some(letter => !letter.correct)} onChange={event => setAnswer(event.target.value)} placeholder={mode !== 'meaning' || firstLanguage === 'THAI' ? 'พิมพ์คำศัพท์ภาษาอังกฤษ' : 'พิมพ์ความหมายภาษาไทย'} required={mode !== 'meaning' && !revealed} />
      {mode !== 'meaning' && <><p className="mt-3 text-sm text-slate-500">อักษรบนการ์ดจะแสดงสีเขียวเมื่อถูก สีแดงเมื่อผิด · กด Enter เพื่อไปคำถัดไป</p>{revealed && <p className="mt-2 text-sm text-amber-700">ดูเฉลยแล้ว คำนี้จะถูกเก็บไว้ทบทวน</p>}<div className="mt-4 flex justify-end gap-2">{!revealed && <Button type="button" variant="secondary" onClick={() => setRevealed(true)}>ดูเฉลย</Button>}<Button type="submit" disabled={pending || (!revealed && !answer.trim())}>{pending ? 'กำลังบันทึก...' : 'คำถัดไป'} <ArrowRight size={16} /></Button></div></>}
      {mode === 'meaning' && (!revealed ? <div className="mt-4 flex justify-end"><Button type="submit">ดูเฉลย <ArrowRight size={16} /></Button></div> : <>
        <div className="mt-3 rounded-xl bg-teal-50 px-4 py-3"><p className="text-xs font-bold text-teal-700">เฉลย</p><p className="mt-1 text-xl font-bold text-slate-900">{solution}</p>{mode === 'meaning' && firstLanguage === 'THAI' && <PartBadges parts={card.partsOfSpeech} className="mt-2" />}</div>
        <p className="mt-3 text-sm text-slate-500">กด Enter ถ้าจำได้ หรือคลิก ยังจำไม่ได้ เพื่อบันทึกผลและไปคำถัดไป</p>
        <div ref={assessRef} className="mt-3 flex flex-wrap gap-2 scroll-mb-6"><Button type="button" variant="secondary" disabled={pending} onClick={() => void assess(false)}><Star size={16} /> ยังจำไม่ได้</Button><Button type="submit" disabled={pending}><Check size={16} /> จำได้</Button></div>
      </>)}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    </div>
  </form>
}

export default function App() {
  const [initialCards] = useState(readCachedCards)
  const [cards, setCards] = useState<Card[]>(() => initialCards ?? [])
  const [loading, setLoading] = useState(initialCards === null)
  const [hasSnapshot, setHasSnapshot] = useState(initialCards !== null)
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
  const [importState, setImportState] = useState<{ fileName: string; progress: ImportProgress } | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set())
  const [deletingSelected, setDeletingSelected] = useState(false)
  const [reviewSaving, setReviewSaving] = useState<Set<number>>(() => new Set())
  const [visibleCount, setVisibleCount] = useState(pageSize)
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(null)
  const reviewInFlight = useRef<Set<number>>(new Set())
  const changedSinceFetch = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const importing = useRef(false)

  function updateCards(value: React.SetStateAction<Card[]>) {
    changedSinceFetch.current = true
    setCards(value)
  }

  useEffect(() => {
    let active = true
    api.list().then(value => {
      if (active) {
        if (!changedSinceFetch.current) setCards(value)
        setHasSnapshot(true)
      }
    }).catch(cause => { if (active) setError(cause.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  useEffect(() => { if (hasSnapshot) writeCachedCards(cards) }, [cards, hasSnapshot])

  const filtered = useMemo(() => filterCards(cards, letter, reviewOnly), [cards, letter, reviewOnly])
  const partOptions = useMemo(() => [...new Set([...cards.flatMap(card => card.partsOfSpeech.map(part => part.trim().toLowerCase())), ...(partFilter === 'ALL' ? [] : [partFilter])])].filter(Boolean).sort(), [cards, partFilter])
  const libraryCards = useMemo(() => searchCards(filterByPartOfSpeech(filtered, partFilter), search), [filtered, partFilter, search])
  const shownCards = libraryCards.slice(0, visibleCount)
  const selectedVisibleIds = libraryCards.filter(card => selectedIds.has(card.id)).map(card => card.id)
  const allShownSelected = shownCards.length > 0 && shownCards.every(card => selectedIds.has(card.id))
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

  // Changing settings mid-round restarts the challenge, so ask before throwing away answered words.
  function guardChallenge(action: () => void) {
    if (view !== 'challenge' || !challengeStarted || challengeDone || position === 0) { action(); return }
    setConfirmRequest({ title: 'เริ่มรอบใหม่ใช่ไหม?', description: `รอบนี้ทำไปแล้ว ${position} จาก ${challengeIds.length} คำ ถ้าเปลี่ยนตอนนี้ ความคืบหน้าของรอบนี้จะหายไป (สถานะคำที่ตอบไปแล้วยังถูกบันทึกไว้)`, confirmLabel: 'เริ่มรอบใหม่', onConfirm: action })
  }
  function resetLibraryList() { setSelectedIds(new Set()); setVisibleCount(pageSize) }
  function goTo(next: 'library' | 'study' | 'challenge') {
    if (next === view) return
    guardChallenge(() => {
      if (next === 'challenge') startChallengeSession()
      else { setPosition(0); setFlipped(false); setHintVisible(false) }
      setView(next)
    })
  }
  function changeChallengeMode(mode: ChallengeMode) { if (mode !== challengeMode) guardChallenge(() => { setChallengeMode(mode); startChallengeSession() }) }
  function changeLetter(value: string) { guardChallenge(() => { setLetter(value); resetLibraryList(); if (view === 'challenge') startChallengeSession(value); else { setPosition(0); setFlipped(false); setHintVisible(false) } }) }
  function changeReviewOnly(value: boolean) { guardChallenge(() => { setReviewOnly(value); resetLibraryList(); if (view === 'challenge') startChallengeSession(letter, value); else { setPosition(0); setFlipped(false); setHintVisible(false) } }) }
  function toggleShuffle() { guardChallenge(() => { const next = !shuffled; const seed = Date.now(); setShuffled(next); setShuffleRun(seed); if (view === 'challenge') startChallengeSession(letter, reviewOnly, next, seed); else { setPosition(0); setFlipped(false); setHintVisible(false) } }) }
  function reshuffle() { guardChallenge(() => { const seed = Date.now(); setShuffleRun(seed); if (view === 'challenge') startChallengeSession(letter, reviewOnly, shuffled, seed); else { setPosition(0); setFlipped(false); setHintVisible(false) } }) }
  function changeFirstLanguage(value: 'ENG' | 'THAI') { setFirstLanguage(value); setFlipped(false); setHintVisible(false) }
  function navigate(next: number) { setPosition(next); setFlipped(false); setHintVisible(false) }
  function restartStudy() { setPosition(0); setFlipped(false); setHintVisible(false); if (shuffled) reshuffle() }
  function openNew() { setEditing(null); setEditorOpen(true) }
  function openEdit(card: Card) { setEditing(card); setEditorOpen(true) }

  async function save(fields: CardFields) {
    const saved = editing ? await api.update(editing.id, fields) : await api.create(fields)
    updateCards(previous => editing ? previous.map(card => card.id === saved.id ? saved : card).sort(sortCards) : [...previous, saved].sort(sortCards))
    setEditorOpen(false)
    setError('')
  }

  useEffect(() => {
    if (view !== 'study' || editorOpen || confirmRequest) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, [role="combobox"], [role="listbox"], [role="dialog"]')) return
      if (event.key === 'ArrowRight' && currentIndex + 1 < deck.length) { event.preventDefault(); navigate(currentIndex + 1) }
      else if (event.key === 'ArrowLeft' && currentIndex > 0) { event.preventDefault(); navigate(currentIndex - 1) }
      else if (event.key === ' ' && !target.closest('button, [role="button"]') && deck.length) { event.preventDefault(); setFlipped(value => !value); setHintVisible(false) }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [view, editorOpen, confirmRequest, currentIndex, deck.length])

  async function toggleReview(card: Card) {
    if (reviewInFlight.current.has(card.id)) return
    reviewInFlight.current.add(card.id)
    setReviewSaving(previous => new Set(previous).add(card.id))
    const nextNeedsReview = !card.needsReview
    updateCards(previous => previous.map(item => item.id === card.id ? { ...item, needsReview: nextNeedsReview } : item))
    if (reviewOnly && card.needsReview) { setFlipped(false); setHintVisible(false) }
    try {
      const saved = await api.review(card.id, nextNeedsReview)
      updateCards(previous => previous.map(item => item.id === card.id ? { ...item, needsReview: saved.needsReview } : item))
    } catch (cause) {
      updateCards(previous => previous.map(item => item.id === card.id ? { ...item, needsReview: card.needsReview } : item))
      setError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ')
    } finally {
      reviewInFlight.current.delete(card.id)
      setReviewSaving(previous => { const next = new Set(previous); next.delete(card.id); return next })
    }
  }

  async function assessChallenge(remembered: boolean) {
    if (!challengeCard) return
    const needsReview = !remembered
    if (challengeCard.needsReview !== needsReview) {
      const saved = await api.review(challengeCard.id, needsReview)
      updateCards(previous => previous.map(card => card.id === saved.id ? saved : card))
    }
    if (remembered) setRememberedCount(value => value + 1)
    else setMissedCount(value => value + 1)
    if (position + 1 >= challengeIds.length) setChallengeDone(true)
    else setPosition(value => value + 1)
  }

  function remove(card: Card) {
    setConfirmRequest({ title: `ลบคำว่า “${card.word}” ใช่ไหม?`, description: 'คำศัพท์ ชนิดของคำ ความหมาย และคำใบ้ของบัตรนี้จะถูกลบถาวร', confirmLabel: 'ลบ', danger: true, onConfirm: () => void removeCard(card) })
  }

  async function removeCard(card: Card) {
    try { await api.delete(card.id); updateCards(previous => previous.filter(item => item.id !== card.id)); setError('') }
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
    setSelectedIds(previous => {
      const next = new Set(previous)
      for (const card of shownCards) {
        if (allShownSelected) next.delete(card.id)
        else next.add(card.id)
      }
      return next
    })
  }

  function removeSelected() {
    const ids = selectedVisibleIds
    if (!ids.length) return
    setConfirmRequest({ title: `ลบคำศัพท์ที่เลือก ${ids.length} คำใช่ไหม?`, description: 'บัตรคำที่เลือกทั้งหมดจะถูกลบถาวร', confirmLabel: 'ลบ', danger: true, onConfirm: () => void removeCards(ids) })
  }

  async function removeCards(ids: number[]) {
    setDeletingSelected(true)
    const results = await Promise.allSettled(ids.map(id => api.delete(id)))
    const deleted = new Set(ids.filter((_, index) => results[index].status === 'fulfilled'))
    updateCards(previous => previous.filter(card => !deleted.has(card.id)))
    setSelectedIds(previous => new Set([...previous].filter(id => !deleted.has(id))))
    const failures = ids.length - deleted.size
    setError(failures ? `ลบไม่สำเร็จ ${failures} คำ กรุณาลองอีกครั้ง` : '')
    setDeletingSelected(false)
  }

  async function importFile(file: File) {
    if (importing.current) return
    importing.current = true
    setImportResult(null)
    setError('')
    setImportState({ fileName: file.name, progress: { phase: 'uploading', percent: 0 } })
    try {
      const result = await api.import(file, progress => setImportState({ fileName: file.name, progress }))
      setImportResult(result)
      setImportState({ fileName: file.name, progress: { phase: 'refreshing', percent: 100 } })
      try {
        const updated = await api.list()
        updateCards(updated)
      } catch {
        setError('นำเข้าแล้ว แต่โหลดรายการคำศัพท์ล่าสุดไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'นำเข้าไม่สำเร็จ')
    } finally {
      importing.current = false
      setImportState(null)
    }
  }

  const navItems = [['library', 'คลังคำศัพท์', BookOpen], ['study', 'อ่านบัตรคำ', Layers3], ['challenge', 'Challenge', Target]] as const
  const showLanguage = view === 'study' || challengeMode === 'meaning'
  const showProgress = view === 'study' || challengeStarted

  return <div className="min-h-screen bg-[#f4f8f7] text-slate-700">
    <div className="flex min-h-screen w-full">
      <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200/80 bg-white px-4 py-7 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:self-start xl:w-64 xl:px-5">
        <div className="flex items-center gap-3 px-2"><img src="/wordly-mark.svg" alt="" className="h-10 w-10 shrink-0 rounded-2xl shadow-md shadow-teal-100" /><div><div className="text-xl font-bold tracking-tight text-slate-900">wordly<span className="text-teal-700">.</span></div><div className="-mt-1 text-[11px] font-semibold uppercase tracking-[.16em] text-slate-500">flash cards</div></div></div>
        <div className="mt-10 px-3 text-xs font-semibold text-slate-500">เมนูหลัก</div>
        <nav className="mt-3 space-y-1" aria-label="เมนูหลัก">
          {navItems.map(([key, label, Icon]) => <button key={key} aria-current={view === key ? 'page' : undefined} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${view === key ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-50'}`} onClick={() => goTo(key)}><Icon size={18} />{label}</button>)}
        </nav>
        <div className="mt-8 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3"><div className="flex items-center gap-2 text-sm font-semibold text-amber-800"><Star size={16} fill="currentColor" />ต้องทบทวน</div><p className="mt-1 text-2xl font-bold text-slate-900">{reviewCount}<span className="ml-1.5 text-sm font-medium text-slate-500">จาก {cards.length} คำ</span></p></div>
        <div className="mt-auto rounded-2xl bg-gradient-to-br from-teal-700 to-cyan-700 p-5 text-white"><Sparkles size={20} /><p className="mt-3 text-sm font-bold">เก่งขึ้นทีละคำ</p><p className="mt-1 text-xs leading-5 text-teal-50">เปิดบัตร ฝึกจำ แล้วเก็บคำที่อยากทบทวนไว้ในที่เดียว</p></div>
      </aside>

      <main className="min-h-screen min-w-0 flex-1">
        <div className="sticky top-0 z-30 lg:static">
          <header className="flex h-16 items-center justify-between border-b border-slate-200/80 bg-white px-4 sm:px-6 lg:h-20 lg:px-10"><div className="flex min-w-0 items-center gap-3"><img src="/wordly-mark.svg" alt="" className="h-9 w-9 shrink-0 lg:hidden" /><div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">My Flash Cards</p><h1 className="truncate text-lg font-bold text-slate-900">{view === 'library' ? 'คลังคำศัพท์ของฉัน' : view === 'study' ? 'ฝึกจำคำศัพท์' : 'Challenge'}</h1></div></div><Button onClick={openNew} size="sm" className="h-9 shrink-0"><Plus size={16} /> <span className="hidden sm:inline">เพิ่มคำศัพท์</span><span className="sm:hidden">เพิ่ม</span></Button></header>
          <nav aria-label="เมนูหลัก" className="grid grid-cols-3 gap-1 border-b border-slate-200 bg-white px-2 py-1.5 lg:hidden">{navItems.map(([key, label, Icon]) => <button key={key} onClick={() => goTo(key)} aria-current={view === key ? 'page' : undefined} className={`flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold ${view === key ? 'bg-teal-50 text-teal-800' : 'text-slate-600'}`}><Icon size={16} className="shrink-0" />{label}</button>)}</nav>
        </div>
        <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8">
          {error && <div role="alert" className="mb-6 flex items-start justify-between gap-3 rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700"><span>{error}</span><button aria-label="ปิดข้อความผิดพลาด" onClick={() => setError('')}><X size={18} /></button></div>}
          {loading ? <p role="status" className="py-20 text-center text-slate-500">กำลังโหลดคำศัพท์...</p> : view === 'library' ? <>
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6"><div><h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">คำศัพท์ทั้งหมด</h2><p className="mt-1 text-sm text-slate-500">เก็บทุกคำใหม่ไว้ที่นี่ แล้วกลับมาทบทวนได้เสมอ</p></div><div><input ref={fileRef} type="file" accept=".csv,text/csv" disabled={importState !== null} className="hidden" aria-label="เลือกไฟล์ CSV" onChange={event => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = '' }} /><Button variant="secondary" disabled={importState !== null} onClick={() => fileRef.current?.click()}><FileUp size={17} /> นำเข้า CSV</Button></div></div>
            {importState && <ImportProgressNotice fileName={importState.fileName} progress={importState.progress} />}
            {importResult && <ImportNotice result={importResult} onClose={() => setImportResult(null)} />}
            <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4">
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center gap-2 sm:gap-3"><div className="hidden rounded-xl bg-teal-50 p-2.5 text-teal-700 sm:block"><BookOpen size={18} /></div><span className="text-sm font-medium text-slate-600">คำศัพท์ทั้งหมด</span></div><p className="mt-2 text-2xl font-bold text-slate-900 sm:mt-3 sm:text-3xl">{cards.length}<span className="ml-1.5 text-sm font-medium text-slate-500">คำ</span></p></div>
              <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5"><div className="flex items-center gap-2 sm:gap-3"><div className="hidden rounded-xl bg-amber-50 p-2.5 text-amber-600 sm:block"><Star size={18} /></div><span className="text-sm font-medium text-slate-600">ต้องทบทวน</span></div><p className="mt-2 text-2xl font-bold text-slate-900 sm:mt-3 sm:text-3xl">{reviewCount}<span className="ml-1.5 text-sm font-medium text-slate-500">คำ</span></p></div>
            </div>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div className="hidden sm:block"><h3 className="text-base font-bold text-slate-900">รายการคำศัพท์</h3><p className="text-xs text-slate-500">เลือกอักษรแรก ชนิดของคำ หรือค้นหาคำที่ต้องการ</p></div>
              <div className="flex w-full flex-wrap items-center gap-2 xl:w-auto">
                <div role="search" className="relative w-full sm:w-auto sm:min-w-64 sm:flex-1 xl:w-72 xl:flex-none">
                  <Search size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input aria-label="ค้นหาคำศัพท์" placeholder="ค้นหาคำศัพท์หรือความหมาย" value={search} onChange={event => { setSearch(event.target.value); resetLibraryList() }} className="pl-10 pr-10" />
                  {search && <button type="button" aria-label="ล้างคำค้น" onClick={() => { setSearch(''); resetLibraryList() }} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"><X size={16} /></button>}
                </div>
                <div className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold text-slate-600"><label htmlFor="part-filter" className="sr-only sm:not-sr-only">ชนิดของคำ</label><Select id="part-filter" label="กรองชนิดของคำ" value={partFilter} onValueChange={value => { setPartFilter(value); resetLibraryList() }} options={[{ value: 'ALL', label: 'ทุกชนิด' }, ...partOptions.map(part => ({ value: part, label: part }))]} className="w-36" /></div>
                <button aria-pressed={reviewOnly} onClick={() => changeReviewOnly(!reviewOnly)} className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${reviewOnly ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 bg-white text-slate-600 hover:border-amber-200'}`}><Star size={15} fill={reviewOnly ? 'currentColor' : 'none'} /> เฉพาะคำที่ต้องทบทวน</button>
              </div>
            </div>
            <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0" role="group" aria-label="กรองตามอักษรแรก"><button aria-pressed={letter === 'ALL'} onClick={() => changeLetter('ALL')} className={`h-9 shrink-0 rounded-lg px-3 text-xs font-bold sm:h-8 ${letter === 'ALL' ? 'bg-teal-700 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-teal-300'}`}>ทั้งหมด</button>{alphabet.map(item => <button key={item} aria-pressed={letter === item} onClick={() => changeLetter(item)} className={`h-9 min-w-9 shrink-0 rounded-lg px-1 text-xs font-bold sm:h-8 sm:min-w-8 ${letter === item ? 'bg-teal-700 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-teal-300'}`}>{item}</button>)}</div>
            {libraryCards.length > 0 && <div className="mb-3 flex min-h-8 flex-wrap items-center gap-x-3 gap-y-2"><label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-slate-600"><input type="checkbox" checked={allShownSelected} onChange={toggleAllVisible} className="h-4 w-4 accent-teal-700" />เลือกทั้งหมดที่แสดง</label>{selectedVisibleIds.length > 0 ? <><span className="text-sm text-slate-600">เลือก {selectedVisibleIds.length} คำ</span><Button variant="danger" size="sm" disabled={deletingSelected} onClick={removeSelected}><Trash2 size={15} /> {deletingSelected ? 'กำลังลบ...' : 'ลบที่เลือก'}</Button><Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>ยกเลิกการเลือก</Button></> : <span className="ml-auto text-sm text-slate-500">พบ {libraryCards.length} คำ</span>}</div>}
            {libraryCards.length === 0 ? <Empty icon={<BookOpen size={28} />} title={cards.length === 0 ? 'ยังไม่มีคำศัพท์' : search.trim() ? 'ไม่พบคำที่ค้นหา' : 'ไม่พบคำศัพท์ในหมวดนี้'} description={cards.length === 0 ? 'เริ่มสะสมคำศัพท์คำแรก หรือจะนำเข้าจากไฟล์ CSV ก็ได้' : search.trim() ? 'ลองเปลี่ยนคำค้นหรือปิดตัวกรองอื่น' : 'ลองเปลี่ยนตัวกรองอักษร ชนิดของคำ หรือคำที่ต้องทบทวน'} action={cards.length === 0 ? <Button onClick={openNew}><Plus size={16} /> เพิ่มคำแรก</Button> : undefined} /> : <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
              <div className="hidden grid-cols-[20px_1.2fr_1fr_1.5fr_120px] gap-4 border-b border-slate-100 bg-slate-50/70 px-6 py-3 text-xs font-bold text-slate-500 md:grid"><span /><span>คำศัพท์</span><span>ชนิดของคำ</span><span>ความหมาย</span><span className="text-right">จัดการ</span></div>
              <div className="divide-y divide-slate-100">{shownCards.map(card => <div key={card.id} className={`grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3 md:grid-cols-[20px_1.2fr_1fr_1.5fr_120px] md:gap-4 md:px-6 md:py-4 ${selectedIds.has(card.id) ? 'bg-teal-50/40' : ''}`}>
                <input type="checkbox" aria-label={`เลือก ${card.word}`} checked={selectedIds.has(card.id)} onChange={() => toggleSelected(card.id)} className="h-4 w-4 accent-teal-700" />
                <div className="flex min-w-0 items-center gap-3"><span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-base font-bold text-teal-700 md:flex">{card.word[0]?.toUpperCase()}</span><span className="truncate font-bold text-slate-900">{card.word}</span></div>
                <div className="col-span-2 col-start-2 md:col-auto"><PartBadges parts={card.partsOfSpeech} className="justify-start" /></div>
                <p className="col-span-2 col-start-2 line-clamp-2 min-w-0 text-sm text-slate-600 md:col-auto md:line-clamp-1">{card.meaning}</p>
                <div className="col-start-3 row-start-1 flex justify-end gap-0.5 md:col-auto md:row-auto md:gap-1"><Button variant="ghost" size="icon" aria-label={card.needsReview ? `ยกเลิกทบทวน ${card.word}` : `เก็บไว้ทบทวน ${card.word}`} title={card.needsReview ? 'ยกเลิกทบทวน' : 'เก็บไว้ทบทวน'} onClick={() => void toggleReview(card)} disabled={reviewSaving.has(card.id)} className={card.needsReview ? 'text-amber-500' : ''}><Star size={17} fill={card.needsReview ? 'currentColor' : 'none'} /></Button><Button variant="ghost" size="icon" aria-label={`แก้ไข ${card.word}`} title="แก้ไข" onClick={() => openEdit(card)}><Pencil size={16} /></Button><Button variant="danger" size="icon" aria-label={`ลบ ${card.word}`} title="ลบ" onClick={() => remove(card)}><Trash2 size={16} /></Button></div>
              </div>)}</div>
              {libraryCards.length > shownCards.length && <div className="flex flex-col items-center gap-2 border-t border-slate-100 px-4 py-4 sm:flex-row sm:justify-between sm:px-6"><span className="text-sm text-slate-500">แสดง {shownCards.length} จาก {libraryCards.length} คำ</span><Button variant="secondary" size="sm" onClick={() => setVisibleCount(value => value + pageSize)}>แสดงเพิ่มอีก {Math.min(pageSize, libraryCards.length - shownCards.length)} คำ</Button></div>}
            </div>}
          </> : <div className="mx-auto max-w-3xl">
            {(view !== 'challenge' || !challengeStarted) && <div className="mb-5"><h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{view === 'challenge' ? 'ท้าทายความจำ' : 'ฝึกจำทีละใบ'}</h2><p className="mt-1 text-sm text-slate-500">{view === 'challenge' ? 'ฝึกพิมพ์คำศัพท์ ฟังเสียง หรือทบทวนความหมายทีละคำ' : 'พลิกบัตรเพื่อเฉลย และเก็บคำที่ยังจำไม่ได้ไว้ทบทวน'}</p></div>}
            {view === 'challenge' && <div className="mb-3 grid grid-cols-3 gap-2" role="group" aria-label="รูปแบบ Challenge">{([['copy', 'เห็นคำแล้วพิมพ์'], ['listen', 'ฟังแล้วพิมพ์'], ['meaning', 'ทบทวนความหมาย']] as const).map(([mode, label]) => <button key={mode} type="button" aria-pressed={challengeMode === mode} onClick={() => changeChallengeMode(mode)} className={`whitespace-nowrap rounded-xl border px-1 py-2 text-[12px] font-semibold sm:px-2 sm:text-sm ${challengeMode === mode ? 'border-teal-300 bg-teal-50 text-teal-800' : 'border-slate-200 bg-white text-slate-600 hover:border-teal-200'}`}>{label}</button>)}</div>}
            <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm sm:gap-3 sm:p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-600"><label htmlFor="letter-filter">หมวดอักษร</label><Select id="letter-filter" label="หมวดอักษร" value={letter} onValueChange={changeLetter} options={[{ value: 'ALL', label: 'ทั้งหมด' }, ...alphabet.map(item => ({ value: item, label: item }))]} className="w-28" /></div>
              <button aria-pressed={reviewOnly} onClick={() => changeReviewOnly(!reviewOnly)} className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${reviewOnly ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-slate-200 text-slate-600'}`}><Star size={16} fill={reviewOnly ? 'currentColor' : 'none'} /> ต้องทบทวน</button>
              <button aria-pressed={shuffled} onClick={toggleShuffle} className={`flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold ${shuffled ? 'border-teal-200 bg-teal-50 text-teal-800' : 'border-slate-200 text-slate-600'}`}><Shuffle size={16} /> สุ่มคำ {shuffled ? 'เปิด' : 'ปิด'}</button>
              {shuffled && <Button variant="ghost" size="sm" onClick={reshuffle}><RotateCcw size={15} /> สุ่มใหม่</Button>}
              {showLanguage && <div className="sm:ml-auto"><LanguageToggle label={view === 'study' ? 'ด้านหน้า' : 'คำถาม'} value={firstLanguage} onChange={changeFirstLanguage} /></div>}
            </div>
            {showProgress && <><div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-600"><span>{view === 'challenge' ? 'คำที่' : 'บัตรที่'} {progressPosition} จาก {progressTotal}</span><span>{letter === 'ALL' ? 'ทุกหมวด' : `หมวด ${letter}`}{reviewOnly ? ' · ต้องทบทวน' : ''}</span></div><div className="mb-4 h-1.5 overflow-hidden rounded-full bg-slate-200"><div className="h-full rounded-full bg-teal-700 transition-all" style={{ width: `${progressPercent}%` }} /></div></>}
            {view === 'challenge' ? (
              challengeIds.length === 0 ? <Empty icon={<Target size={28} />} title="ยังไม่มีคำสำหรับ Challenge" description="ลองเปลี่ยนหมวดอักษรหรือปิดตัวกรองคำที่ต้องทบทวน" action={<Button variant="secondary" onClick={() => goTo('library')}>ไปคลังคำศัพท์</Button>} /> :
              challengeDone ? <div className="rounded-2xl border border-teal-100 bg-white px-6 py-12 text-center shadow-sm"><div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-700"><Target size={28} /></div><h3 className="mt-5 text-2xl font-bold text-slate-900">จบรอบ Challenge</h3><p className="mt-2 text-sm text-slate-600">จำได้ {rememberedCount} คำ · ยังจำไม่ได้ {missedCount} คำ</p><Button className="mt-6" onClick={() => startChallengeSession()}><RotateCcw size={17} /> เริ่มรอบใหม่</Button></div> :
              !challengeStarted ? <div className="flex min-h-64 flex-col items-center justify-center rounded-[28px] border border-teal-100 bg-gradient-to-br from-white to-teal-50 px-6 py-10 text-center shadow-sm"><div className="rounded-2xl bg-teal-100 p-4 text-teal-700"><Target size={28} /></div><h3 className="mt-5 text-xl font-bold text-slate-900">พร้อมฝึก {challengeIds.length} คำ</h3><p className="mt-2 text-sm text-slate-600">{letter === 'ALL' ? 'ทุกหมวด' : `หมวด ${letter}`}{reviewOnly ? ' · เฉพาะคำที่ต้องทบทวน' : ''} · {challengeMode === 'meaning' ? 'กดเริ่มเมื่อพร้อมทบทวนความหมาย' : 'เสียงคำศัพท์จะเล่นหลังจากกดเริ่ม'}</p><Button className="mt-6" onClick={() => setChallengeStarted(true)}>เริ่ม Challenge <ArrowRight size={17} /></Button></div> :
              challengeCard ? <ChallengePanel key={challengeRun + '-' + challengeCard.id + '-' + firstLanguage + '-' + challengeMode} card={challengeCard} mode={challengeMode} firstLanguage={firstLanguage} soundEffects={soundEffects} onToggleSoundEffects={() => setSoundEffects(value => !value)} onAssess={assessChallenge} /> :
              <Empty icon={<Target size={28} />} title="ไม่พบคำศัพท์" description="กลับไปคลังคำศัพท์แล้วเริ่มรอบใหม่" action={<Button onClick={() => startChallengeSession()}>เริ่มรอบใหม่</Button>} />
            ) : current ? <><div className="study-card h-[280px] cursor-pointer select-none sm:h-[320px]" onClick={() => { setFlipped(value => !value); setHintVisible(false) }} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setFlipped(value => !value); setHintVisible(false) } }} role="button" tabIndex={0} aria-label="พลิกบัตร" aria-pressed={flipped}><div className="study-card-inner" style={{ transform: flipped ? 'rotateY(180deg)' : undefined }}><div className="study-face flex flex-col items-center justify-center rounded-[28px] border border-teal-100 bg-gradient-to-br from-white via-white to-teal-50 p-6 text-center shadow-[0_16px_50px_-20px_rgba(15,118,110,.18)] sm:p-8"><span className="absolute left-5 top-5 rounded-full bg-teal-50 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-teal-700 sm:left-7 sm:top-7">{firstLanguage === 'ENG' ? 'ENGLISH' : 'ความหมาย'}</span><span className="absolute right-5 top-5 text-xs font-medium text-slate-500 sm:right-7 sm:top-7">ด้านหน้า</span><span data-testid="front-value" className="max-w-full break-words text-3xl font-bold leading-tight text-slate-900 sm:text-5xl">{firstLanguage === 'ENG' ? current.word : current.meaning}</span>{firstLanguage === 'ENG' && <PartBadges parts={current.partsOfSpeech} className="mt-4" />}{hintVisible && current.hint && <span role="status" className="mt-5 max-h-28 max-w-[90%] overflow-y-auto rounded-xl bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800"><Lightbulb size={16} className="mr-1 inline-block" />{current.hint}</span>}<span className="absolute bottom-6 text-xs font-medium text-slate-500 sm:bottom-8">แตะหรือคลิกเพื่อดูเฉลย</span></div><div className="study-face back flex flex-col items-center justify-center rounded-[28px] border border-teal-200 bg-teal-700 p-6 text-center text-white shadow-[0_16px_50px_-20px_rgba(15,118,110,.28)] sm:p-8"><span className="absolute left-5 top-5 rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider sm:left-7 sm:top-7">{firstLanguage === 'ENG' ? 'ความหมาย' : 'ENGLISH'}</span><span className="absolute right-5 top-5 text-xs text-teal-50 sm:right-7 sm:top-7">ด้านหลัง</span><span data-testid="back-value" className="max-w-full break-words text-3xl font-bold leading-tight sm:text-5xl">{firstLanguage === 'ENG' ? current.meaning : current.word}</span>{firstLanguage === 'THAI' && <PartBadges parts={current.partsOfSpeech} className="mt-4" />}<span className="absolute bottom-6 text-xs text-teal-50 sm:bottom-8">แตะหรือคลิกเพื่อกลับไปด้านหน้า</span></div></div></div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2">{current.hint && !flipped && <Button variant="secondary" onClick={() => setHintVisible(value => !value)}><Lightbulb size={17} /> {hintVisible ? 'ซ่อนคำใบ้' : 'ดูคำใบ้'}</Button>}<Button variant="secondary" onClick={() => void toggleReview(current)} disabled={reviewSaving.has(current.id)} className={current.needsReview ? 'border-amber-200 bg-amber-50 text-amber-700' : ''}><Star size={17} fill={current.needsReview ? 'currentColor' : 'none'} /> {current.needsReview ? 'อยู่ในคำที่ต้องทบทวน' : 'จำไม่ได้ เก็บไว้ทบทวน'}</Button>{'speechSynthesis' in window && <Button variant="secondary" onClick={() => speak(current.word)} aria-label={`ออกเสียง ${current.word}`} title="ออกเสียง"><Volume2 size={17} /><span className="hidden sm:inline">ออกเสียง</span></Button>}</div><div className="flex w-full gap-2 sm:w-auto"><Button variant="secondary" size="icon" className="h-10 w-10 shrink-0" onClick={() => navigate(currentIndex - 1)} disabled={currentIndex === 0} aria-label="บัตรก่อนหน้า" title="บัตรก่อนหน้า (←)"><ArrowLeft size={18} /></Button>{currentIndex + 1 === deck.length ? <Button className="flex-1 sm:flex-none" onClick={restartStudy}><RotateCcw size={17} /> เริ่มรอบใหม่</Button> : <Button className="flex-1 sm:flex-none" onClick={() => navigate(currentIndex + 1)} title="บัตรถัดไป (→)">บัตรถัดไป <ArrowRight size={17} /></Button>}</div></div>
              <p className="mt-5 hidden text-center text-xs text-slate-500 lg:block">ปุ่มลัด: <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-sans">Space</kbd> พลิกบัตร · <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-sans">←</kbd> <kbd className="rounded border border-slate-300 bg-white px-1.5 py-0.5 font-sans">→</kbd> เปลี่ยนบัตร</p>
            </> : <Empty icon={<Layers3 size={28} />} title="ยังไม่มีบัตรในหมวดนี้" description="ลองเปลี่ยนหมวดอักษรหรือปิดตัวกรองคำที่ต้องทบทวน" action={<Button variant="secondary" onClick={() => goTo('library')}>ไปคลังคำศัพท์</Button>} />}
          </div>}
        </div>
      </main>
    </div>
    <Dialog open={editorOpen} onOpenChange={setEditorOpen}><DialogContent><CardEditor key={editing?.id ?? 'new'} card={editing} onCancel={() => setEditorOpen(false)} onSave={save} /></DialogContent></Dialog>
    <ConfirmDialog request={confirmRequest} onClose={() => setConfirmRequest(null)} />
  </div>
}

function sortCards(a: Card, b: Card) { return a.word.localeCompare(b.word, 'en', { sensitivity: 'base' }) }

function seeded(value: number) {
  let state = value || 1
  return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296 }
}
