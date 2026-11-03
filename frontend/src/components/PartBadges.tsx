// Colored chips for parts of speech, e.g. "noun" or "verb".

const partColors: Record<string, string> = {
  noun: 'bg-sky-50 text-sky-800 ring-sky-200',
  verb: 'bg-orange-50 text-orange-800 ring-orange-200',
  adjective: 'bg-violet-50 text-violet-800 ring-violet-200',
  adverb: 'bg-rose-50 text-rose-800 ring-rose-200',
  pronoun: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  preposition: 'bg-amber-50 text-amber-900 ring-amber-200',
  conjunction: 'bg-cyan-50 text-cyan-800 ring-cyan-200',
  interjection: 'bg-pink-50 text-pink-800 ring-pink-200',
  determiner: 'bg-slate-100 text-slate-700 ring-slate-200',
  phrase: 'bg-purple-50 text-purple-800 ring-purple-200',
}

const fallbackColor = 'bg-slate-100 text-slate-700 ring-slate-200'

export function PartBadge({ part }: { part: string }) {
  const normalized = part.trim().toLowerCase()
  return (
    <span
      data-part-of-speech={normalized}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${partColors[normalized] ?? fallbackColor}`}
    >
      {part}
    </span>
  )
}

export function PartBadges({ parts, className = '' }: { parts: string[]; className?: string }) {
  return (
    <div className={`flex flex-wrap items-center justify-center gap-1.5 ${className}`}>
      {parts.map(part => <PartBadge key={part.toLowerCase()} part={part} />)}
    </div>
  )
}
