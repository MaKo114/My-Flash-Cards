import type { Accent } from './settings'

// Text-to-speech for English words. The settings hook calls configureSpeech(), so components
// only need speak(word).
let options: { rate: number; lang: Accent } = { rate: 1, lang: 'en-US' }

export const speechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window

export function configureSpeech(next: { rate: number; lang: Accent }) {
  options = next
}

function voiceFor(lang: string) {
  const voices = window.speechSynthesis.getVoices()
  return voices.find(voice => voice.lang.replace('_', '-') === lang) ?? voices.find(voice => voice.lang.startsWith('en'))
}

export function speak(text: string) {
  if (!speechSupported) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = options.lang
  utterance.rate = options.rate
  const voice = voiceFor(options.lang)
  if (voice) utterance.voice = voice
  window.speechSynthesis.speak(utterance)
}

export function stopSpeaking() {
  if (speechSupported) window.speechSynthesis.cancel()
}
