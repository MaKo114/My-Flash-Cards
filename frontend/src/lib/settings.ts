export type Language = 'ENG' | 'THAI'
export type ChallengeMode = 'copy' | 'listen' | 'meaning' | 'choice'
export type Theme = 'system' | 'light' | 'dark'
export type Accent = 'en-US' | 'en-GB'

export type Settings = {
  firstLanguage: Language
  challengeMode: ChallengeMode
  soundEffects: boolean
  shuffled: boolean
  // Words per challenge round; 0 means every word that matches the filters.
  roundSize: number
  // Answers to aim for each day; 0 hides the goal.
  dailyGoal: number
  // New (never answered) words added to the daily practice.
  newPerDay: number
  speechRate: number
  accent: Accent
  theme: Theme
}

export const roundSizes = [10, 20, 50, 0]
export const dailyGoals = [0, 10, 20, 30, 50]
export const newPerDayOptions = [0, 5, 10, 20]
export const speechRates = [0.75, 1, 1.25]

export const defaultSettings: Settings = {
  firstLanguage: 'ENG',
  challengeMode: 'copy',
  soundEffects: true,
  shuffled: false,
  roundSize: 20,
  dailyGoal: 20,
  newPerDay: 10,
  speechRate: 1,
  accent: 'en-US',
  theme: 'system',
}

// index.html reads this key too, to apply the dark theme before the page first paints.
export const settingsKey = 'flashcards.settings.v1'

// Each setting lists the values it accepts; anything else falls back to the default.
const allowed: { [Key in keyof Settings]: readonly Settings[Key][] } = {
  firstLanguage: ['ENG', 'THAI'],
  challengeMode: ['copy', 'listen', 'meaning', 'choice'],
  soundEffects: [true, false],
  shuffled: [true, false],
  roundSize: roundSizes,
  dailyGoal: dailyGoals,
  newPerDay: newPerDayOptions,
  speechRate: speechRates,
  accent: ['en-US', 'en-GB'],
  theme: ['system', 'light', 'dark'],
}

function pick<Key extends keyof Settings>(saved: Record<string, unknown>, key: Key): Settings[Key] {
  const value = saved[key] as Settings[Key]
  return allowed[key].includes(value) ? value : defaultSettings[key]
}

// Reads each saved setting on its own so one bad value does not reset the others.
export function readSettings(): Settings {
  try {
    const raw = localStorage.getItem(settingsKey)
    if (raw === null) return defaultSettings
    const saved: unknown = JSON.parse(raw)
    if (typeof saved !== 'object' || saved === null) return defaultSettings
    const values = saved as Record<string, unknown>
    const result = { ...defaultSettings }
    for (const key of Object.keys(allowed) as (keyof Settings)[]) {
      // Assigning through a widened record keeps TypeScript happy while each value stays checked by pick().
      ;(result as Record<keyof Settings, unknown>)[key] = pick(values, key)
    }
    return result
  } catch {
    return defaultSettings
  }
}

export function writeSettings(settings: Settings) {
  try {
    localStorage.setItem(settingsKey, JSON.stringify(settings))
  } catch {
    // Settings simply reset on the next visit when browser storage is disabled or full.
  }
}
