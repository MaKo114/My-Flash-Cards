export type Language = 'ENG' | 'THAI'
export type ChallengeMode = 'copy' | 'listen' | 'meaning' | 'choice'

export type Settings = {
  firstLanguage: Language
  challengeMode: ChallengeMode
  soundEffects: boolean
  shuffled: boolean
  // Words per challenge round; 0 means every word that matches the filters.
  roundSize: number
}

export const roundSizes = [10, 20, 50, 0]
export const defaultSettings: Settings = { firstLanguage: 'ENG', challengeMode: 'copy', soundEffects: true, shuffled: false, roundSize: 20 }

const settingsKey = 'flashcards.settings.v1'
const languages: Language[] = ['ENG', 'THAI']
const challengeModes: ChallengeMode[] = ['copy', 'listen', 'meaning', 'choice']

// Reads each saved setting on its own so one bad value does not reset the others.
export function readSettings(): Settings {
  try {
    const raw = localStorage.getItem(settingsKey)
    if (raw === null) return defaultSettings
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null) return defaultSettings
    const saved = value as Partial<Record<keyof Settings, unknown>>
    return {
      firstLanguage: languages.includes(saved.firstLanguage as Language) ? saved.firstLanguage as Language : defaultSettings.firstLanguage,
      challengeMode: challengeModes.includes(saved.challengeMode as ChallengeMode) ? saved.challengeMode as ChallengeMode : defaultSettings.challengeMode,
      soundEffects: typeof saved.soundEffects === 'boolean' ? saved.soundEffects : defaultSettings.soundEffects,
      shuffled: typeof saved.shuffled === 'boolean' ? saved.shuffled : defaultSettings.shuffled,
      roundSize: roundSizes.includes(saved.roundSize as number) ? saved.roundSize as number : defaultSettings.roundSize,
    }
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
