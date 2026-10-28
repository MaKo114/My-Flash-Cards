export type Card = {
  id: number
  word: string
  partOfSpeech: string
  meaning: string
  hint: string
  needsReview: boolean
}

export type CardFields = Pick<Card, 'word' | 'partOfSpeech' | 'meaning' | 'hint'>

export type ImportResult = {
  added: number
  skipped: number
  invalid: number
  issues: { row: number; reason: string }[]
}

export function filterCards(cards: Card[], letter: string, reviewOnly: boolean) {
  return cards.filter(card =>
    (letter === 'ALL' || card.word.trim().toUpperCase().startsWith(letter)) &&
    (!reviewOnly || card.needsReview),
  )
}

export function filterByPartOfSpeech(cards: Card[], partOfSpeech: string) {
  if (partOfSpeech === 'ALL') return cards
  return cards.filter(card => card.partOfSpeech.trim().toLowerCase() === partOfSpeech.toLowerCase())
}

export function searchCards(cards: Card[], query: string) {
  const term = query.trim().toLowerCase()
  if (!term) return cards
  return cards.filter(card =>
    [card.word, card.meaning].some(value => value.toLowerCase().includes(term)),
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
