import { describe, expect, it } from 'vitest'
import { filterByPartOfSpeech, filterCards, isTypingMatch, searchCards, shuffleCards, typingFeedback, type Card } from './cards'

const cards: Card[] = [
  { id: 1, word: 'Apple', partOfSpeech: 'noun', meaning: 'แอปเปิล', partsOfSpeech: ['noun'], meanings: ['แอปเปิล'], hint: '', needsReview: false },
  { id: 2, word: 'ant', partOfSpeech: 'noun', meaning: 'มด', partsOfSpeech: ['noun'], meanings: ['มด'], hint: '', needsReview: true },
  { id: 3, word: 'Book', partOfSpeech: 'verb', meaning: 'หนังสือ', partsOfSpeech: ['verb'], meanings: ['หนังสือ'], hint: '', needsReview: true },
]

describe('study deck', () => {
  it('filters the English first letter and review status together', () => {
    expect(filterCards(cards, 'A', false).map(card => card.id)).toEqual([1, 2])
    expect(filterCards(cards, 'A', true).map(card => card.id)).toEqual([2])
  })

  it('searches English and Thai meaning, excluding part of speech', () => {
    expect(searchCards(cards, ' APP ').map(card => card.id)).toEqual([1])
    expect(searchCards(cards, 'NOUN')).toEqual([])
    expect(searchCards(cards, 'หนังสือ').map(card => card.id)).toEqual([3])
    expect(searchCards(filterCards(cards, 'A', true), 'มด').map(card => card.id)).toEqual([2])
  })

  it('filters part of speech alongside the other library filters', () => {
    expect(filterByPartOfSpeech(cards, 'ALL')).toEqual(cards)
    expect(filterByPartOfSpeech(cards, 'NOUN').map(card => card.id)).toEqual([1, 2])
    expect(searchCards(filterByPartOfSpeech(filterCards(cards, 'B', true), 'verb'), 'หนังสือ').map(card => card.id)).toEqual([3])
  })

  it('finds every meaning and part of a grouped word', () => {
    const run: Card = { id: 4, word: 'Run', partOfSpeech: 'verb, noun', meaning: 'วิ่ง, การวิ่ง', partsOfSpeech: ['verb', 'noun'], meanings: ['วิ่ง', 'การวิ่ง'], hint: '', needsReview: false }
    expect(filterByPartOfSpeech([run], 'NOUN')).toEqual([run])
    expect(searchCards([run], 'การวิ่ง')).toEqual([run])
    expect(shuffleCards([run]).map(card => card.word)).toEqual(['Run'])
  })

  it('shuffles without changing the source or repeating a card', () => {
    const result = shuffleCards(cards, () => 0)
    expect(result.map(card => card.id)).toEqual([2, 3, 1])
    expect(cards.map(card => card.id)).toEqual([1, 2, 3])
    expect(new Set(result.map(card => card.id)).size).toBe(cards.length)
  })

  it('marks each typed character and accepts the full spelling without case sensitivity', () => {
    expect(typingFeedback('Apple', 'Apxle').map(letter => letter.correct)).toEqual([true, true, false, true, true])
    expect(typingFeedback('Apple', 'Apples').at(-1)?.correct).toBe(false)
    expect(isTypingMatch('Apple', 'apple')).toBe(true)
    expect(isTypingMatch('Apple', 'Apxle')).toBe(false)
    expect(isTypingMatch('Apple', 'Apples')).toBe(false)
  })
})
