import { useState } from 'react'
import { filterCards, isDue, localDay, shuffleCards, type Card } from '@/lib/cards'
import { seeded } from '@/lib/random'

export type Filters = { letter: string; reviewOnly: boolean; dueOnly: boolean }

// What kind of word list the round uses: the filters, only the words missed last round, or today's plan.
export type RoundKind = 'filters' | 'retry' | 'daily'

type RoundOptions = Filters & { shuffled: boolean; seed: number; size: number; start: number }

// The state of one Challenge round: which words, where we are, and what was remembered or missed.
export function useChallengeRound({ cards, filters, shuffled, seed, roundSize, onAnswer }: {
  cards: Card[]
  filters: Filters
  shuffled: boolean
  seed: number
  roundSize: number
  onAnswer: (card: Card, remembered: boolean) => void
}) {
  const [ids, setIds] = useState<number[]>([])
  const [position, setPosition] = useState(0)
  const [started, setStarted] = useState(false)
  const [done, setDone] = useState(false)
  // Goes up for every new round so each question remounts with a clean state.
  const [run, setRun] = useState(0)
  const [rememberedCount, setRememberedCount] = useState(0)
  const [missedIds, setMissedIds] = useState<number[]>([])
  const [kind, setKind] = useState<RoundKind>('filters')
  // A limited round covers words [roundStart, roundStart + size) of the filtered order;
  // "next batch" continues from there, also after practising the missed words.
  const [roundStart, setRoundStart] = useState(0)
  const [poolSize, setPoolSize] = useState(0)
  const [batchable, setBatchable] = useState(true)

  function begin(nextIds: number[], { start = false, nextKind = 'filters' as RoundKind } = {}) {
    setIds(nextIds)
    setStarted(start)
    setDone(false)
    setRememberedCount(0)
    setMissedIds([])
    setKind(nextKind)
    setRun(value => value + 1)
    setPosition(0)
  }

  // Builds a round from the filters. Pass overrides for values that are changing in the same click.
  function start(overrides: Partial<RoundOptions> = {}, startNow = false) {
    const options: RoundOptions = { ...filters, shuffled, seed, size: roundSize, start: 0, ...overrides }
    const today = localDay()
    const selected = filterCards(cards, options.letter, options.reviewOnly).filter(card => !options.dueOnly || isDue(card, today))
    const ordered = options.shuffled ? shuffleCards(selected, seeded(options.seed)) : selected
    const from = options.start < ordered.length ? options.start : 0
    setRoundStart(from)
    setPoolSize(ordered.length)
    setBatchable(true)
    begin((options.size ? ordered.slice(from, from + options.size) : ordered).map(card => card.id), { start: startNow })
  }

  function startDaily(dailyIds: number[]) {
    setRoundStart(0)
    setPoolSize(dailyIds.length)
    setBatchable(false)
    begin(dailyIds, { nextKind: 'daily' })
  }

  function nextBatch() {
    start({ start: roundStart + roundSize }, true)
  }

  // Same words from the beginning, e.g. after switching the challenge mode.
  function replay() {
    begin(ids, { nextKind: kind })
  }

  function retryMissed() {
    begin(shuffled ? shuffleCards(missedIds) : missedIds, { start: true, nextKind: 'retry' })
  }

  const current = cards.find(card => card.id === ids[position])

  function assess(remembered: boolean) {
    if (!current) return
    onAnswer(current, remembered)
    if (remembered) setRememberedCount(value => value + 1)
    else setMissedIds(previous => [...previous, current.id])
    if (position + 1 >= ids.length) setDone(true)
    else setPosition(value => value + 1)
  }

  return {
    ids, position, started, done, run, kind, current,
    rememberedCount, missedIds, roundStart, poolSize,
    hasNextBatch: batchable && roundSize > 0 && roundStart + roundSize < poolSize,
    // True once at least one word was answered in an unfinished round, which is worth protecting.
    inProgress: started && !done && position > 0,
    setStarted, start, startDaily, nextBatch, replay, retryMissed, assess,
  }
}

export type ChallengeRound = ReturnType<typeof useChallengeRound>
