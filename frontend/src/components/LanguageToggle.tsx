import type { Language } from '@/lib/settings'

// Two-button switch between English and Thai for the side shown first.
export function LanguageToggle({ label, value, onChange }: {
  label: string
  value: Language
  onChange: (value: Language) => void
}) {
  return (
    <div className="flex items-center gap-2" role="group" aria-label={label}>
      <span className="text-sm font-semibold text-slate-600">{label}</span>
      <div className="flex rounded-xl border border-slate-200 bg-surface p-1">
        {(['ENG', 'THAI'] as const).map(item => (
          <button
            key={item}
            type="button"
            aria-pressed={value === item}
            onClick={() => onChange(item)}
            className={`rounded-lg px-3 py-1 text-xs font-bold ${value === item ? 'bg-accent text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  )
}
