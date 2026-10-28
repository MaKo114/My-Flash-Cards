export function playAnswerSound(correct: boolean) {
  if (!window.AudioContext) return

  try {
    const context = new AudioContext()
    const notes = correct ? [660, 880] : [330, 220]

    notes.forEach((frequency, index) => {
      const start = context.currentTime + index * 0.12
      const oscillator = context.createOscillator()
      const gain = context.createGain()
      oscillator.type = 'sine'
      oscillator.frequency.setValueAtTime(frequency, start)
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.08, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.16)
      oscillator.connect(gain)
      gain.connect(context.destination)
      oscillator.start(start)
      oscillator.stop(start + 0.17)
    })

    window.setTimeout(() => { void context.close().catch(() => {}) }, 450)
  } catch {
    // Visual feedback still works when audio is unavailable.
  }
}
