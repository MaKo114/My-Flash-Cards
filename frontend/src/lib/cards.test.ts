import { describe, expect, it } from 'vitest'
import { buildChoices, cardsToCsv, filterByPartOfSpeech, filterCards, fitTextClass, isDue, memoryLevel, normalizeCard, studyStreak, isTypingMatch, searchCards, shuffleCards, typingFeedback, type Card } from './cards'

const extra = { example: '', srsStep: 0, dueOn: null, correctCount: 0, wrongCount: 0 }

const cards: Card[] = [
  { id: 1, word: 'Apple', partOfSpeech: 'noun', meaning: 'แอปเปิล', partsOfSpeech: ['noun'], meanings: ['แอปเปิล'], hint: '', needsReview: false, ...extra },
  { id: 2, word: 'ant', partOfSpeech: 'noun', meaning: 'มด', partsOfSpeech: ['noun'], meanings: ['มด'], hint: '', needsReview: true, ...extra },
  { id: 3, word: 'Book', partOfSpeech: 'verb', meaning: 'หนังสือ', partsOfSpeech: ['verb'], meanings: ['หนังสือ'], hint: '', needsReview: true, ...extra },
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
    const run: Card = { id: 4, word: 'Run', partOfSpeech: 'verb, noun', meaning: 'วิ่ง, การวิ่ง', partsOfSpeech: ['verb', 'noun'], meanings: ['วิ่ง', 'การวิ่ง'], hint: '', needsReview: false, ...extra }
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
    { id: 5, word: 'Ability', partOfSpeech: 'noun', meaning: 'ความสามารถ', partsOfSpeech: ['noun'], meanings: ['ความสามารถ'], hint: '', needsReview: false, ...extra },
    { id: 6, word: 'Able', partOfSpeech: 'adjective', meaning: 'สามารถ', partsOfSpeech: ['adjective'], meanings: ['สามารถ'], hint: '', needsReview: false, ...extra },
    { id: 7, word: 'Capable', partOfSpeech: 'adjective', meaning: 'สามารถ, มีความสามารถ', partsOfSpeech: ['adjective'], meanings: ['สามารถ', 'มีความสามารถ'], hint: '', needsReview: false, ...extra },
    { id: 8, word: 'Absolute', partOfSpeech: 'adjective', meaning: 'แน่นอน', partsOfSpeech: ['adjective'], meanings: ['แน่นอน'], hint: '', needsReview: false, ...extra },
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

describe('review schedule and statistics', () => {
  const base = cards[0]

  it('fills fields missing from older data', () => {
    const { example: _example, srsStep: _step, dueOn: _due, correctCount: _correct, wrongCount: _wrong, ...legacy } = base
    expect(normalizeCard(legacy)).toEqual({ ...legacy, example: '', srsStep: 0, dueOn: null, correctCount: 0, wrongCount: 0 })
  })

  it('treats a card as due on or after its review day', () => {
    expect(isDue({ ...base, dueOn: null }, '2026-11-03')).toBe(false)
    expect(isDue({ ...base, dueOn: '2026-11-03' }, '2026-11-03')).toBe(true)
    expect(isDue({ ...base, dueOn: '2026-10-30' }, '2026-11-03')).toBe(true)
    expect(isDue({ ...base, dueOn: '2026-11-04' }, '2026-11-03')).toBe(false)
  })

  it('groups cards by how well they are remembered', () => {
    expect(memoryLevel({ ...base, dueOn: null })).toBe('new')
    expect(memoryLevel({ ...base, dueOn: '2026-11-03', srsStep: 0 })).toBe('learning')
    expect(memoryLevel({ ...base, dueOn: '2026-11-03', srsStep: 3 })).toBe('familiar')
    expect(memoryLevel({ ...base, dueOn: '2026-11-03', srsStep: 6 })).toBe('mastered')
  })

  it('counts consecutive study days, allowing today to be still open', () => {
    const day = (date: string, answers = 3) => ({ date, answers, correct: 1 })
    expect(studyStreak([day('2026-11-03'), day('2026-11-02'), day('2026-11-01'), day('2026-10-30')], '2026-11-03')).toBe(3)
    expect(studyStreak([day('2026-11-02'), day('2026-11-01')], '2026-11-03')).toBe(2)
    expect(studyStreak([day('2026-11-01')], '2026-11-03')).toBe(0)
    expect(studyStreak([day('2026-03-01'), day('2026-02-28')], '2026-03-01')).toBe(2)
    expect(studyStreak([], '2026-11-03')).toBe(0)
  })

  it('exports every field in the format the import reads back', () => {
    const run = { ...base, word: 'Run', partsOfSpeech: ['verb', 'noun'], meanings: ['วิ่ง', 'การวิ่ง'], hint: 'ใช้ "ขา"', example: 'I run, you walk.' }
    expect(cardsToCsv([run])).toBe('﻿คำศัพท์,ชนิดของคำ,ความหมาย,คำใบ้,ตัวอย่างประโยค\r\n"Run","verb, noun","วิ่ง, การวิ่ง","ใช้ ""ขา""","I run, you walk."\r\n')
  })
})
