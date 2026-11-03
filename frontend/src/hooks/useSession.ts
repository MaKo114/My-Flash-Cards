import { useCallback, useEffect, useState } from 'react'
import { api, onUnauthorized, writeToken } from '@/lib/api'
import { clearCachedCards } from '@/lib/card-cache'

// 'checking' keeps showing cached cards while the server says whether a password is needed.
export type SessionStatus = 'checking' | 'locked' | 'open'

// Tracks whether this device may use the API. The check runs alongside the first card request
// instead of before it, so opening the app costs one round trip, not two.
export function useSession() {
  const [status, setStatus] = useState<SessionStatus>('checking')
  const [authRequired, setAuthRequired] = useState(false)
  // Goes up after each sign-in so data hooks know to load again.
  const [generation, setGeneration] = useState(0)

  const lock = useCallback(() => {
    writeToken('')
    clearCachedCards()
    setStatus('locked')
  }, [])

  useEffect(() => {
    // Any request answered with 401 signs this device out.
    onUnauthorized(lock)
    let active = true
    api.session()
      .then(session => {
        if (!active) return
        setAuthRequired(session.authRequired)
        if (session.authRequired && !session.authenticated) lock()
        else setStatus('open')
      })
      // Offline: keep the cached cards; the card request reports the connection error.
      .catch(() => { if (active) setStatus('open') })
    return () => {
      active = false
      onUnauthorized(null)
    }
  }, [lock])

  const login = useCallback(async (password: string) => {
    await api.login(password)
    setAuthRequired(true)
    setStatus('open')
    setGeneration(value => value + 1)
  }, [])

  return { status, authRequired, generation, login, logout: lock }
}
