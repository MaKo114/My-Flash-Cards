export type Card = {
  id: number
  word: string
  partOfSpeech: string
  meaning: string
  partsOfSpeech: string[]
  meanings: string[]
  hint: string
  needsReview: boolean
}

export type CardFields = Pick<Card, 'word' | 'partsOfSpeech' | 'meanings' | 'hint'>

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

export function shuffleCards(cards: Card[], random: () => number = Math.random) {
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

// Shrinks the headline font for long words or meanings so it never overflows the card.
// Only Latin words count as unbreakable: Thai text has no spaces and wraps anywhere.
export function fitTextClass(text: string) {
  const longestWord = Math.max(0, ...text.split(/\s+/).filter(word => /^[\x21-\x7E]+$/.test(word)).map(word => word.length))
  if (text.length <= 20 && longestWord <= 14) return 'text-3xl sm:text-5xl'
  if (text.length <= 45 && longestWord <= 18) return 'text-2xl sm:text-4xl'
  if (text.length <= 90) return 'text-xl sm:text-3xl'
  return 'text-lg sm:text-2xl'
}
