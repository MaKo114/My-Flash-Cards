import type { Card } from './cards'

const cacheKey = 'flashcards.cards.v1'

export function readCachedCards(): Card[] | null {
  try {
    const raw = localStorage.getItem(cacheKey)
    if (raw === null) return null
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value) || !value.every(isCard)) return null
    return value
  } catch {
    return null
  }
}

export function writeCachedCards(cards: Card[]) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify(cards))
  } catch {
    // The live API remains available when browser storage is disabled or full.
  }
}

function isCard(value: unknown): value is Card {
  if (typeof value !== 'object' || value === null) return false
  const card = value as Partial<Card>
  return typeof card.id === 'number' && typeof card.word === 'string' &&
    typeof card.partOfSpeech === 'string' && typeof card.meaning === 'string' &&
    Array.isArray(card.partsOfSpeech) && card.partsOfSpeech.every(part => typeof part === 'string') &&
    Array.isArray(card.meanings) && card.meanings.every(meaning => typeof meaning === 'string') &&
    typeof card.hint === 'string' && typeof card.needsReview === 'boolean'
}
