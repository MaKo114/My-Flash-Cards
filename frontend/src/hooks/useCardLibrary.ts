import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react'
import { api, UnauthorizedError } from '@/lib/api'
import { readCachedCards, writeCachedCards } from '@/lib/card-cache'
import { cardsToCsv, localDay, scheduleAnswer, type Card, type CardFields, type ImportProgress, type ImportResult, type StudyDay } from '@/lib/cards'

const undoSeconds = 6

function sortCards(a: Card, b: Card) {
  return a.word.localeCompare(b.word, 'en', { sensitivity: 'base' })
}

const wait = (ms: number) => new Promise(resolve => window.setTimeout(resolve, ms))

// Adds one answer to today's entry of the study history.
function countAnswer(days: StudyDay[], today: string, correct: boolean) {
  const day = days.find(item => item.date === today) ?? { date: today, answers: 0, correct: 0 }
  const updated = { ...day, answers: day.answers + 1, correct: day.correct + (correct ? 1 : 0) }
  return [updated, ...days.filter(item => item.date !== today)]
}

// Everything about the word list: loading (with the cached copy shown first), saving,
// stars, challenge answers, delete with undo, CSV import/export and the study history.
export function useCardLibrary({ generation, locked }: { generation: number; locked: boolean }) {
  const [initialCards] = useState(readCachedCards)
  const [cards, setCards] = useState<Card[]>(() => initialCards ?? [])
  const [loading, setLoading] = useState(initialCards === null)
  const [hasSnapshot, setHasSnapshot] = useState(initialCards !== null)
  const [error, setError] = useState('')
  const [studyDays, setStudyDays] = useState<StudyDay[]>([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState('')
  const [reviewSaving, setReviewSaving] = useState<Set<number>>(() => new Set())
  const [pendingDelete, setPendingDelete] = useState<{ cards: Card[]; label: string } | null>(null)
  const [importState, setImportState] = useState<{ fileName: string; progress: ImportProgress } | null>(null)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  // Set when the user changes cards before the first list request returns, so it does not overwrite them.
  const changedSinceFetch = useRef(false)
  const reviewInFlight = useRef(new Set<number>())
  const pendingDeleteRef = useRef<Card[] | null>(null)
  const deleteTimer = useRef<number | undefined>(undefined)
  const importing = useRef(false)
  // Answers for the same card are sent one after another, because the server schedules from the previous answer.
  const answerQueues = useRef(new Map<number, Promise<void>>())

  const updateCards = useCallback((value: SetStateAction<Card[]>) => {
    changedSinceFetch.current = true
    setCards(value)
  }, [])

  const replaceCard = useCallback((card: Card) => {
    updateCards(previous => previous.map(item => item.id === card.id ? card : item))
  }, [updateCards])

  const loadStudyDays = useCallback(() => {
    setStatsLoading(true)
    api.studyDays()
      .then(days => { setStudyDays(days); setStatsError('') })
      .catch(cause => { if (!(cause instanceof UnauthorizedError)) setStatsError(cause instanceof Error ? cause.message : 'โหลดสถิติไม่สำเร็จ') })
      .finally(() => setStatsLoading(false))
  }, [])

  // Load the list and the study history when the app opens and after each sign-in.
  useEffect(() => {
    if (locked) return
    let active = true
    changedSinceFetch.current = false
    api.list()
      .then(value => {
        if (!active) return
        if (!changedSinceFetch.current) setCards(value)
        setHasSnapshot(true)
      })
      .catch(cause => { if (active && !(cause instanceof UnauthorizedError)) setError(cause.message) })
      .finally(() => { if (active) setLoading(false) })
    loadStudyDays()
    return () => { active = false }
  }, [generation, locked, loadStudyDays])

  // Signing out forgets everything shown on screen.
  useEffect(() => {
    if (!locked) return
    pendingDeleteRef.current = null
    window.clearTimeout(deleteTimer.current)
    setPendingDelete(null)
    setCards([])
    setStudyDays([])
    setHasSnapshot(false)
    setLoading(true)
    setError('')
  }, [locked])

  useEffect(() => {
    if (hasSnapshot && !locked) writeCachedCards(cards)
  }, [cards, hasSnapshot, locked])

  async function saveCard(editing: Card | null, fields: CardFields) {
    const saved = editing ? await api.update(editing.id, fields) : await api.create(fields)
    updateCards(previous => (editing ? previous.map(card => card.id === saved.id ? saved : card) : [...previous, saved]).sort(sortCards))
    setError('')
  }

  // Flip the star right away and roll back if the server refuses.
  async function toggleReview(card: Card) {
    if (reviewInFlight.current.has(card.id)) return
    reviewInFlight.current.add(card.id)
    setReviewSaving(previous => new Set(previous).add(card.id))
    const setStar = (needsReview: boolean) =>
      updateCards(previous => previous.map(item => item.id === card.id ? { ...item, needsReview } : item))
    setStar(!card.needsReview)
    try {
      const saved = await api.review(card.id, !card.needsReview)
      setStar(saved.needsReview)
    } catch (cause) {
      setStar(card.needsReview)
      if (!(cause instanceof UnauthorizedError)) setError(cause instanceof Error ? cause.message : 'บันทึกไม่สำเร็จ')
    } finally {
      reviewInFlight.current.delete(card.id)
      setReviewSaving(previous => { const next = new Set(previous); next.delete(card.id); return next })
    }
  }

  // The challenge moves on immediately: the predicted schedule shows now, the server copy replaces it
  // when it arrives, and failed saves are retried a couple of times before reporting an error.
  function recordAnswer(card: Card, correct: boolean) {
    const today = localDay()
    replaceCard(scheduleAnswer(card, correct, today))
    setStudyDays(previous => countAnswer(previous, today, correct))

    async function send() {
      for (let attempt = 1; ; attempt++) {
        try {
          replaceCard(await api.answer(card.id, correct, today))
          return
        } catch (cause) {
          if (cause instanceof UnauthorizedError) return
          if (attempt === 3) {
            setError(`บันทึกคำตอบของ “${card.word}” ไม่สำเร็จ กรุณาตรวจการเชื่อมต่อแล้วลองอีกครั้ง`)
            return
          }
          await wait(attempt * 1500)
        }
      }
    }
    const previous = answerQueues.current.get(card.id) ?? Promise.resolve()
    const next = previous.then(send)
    answerQueues.current.set(card.id, next)
  }

  async function commitDelete() {
    const removed = pendingDeleteRef.current
    if (!removed) return
    pendingDeleteRef.current = null
    window.clearTimeout(deleteTimer.current)
    setPendingDelete(null)
    const results = await Promise.allSettled(removed.map(card => api.delete(card.id)))
    const failed = removed.filter((_, index) => results[index].status === 'rejected')
    if (failed.length) {
      updateCards(previous => [...previous, ...failed].sort(sortCards))
      setError(`ลบไม่สำเร็จ ${failed.length} คำ จึงนำกลับมาไว้ในคลัง กรุณาลองอีกครั้ง`)
    }
  }

  // Hide the cards now and delete them on the server a few seconds later unless the user undoes it.
  function scheduleDelete(removed: Card[], label: string) {
    void commitDelete()
    const ids = new Set(removed.map(card => card.id))
    updateCards(previous => previous.filter(card => !ids.has(card.id)))
    setError('')
    pendingDeleteRef.current = removed
    setPendingDelete({ cards: removed, label })
    deleteTimer.current = window.setTimeout(() => void commitDelete(), undoSeconds * 1000)
  }

  function undoDelete() {
    const removed = pendingDeleteRef.current
    if (!removed) return
    pendingDeleteRef.current = null
    window.clearTimeout(deleteTimer.current)
    setPendingDelete(null)
    updateCards(previous => [...previous, ...removed].sort(sortCards))
  }

  // Deletes still waiting for undo are sent when the page closes.
  useEffect(() => {
    function flush() {
      for (const card of pendingDeleteRef.current ?? []) api.deleteOnExit(card.id)
      pendingDeleteRef.current = null
    }
    window.addEventListener('pagehide', flush)
    return () => window.removeEventListener('pagehide', flush)
  }, [])

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
        updateCards(await api.list())
      } catch {
        setError('นำเข้าแล้ว แต่โหลดรายการคำศัพท์ล่าสุดไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ')
      }
    } catch (cause) {
      if (!(cause instanceof UnauthorizedError)) setError(cause instanceof Error ? cause.message : 'นำเข้าไม่สำเร็จ')
    } finally {
      importing.current = false
      setImportState(null)
    }
  }

  function exportCsv() {
    const url = URL.createObjectURL(new Blob([cardsToCsv(cards)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `my-flash-cards-${localDay()}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  return {
    cards, loading, error, setError,
    studyDays, statsLoading, statsError, loadStudyDays,
    reviewSaving, saveCard, toggleReview, recordAnswer,
    pendingDelete, scheduleDelete, undoDelete, flushDeletes: commitDelete,
    importState, importResult, clearImportResult: () => setImportResult(null), importFile, exportCsv,
  }
}

export type CardLibrary = ReturnType<typeof useCardLibrary>
