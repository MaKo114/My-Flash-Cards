export type Card = {
  id: number
  word: string
  partOfSpeech: string
  meaning: string
  partsOfSpeech: string[]
  meanings: string[]
  hint: string
  example: string
  needsReview: boolean
  // Spaced repetition: correct answers in a row and the local day (YYYY-MM-DD) the card is due; null until first answered.
  srsStep: number
  dueOn: string | null
  correctCount: number
  wrongCount: number
  // The day of the first challenge answer; null while the card is still new.
  firstStudiedOn: string | null
}

export type CardFields = Pick<Card, 'word' | 'partsOfSpeech' | 'meanings' | 'hint' | 'example'>

export type StudyDay = { date: string; answers: number; correct: number }

// Fills fields that older API responses or cached snapshots may not have.
export function normalizeCard(card: Partial<Card> & Pick<Card, 'id' | 'word' | 'partOfSpeech' | 'meaning' | 'partsOfSpeech' | 'meanings' | 'hint' | 'needsReview'>): Card {
  return {
    ...card,
    example: card.example ?? '',
    srsStep: card.srsStep ?? 0,
    dueOn: card.dueOn ?? null,
    correctCount: card.correctCount ?? 0,
    wrongCount: card.wrongCount ?? 0,
    firstStudiedOn: card.firstStudiedOn ?? null,
  }
}

export function localDay(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function isDue(card: Card, today: string) {
  return card.dueOn !== null && card.dueOn <= today
}

// Days to wait after each correct answer in a row; the backend uses the same steps.
export const reviewIntervals = [1, 3, 7, 14, 30, 60]

function addDays(day: string, days: number) {
  const date = new Date(`${day}T12:00:00`)
  date.setDate(date.getDate() + days)
  return localDay(date)
}

// Predicts what the server will save for an answer, so the app can move on without waiting for it.
export function scheduleAnswer(card: Card, correct: boolean, today: string): Card {
  const step = correct ? Math.min(Math.max(card.srsStep, 0) + 1, reviewIntervals.length) : 0
  return {
    ...card,
    srsStep: step,
    dueOn: correct ? addDays(today, reviewIntervals[step - 1]) : today,
    needsReview: !correct,
    correctCount: card.correctCount + (correct ? 1 : 0),
    wrongCount: card.wrongCount + (correct ? 0 : 1),
    firstStudiedOn: card.firstStudiedOn ?? today,
  }
}

// Today's practice: every card due for review, plus new cards up to the daily limit.
export function dailyPlan(cards: Card[], today: string, newPerDay: number) {
  const due = cards.filter(card => isDue(card, today))
  const startedToday = cards.filter(card => card.firstStudiedOn === today).length
  const fresh = cards.filter(card => card.dueOn === null).slice(0, Math.max(0, newPerDay - startedToday))
  return { due, fresh, startedToday }
}

export type MemoryLevel = 'new' | 'learning' | 'familiar' | 'mastered'

export function memoryLevel(card: Card): MemoryLevel {
  if (card.dueOn === null) return 'new'
  if (card.srsStep <= 1) return 'learning'
  if (card.srsStep <= 3) return 'familiar'
  return 'mastered'
}

// Counts consecutive study days ending today, or ending yesterday when today has no answers yet.
export function studyStreak(days: StudyDay[], today: string) {
  const studied = new Set(days.filter(day => day.answers > 0).map(day => day.date))
  const cursor = new Date(`${today}T12:00:00`)
  if (!studied.has(today)) cursor.setDate(cursor.getDate() - 1)
  let streak = 0
  while (studied.has(localDay(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

// Exports in the five-column format that the CSV import reads back, quoting every field.
export function cardsToCsv(cards: Card[]) {
  const quote = (value: string) => `"${value.replace(/"/g, '""')}"`
  const rows = cards.map(card => [card.word, card.partsOfSpeech.join(', '), card.meanings.join(', '), card.hint, card.example].map(quote).join(','))
  return '\ufeff' + ['คำศัพท์,ชนิดของคำ,ความหมาย,คำใบ้,ตัวอย่างประโยค', ...rows].join('\r\n') + '\r\n'
}

export type ImportResult = {
  added: number
  merged: number
  skipped: number
  invalid: number
  issues: { row: number; word?: string; kind: 'skipped' | 'invalid'; reason: string }[]
}

export type ImportProgress = { phase: 'uploading' | 'processing' | 'refreshing'; percent: number }

export function filterCards(cards: Card[], letter: string, reviewOnly: boolean) {
  return cards.filter(card =>
    (letter === 'ALL' || card.word.trim().toUpperCase().startsWith(letter)) &&
    (!reviewOnly || card.needsReview),
  )
}

export function filterByPartOfSpeech(cards: Card[], partOfSpeech: string) {
  if (partOfSpeech === 'ALL') return cards
  return cards.filter(card => card.partsOfSpeech.some(part => part.trim().toLowerCase() === partOfSpeech.toLowerCase()))
}

export function searchCards(cards: Card[], query: string) {
  const term = query.trim().toLowerCase()
  if (!term) return cards
  return cards.filter(card =>
    [card.word, ...card.meanings].some(value => value.toLowerCase().includes(term)),
  )
}

export function shuffleCards<T>(cards: T[], random: () => number = Math.random) {
  const result = [...cards]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export function typingFeedback(word: string, answer: string) {
  const expected = Array.from(word)
  return Array.from(answer, (character, index) => ({
    character,
    correct: index < expected.length && character.toLocaleLowerCase() === expected[index].toLocaleLowerCase(),
  }))
}

export function isTypingMatch(word: string, answer: string) {
  return Array.from(word).length === Array.from(answer).length && typingFeedback(word, answer).every(letter => letter.correct)
}

export type Choice = { id: number; text: string }

// Builds a multiple-choice question: the answer plus wrong options taken from the other cards.
// Options that share the answer's part of speech or first letter come first so the question is not trivial,
// and cards sharing any meaning with the answer are skipped so only one option can be right.
export function buildChoices(card: Card, pool: Card[], side: 'word' | 'meaning', count = 4, random: () => number = Math.random): Choice[] {
  const textOf = (item: Card) => side === 'word' ? item.word : item.meaning
  const normalize = (value: string) => value.trim().toLowerCase()
  const meanings = new Set(card.meanings.map(normalize))
  const parts = new Set(card.partsOfSpeech.map(normalize))
  const initial = normalize(card.word).charAt(0)
  const score = (item: Card) => (item.partsOfSpeech.some(part => parts.has(normalize(part))) ? 2 : 0) + (normalize(item.word).charAt(0) === initial ? 1 : 0)
  // Shuffle first, then a stable sort keeps the random order within each score.
  const candidates = shuffleCards(pool.filter(item => item.id !== card.id), random).sort((a, b) => score(b) - score(a))
  const seen = new Set([normalize(textOf(card))])
  const wrong: Choice[] = []
  for (const item of candidates) {
    if (wrong.length >= count - 1) break
    const text = normalize(textOf(item))
    if (!text || seen.has(text) || item.meanings.some(meaning => meanings.has(normalize(meaning)))) continue
    seen.add(text)
    wrong.push({ id: item.id, text: textOf(item) })
  }
  return shuffleCards([{ id: card.id, text: textOf(card) }, ...wrong], random)
}

// Shrinks the headline font for long words or meanings so it never overflows the card.
// Only Latin words count as unbreakable: Thai text has no spaces and wraps anywhere.
export function fitTextClass(text: string) {
  const longestWord = Math.max(0, ...text.split(/\s+/).filter(word => /^[\x21-\x7E]+$/.test(word)).map(word => word.length))
  if (text.length <= 20 && longestWord <= 14) return 'text-3xl sm:text-5xl'
  if (text.length <= 45 && longestWord <= 18) return 'text-2xl sm:text-4xl'
  if (text.length <= 90) return 'text-xl sm:text-3xl'
  return 'text-lg sm:text-2xl'
}
