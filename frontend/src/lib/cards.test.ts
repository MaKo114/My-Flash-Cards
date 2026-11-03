import { describe, expect, it } from 'vitest'
import { buildChoices, filterByPartOfSpeech, filterCards, fitTextClass, isTypingMatch, searchCards, shuffleCards, typingFeedback, type Card } from './cards'

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

describe('card headline size', () => {
  it('keeps short words large and shrinks long words or meanings', () => {
    expect(fitTextClass('Apple')).toBe('text-3xl sm:text-5xl')
    expect(fitTextClass('Incomprehensibilities')).toBe('text-xl sm:text-3xl')
    expect(fitTextClass('ละทิ้ง, ทอดทิ้ง')).toBe('text-3xl sm:text-5xl')
    expect(fitTextClass('สิ่งที่ไม่อาจเข้าใจได้อย่างถ่องแท้ไม่ว่าจะพยายามอธิบายอย่างไรก็ตาม, ความเข้าใจยาก, ความลึกลับซับซ้อนเกินกว่าจะเข้าใจ')).toBe('text-lg sm:text-2xl')
  })
})

describe('multiple choice', () => {
  const pool: Card[] = [
    ...cards,
    { id: 5, word: 'Ability', partOfSpeech: 'noun', meaning: 'ความสามารถ', partsOfSpeech: ['noun'], meanings: ['ความสามารถ'], hint: '', needsReview: false },
    { id: 6, word: 'Able', partOfSpeech: 'adjective', meaning: 'สามารถ', partsOfSpeech: ['adjective'], meanings: ['สามารถ'], hint: '', needsReview: false },
    { id: 7, word: 'Capable', partOfSpeech: 'adjective', meaning: 'สามารถ, มีความสามารถ', partsOfSpeech: ['adjective'], meanings: ['สามารถ', 'มีความสามารถ'], hint: '', needsReview: false },
    { id: 8, word: 'Absolute', partOfSpeech: 'adjective', meaning: 'แน่นอน', partsOfSpeech: ['adjective'], meanings: ['แน่นอน'], hint: '', needsReview: false },
  ]
  const able = pool.find(card => card.id === 6)!

  it('mixes the answer with distinct wrong options', () => {
    const choices = buildChoices(able, pool, 'word', 4, () => 0.3)
    expect(choices).toHaveLength(4)
    expect(choices.filter(choice => choice.id === able.id)).toEqual([{ id: 6, text: 'Able' }])
    expect(new Set(choices.map(choice => choice.text.toLowerCase())).size).toBe(4)
  })

  it('never offers a second card that shares a meaning with the answer', () => {
    for (const seed of [0, 0.2, 0.5, 0.9]) {
      expect(buildChoices(able, pool, 'meaning', 4, () => seed).map(choice => choice.id)).not.toContain(7)
    }
  })

  it('prefers the same part of speech and first letter', () => {
    const choices = buildChoices(able, pool, 'meaning', 2, () => 0.5)
    expect(choices.map(choice => choice.id).sort()).toEqual([6, 8])
  })

  it('returns fewer options when the pool is small', () => {
    expect(buildChoices(able, [able], 'meaning')).toEqual([{ id: 6, text: 'สามารถ' }])
  })
})
