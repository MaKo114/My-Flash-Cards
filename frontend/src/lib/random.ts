// A small repeatable random generator: the same seed gives the same shuffle,
// so a shuffled deck keeps its order until the user asks for a new one.
export function seeded(value: number) {
  let state = value || 1
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}
