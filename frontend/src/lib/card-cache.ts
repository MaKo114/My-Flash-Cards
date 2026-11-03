import { normalizeCard, type Card } from './cards'

const cacheKey = 'flashcards.cards.v1'

export function readCachedCards(): Card[] | null {
  try {
    const raw = localStorage.getItem(cacheKey)
    if (raw === null) return null
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value) || !value.every(isCard)) return null
    return value.map(normalizeCard)
  } catch {
    return null
  }
}

export function clearCachedCards() {
  try { localStorage.removeItem(cacheKey) } catch { /* nothing cached */ }
}

export function writeCachedCards(cards: Card[]) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify(cards))
  } catch {
    // The live API remains available when browser storage is disabled or full.
  }
}

// Snapshots saved before examples and review scheduling existed are still accepted.
function isCard(value: unknown): value is Parameters<typeof normalizeCard>[0] {
  if (typeof value !== 'object' || value === null) return false
  const card = value as Partial<Card>
  return typeof card.id === 'number' && typeof card.word === 'string' &&
    typeof card.partOfSpeech === 'string' && typeof card.meaning === 'string' &&
    Array.isArray(card.partsOfSpeech) && card.partsOfSpeech.every(part => typeof part === 'string') &&
    Array.isArray(card.meanings) && card.meanings.every(meaning => typeof meaning === 'string') &&
    typeof card.hint === 'string' && typeof card.needsReview === 'boolean' &&
    (card.example === undefined || typeof card.example === 'string') &&
    (card.dueOn === undefined || card.dueOn === null || typeof card.dueOn === 'string')
}
