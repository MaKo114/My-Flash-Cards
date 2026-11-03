import type { ReactNode } from 'react'

// A friendly placeholder for lists or decks with nothing to show, with an optional next step.
export function EmptyState({ icon, title, description, action }: {
  icon: ReactNode
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-surface px-6 text-center">
      <div className="mb-4 rounded-2xl bg-teal-50 p-4 text-teal-500">{icon}</div>
      <h3 className="text-lg font-bold text-slate-800">{title}</h3>
      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
