import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowRight, Check, Lightbulb, Pencil, Star, Volume2, VolumeX, X } from 'lucide-react'
import { PartBadges } from '@/components/PartBadges'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { playAnswerSound } from '@/lib/answer-sound'
import { buildChoices, fitTextClass, isTypingMatch, typingFeedback, type Card } from '@/lib/cards'
import type { ChallengeMode, Language } from '@/lib/settings'
import { speak, speechSupported, stopSpeaking } from '@/lib/speech'

// How long the right/wrong feedback stays before the next word, in milliseconds.
// Saving happens in the background, so this is the whole wait.
const feedbackDelay = { typing: 300, choice: 450 }

const choiceStyles = {
  idle: ['border-slate-200 bg-surface text-slate-800 hover:border-teal-300 hover:bg-teal-50/60', 'bg-slate-100 text-slate-600'],
  correct: ['border-emerald-500 bg-emerald-50 text-emerald-900', 'bg-emerald-600 text-white'],
  wrong: ['border-rose-400 bg-rose-50 text-rose-900', 'bg-rose-600 text-white'],
  other: ['border-slate-200 bg-surface text-slate-400', 'bg-slate-100 text-slate-400'],
} as const

type ChoiceState = keyof typeof choiceStyles

// The colored letters while typing: green when right, red when wrong.
function TypedLetters({ letters }: { letters: { character: string; correct: boolean }[] }) {
  return letters.map((letter, index) => (
    <span key={index} data-state={letter.correct ? 'correct' : 'wrong'} className={letter.correct ? 'text-emerald-600' : 'text-red-600'}>
      {letter.character === ' ' ? ' ' : letter.character}
    </span>
  ))
}

// One question of a Challenge round, in any of the four modes. The parent gives it a new `key`
// for every word, so all of this state starts fresh each time.
export function ChallengePanel({ card, pool, mode, firstLanguage, soundEffects, onToggleSoundEffects, onAssess, onEdit }: {
  card: Card
  pool: Card[]
  mode: ChallengeMode
  firstLanguage: Language
  soundEffects: boolean
  onToggleSoundEffects: () => void
  onAssess: (remembered: boolean) => void
  onEdit: () => void
}) {
  const [answer, setAnswer] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [hintVisible, setHintVisible] = useState(false)
  const [assessment, setAssessment] = useState<boolean | null>(null)
  // The options are drawn once per question.
  const [choices] = useState(() => mode === 'choice' ? buildChoices(card, pool, firstLanguage === 'ENG' ? 'meaning' : 'word') : [])
  const [picked, setPicked] = useState<number | null>(null)
  const assessing = useRef(false)
  const mounted = useRef(true)
  const assessRef = useRef<HTMLDivElement>(null)

  const typing = mode === 'copy' || mode === 'listen'
  const prompt = mode === 'copy' ? card.word : firstLanguage === 'ENG' ? card.word : card.meaning
  const solution = firstLanguage === 'ENG' ? card.meaning : card.word
  const hint = card.hint || (typing ? card.meaning : '')
  const feedback = typing ? typingFeedback(card.word, answer) : []
  const missedChoice = picked !== null && picked !== card.id
  const pending = assessment !== null && !missedChoice

  // Typing modes read the word aloud when the question appears.
  useEffect(() => {
    if (!typing) return
    speak(card.word)
    return stopSpeaking
  }, [card.word, typing])

  useEffect(() => {
    if (mode === 'meaning' && revealed) assessRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [mode, revealed])

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  // Number keys pick an option; Enter moves on after a wrong pick (buttons handle their own Enter).
  useEffect(() => {
    if (mode !== 'choice') return
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, [role="combobox"], [role="listbox"], [role="dialog"]')) return
      const index = Number(event.key) - 1
      if (/^[1-9]$/.test(event.key) && index < choices.length) {
        event.preventDefault()
        pick(choices[index].id)
      } else if (event.key === 'Enter' && missedChoice && !target.closest('button')) {
        event.preventDefault()
        assess(false, 0, false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  function submit(event: FormEvent) {
    event.preventDefault()
    if (mode === 'choice') {
      if (missedChoice) assess(false, 0, false)
    } else if (mode === 'meaning') {
      if (!revealed) setRevealed(true)
      else assess(true)
    } else if (revealed || answer.trim()) {
      assess(revealed ? false : isTypingMatch(card.word, answer))
    }
  }

  function pick(id: number) {
    if (picked !== null || assessing.current) return
    setPicked(id)
    setHintVisible(false)
    if (id === card.id) {
      assess(true, feedbackDelay.choice)
      return
    }
    // A wrong pick waits for the learner to read the right answer before moving on.
    setAssessment(false)
    if (soundEffects) playAnswerSound(false)
  }

  // Shows the result, waits briefly so it can be seen, then hands it to the round.
  async function assess(remembered: boolean, delay = feedbackDelay.typing, sound = true) {
    if (assessing.current) return
    assessing.current = true
    setAssessment(remembered)
    stopSpeaking()
    if (sound && soundEffects) playAnswerSound(remembered)
    if (delay) await new Promise(resolve => window.setTimeout(resolve, delay))
    if (mounted.current) onAssess(remembered)
  }

  const soundToggle = (
    <button
      type="button"
      aria-pressed={soundEffects}
      aria-label={`เสียงตอบรับ ${soundEffects ? 'เปิด' : 'ปิด'}`}
      onClick={onToggleSoundEffects}
      className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
    >
      {soundEffects ? <Volume2 size={14} /> : <VolumeX size={14} />}
      <span className="hidden sm:inline">เสียงตอบรับ</span> {soundEffects ? 'เปิด' : 'ปิด'}
    </button>
  )

  return (
    <form onSubmit={submit} noValidate className="relative mx-auto w-full max-w-3xl rounded-[28px] border border-teal-100 bg-gradient-to-br from-surface to-teal-50 px-5 py-5 shadow-sm sm:px-8 sm:py-6">
      <Button type="button" variant="ghost" size="icon" onClick={onEdit} aria-label="แก้ไขคำนี้" title="แก้ไขคำนี้" className="absolute right-3 top-3 text-slate-500">
        <Pencil size={16} />
      </Button>

      {/* The question */}
      <div className="flex min-h-32 flex-col items-center justify-center px-2 pb-4 text-center sm:min-h-40">
        <span className="mb-3 rounded-full bg-teal-100 px-3 py-1 text-xs font-bold text-teal-800">
          {mode === 'listen' ? 'ฟังแล้วพิมพ์' : mode === 'copy' ? 'พิมพ์ตามคำศัพท์' : firstLanguage === 'ENG' ? 'ENGLISH' : 'ความหมาย'}
        </span>

        {mode === 'copy' && (
          <p data-testid="challenge-prompt" aria-label={card.word} className={`max-w-full break-words font-bold leading-tight ${fitTextClass(card.word)}`}>
            <span data-testid="typing-feedback" aria-hidden="true">
              {Array.from(card.word).map((character, index) => {
                const state = feedback[index] ? feedback[index].correct ? 'correct' : 'wrong' : 'pending'
                return (
                  <span key={index} data-state={state} className={state === 'correct' ? 'text-emerald-600' : state === 'wrong' ? 'text-red-600' : 'text-slate-900'}>
                    {character === ' ' ? ' ' : character}
                  </span>
                )
              })}
              <TypedLetters letters={feedback.slice(Array.from(card.word).length)} />
            </span>
          </p>
        )}

        {mode === 'listen' && (
          <>
            <p data-testid="challenge-prompt" className="text-lg font-semibold text-slate-700">ฟังเสียงแล้วพิมพ์คำศัพท์</p>
            <div data-testid="typing-feedback" aria-label="อักษรที่พิมพ์" className={`mt-3 min-h-12 max-w-full break-words font-bold leading-tight ${fitTextClass(card.word)}`}>
              <TypedLetters letters={feedback} />
            </div>
            {revealed && <p data-testid="challenge-answer" className="mt-2 text-xl font-bold text-slate-900">{card.word}</p>}
          </>
        )}

        {!typing && (
          <p data-testid="challenge-prompt" lang={firstLanguage === 'ENG' ? 'en' : 'th'} className={`max-w-full break-words font-bold leading-tight text-slate-900 ${fitTextClass(prompt)}`}>
            {prompt}
          </p>
        )}
        {!typing && firstLanguage === 'ENG' && <PartBadges parts={card.partsOfSpeech} className="mt-2" />}

        {assessment !== null && (
          <p data-testid="answer-result" role="status" className={`mt-3 rounded-full px-3 py-1 text-sm font-bold ${assessment ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
            {assessment ? 'ถูกต้อง!' : 'ยังไม่ถูก เก็บไว้ทบทวน'}
          </p>
        )}
        {typing && speechSupported && (
          <Button variant="secondary" size="sm" type="button" onClick={() => speak(card.word)} className="mt-4"><Volume2 size={16} /> ฟังอีกครั้ง</Button>
        )}
        {mode === 'listen' && !speechSupported && (
          <p role="alert" className="mt-3 text-sm text-amber-700">เบราว์เซอร์นี้ไม่รองรับเสียงอ่าน ลองใช้โหมดพิมพ์ตามคำศัพท์</p>
        )}
        {hint && !revealed && picked === null && (
          <div className="mt-3">
            <Button variant="ghost" size="sm" type="button" onClick={() => setHintVisible(value => !value)}>
              <Lightbulb size={16} /> {hintVisible ? 'ซ่อนคำใบ้' : 'ดูคำใบ้'}
            </Button>
            {hintVisible && <p role="status" className="mt-2 rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-800">{hint}</p>}
          </div>
        )}
      </div>

      {/* The answer area */}
      <div className="mx-auto w-full max-w-xl border-t border-teal-100 pt-5">
        {mode === 'choice' ? (
          <>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p id="choice-label" className="text-sm font-semibold text-slate-700">{firstLanguage === 'ENG' ? 'เลือกความหมายที่ถูกต้อง' : 'เลือกคำศัพท์ที่ถูกต้อง'}</p>
              {soundToggle}
            </div>
            <div role="group" aria-labelledby="choice-label" className="grid gap-2 sm:grid-cols-2">
              {choices.map((choice, index) => {
                const state: ChoiceState = picked === null ? 'idle' : choice.id === card.id ? 'correct' : choice.id === picked ? 'wrong' : 'other'
                return (
                  <button
                    key={choice.id}
                    type="button"
                    data-testid="choice"
                    data-state={state}
                    disabled={picked !== null}
                    onClick={() => pick(choice.id)}
                    className={`flex min-h-14 items-center gap-3 rounded-xl border-2 px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700 ${choiceStyles[state][0]}`}
                  >
                    <span aria-hidden="true" className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${choiceStyles[state][1]}`}>{index + 1}</span>
                    <span lang={firstLanguage === 'ENG' ? 'th' : 'en'} className="min-w-0 flex-1 break-words font-semibold leading-snug">{choice.text}</span>
                    {state === 'correct' && <Check size={18} aria-hidden="true" className="shrink-0" />}
                    {state === 'wrong' && <X size={18} aria-hidden="true" className="shrink-0" />}
                  </button>
                )
              })}
            </div>
            {picked !== null && card.example && <p lang="en" className="mt-3 rounded-xl bg-surface/70 px-4 py-2 text-sm italic text-slate-600">{card.example}</p>}
            {choices.length < 4 && <p className="mt-3 text-xs text-slate-500">มีคำในคลังไม่พอสำหรับ 4 ตัวเลือก เพิ่มคำศัพท์เพื่อให้มีตัวเลือกครบ</p>}
            {missedChoice ? (
              <div className="mt-4 flex flex-wrap items-center justify-end gap-3">
                <p className="mr-auto text-sm text-slate-600">คำตอบที่ถูกคือ <span className="font-bold text-emerald-700">{solution}</span></p>
                <Button type="submit" autoFocus>คำถัดไป <ArrowRight size={16} /></Button>
              </div>
            ) : (
              <p className="mt-3 hidden text-sm text-slate-500 sm:block">คลิกตัวเลือก หรือกดปุ่มตัวเลข 1–{choices.length} บนคีย์บอร์ด</p>
            )}
          </>
        ) : (
          <>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label htmlFor="challenge-answer" className="whitespace-nowrap text-sm font-semibold text-slate-700">{mode === 'meaning' ? 'คำตอบของฉัน' : 'พิมพ์คำศัพท์ภาษาอังกฤษ'}</label>
              {soundToggle}
            </div>
            <Input
              id="challenge-answer"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              value={answer}
              disabled={pending}
              readOnly={revealed}
              aria-invalid={typing && feedback.some(letter => !letter.correct)}
              onChange={event => setAnswer(event.target.value)}
              placeholder={typing || firstLanguage === 'THAI' ? 'พิมพ์คำศัพท์ภาษาอังกฤษ' : 'พิมพ์ความหมายภาษาไทย'}
              required={typing && !revealed}
            />

            {typing && (
              <>
                <p className="mt-3 text-sm text-slate-500">อักษรบนการ์ดจะแสดงสีเขียวเมื่อถูก สีแดงเมื่อผิด · กด Enter เพื่อไปคำถัดไป</p>
                {revealed && <p className="mt-2 text-sm text-amber-700">ดูเฉลยแล้ว คำนี้จะถูกเก็บไว้ทบทวน</p>}
                <div className="mt-4 flex justify-end gap-2">
                  {!revealed && <Button type="button" variant="secondary" onClick={() => setRevealed(true)}>ดูเฉลย</Button>}
                  <Button type="submit" disabled={pending || (!revealed && !answer.trim())}>คำถัดไป <ArrowRight size={16} /></Button>
                </div>
              </>
            )}

            {mode === 'meaning' && !revealed && (
              <div className="mt-4 flex justify-end"><Button type="submit">ดูเฉลย <ArrowRight size={16} /></Button></div>
            )}
            {mode === 'meaning' && revealed && (
              <>
                <div className="mt-3 rounded-xl bg-teal-50 px-4 py-3">
                  <p className="text-xs font-bold text-teal-700">เฉลย</p>
                  <p className="mt-1 text-xl font-bold text-slate-900">{solution}</p>
                  {firstLanguage === 'THAI' && <PartBadges parts={card.partsOfSpeech} className="mt-2" />}
                  {card.example && <p lang="en" className="mt-2 text-sm italic text-slate-600">{card.example}</p>}
                </div>
                <p className="mt-3 text-sm text-slate-500">กด Enter ถ้าจำได้ หรือคลิก ยังจำไม่ได้ เพื่อบันทึกผลและไปคำถัดไป</p>
                <div ref={assessRef} className="mt-3 flex flex-wrap gap-2 scroll-mb-6">
                  <Button type="button" variant="secondary" disabled={pending} onClick={() => assess(false)}><Star size={16} /> ยังจำไม่ได้</Button>
                  <Button type="submit" disabled={pending}><Check size={16} /> จำได้</Button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </form>
  )
}
