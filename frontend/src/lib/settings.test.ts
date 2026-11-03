import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSettings, readSettings, writeSettings } from './settings'

describe('saved settings', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value) } })
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('uses defaults until something is saved', () => {
    expect(readSettings()).toEqual(defaultSettings)
  })

  it('restores saved settings', () => {
    const settings = { firstLanguage: 'THAI', challengeMode: 'choice', soundEffects: false, shuffled: true, roundSize: 0, dailyGoal: 50, newPerDay: 0, speechRate: 0.75, accent: 'en-GB', theme: 'dark' } as const
    writeSettings(settings)
    expect(readSettings()).toEqual(settings)
  })

  it('replaces only the values that are invalid', () => {
    localStorage.setItem('flashcards.settings.v1', JSON.stringify({ firstLanguage: 'FR', challengeMode: 'meaning', soundEffects: 'yes', roundSize: 7 }))
    expect(readSettings()).toEqual({ ...defaultSettings, challengeMode: 'meaning' })
    localStorage.setItem('flashcards.settings.v1', '{broken')
    expect(readSettings()).toEqual(defaultSettings)
  })
})
