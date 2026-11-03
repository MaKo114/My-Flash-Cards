import { useCallback, useEffect, useState } from 'react'
import { readSettings, writeSettings, type Settings, type Theme } from '@/lib/settings'
import { configureSpeech } from '@/lib/speech'

function applyTheme(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

// Device preferences: loaded from localStorage, saved on every change, and applied to the
// page theme and the reading voice.
export function useSettings() {
  const [settings, setSettings] = useState(readSettings)

  useEffect(() => { writeSettings(settings) }, [settings])

  useEffect(() => {
    configureSpeech({ rate: settings.speechRate, lang: settings.accent })
  }, [settings.speechRate, settings.accent])

  useEffect(() => {
    applyTheme(settings.theme)
    if (settings.theme !== 'system') return
    // Follow the operating system when it switches between light and dark.
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [settings.theme])

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings(previous => ({ ...previous, ...patch }))
  }, [])

  return [settings, update] as const
}
