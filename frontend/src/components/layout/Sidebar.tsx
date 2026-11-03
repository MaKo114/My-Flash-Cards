import type { ReactNode } from 'react'
import { LogOut, Settings as SettingsIcon, Star } from 'lucide-react'
import { appName, navItems, type View } from './navigation'

// Left column on wide screens (lg and up): logo, menu, today's practice and account actions.
export function Sidebar({ view, onNavigate, reviewCount, totalCount, today, onOpenSettings, onLogout }: {
  view: View
  onNavigate: (view: View) => void
  reviewCount: number
  totalCount: number
  today: ReactNode
  onOpenSettings: () => void
  onLogout?: () => void
}) {
  return (
    <aside className="hidden w-60 shrink-0 flex-col overflow-y-auto border-r border-slate-200/80 bg-surface px-4 py-7 lg:sticky lg:top-0 lg:flex lg:h-dvh lg:self-start xl:w-64 xl:px-5">
      <div className="flex items-center gap-3 px-2">
        <img src="/app-icon.svg" alt="" className="h-10 w-10 shrink-0 rounded-2xl shadow-md shadow-teal-100" />
        <div className="min-w-0">
          <div className="text-lg font-bold leading-tight tracking-tight text-slate-900">{appName}</div>
          <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-[.14em] text-slate-500">English · Thai</div>
        </div>
      </div>

      <div className="mt-10 px-3 text-xs font-semibold text-slate-500">เมนูหลัก</div>
      <nav className="mt-3 space-y-1" aria-label="เมนูหลัก">
        {navItems.map(({ view: key, label, icon: Icon }) => (
          <button
            key={key}
            aria-current={view === key ? 'page' : undefined}
            onClick={() => onNavigate(key)}
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${view === key ? 'bg-teal-50 text-teal-800' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>

      <div className="mt-8">{today}</div>
      <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50/70 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-amber-800"><Star size={16} fill="currentColor" />ต้องทบทวน</div>
        <p className="mt-1 text-2xl font-bold text-slate-900">
          {reviewCount}<span className="ml-1.5 text-sm font-medium text-slate-500">จาก {totalCount} คำ</span>
        </p>
      </div>

      <div className="mt-auto space-y-1 pt-6">
        <button type="button" onClick={onOpenSettings} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          <SettingsIcon size={17} /> ตั้งค่า
        </button>
        {onLogout && (
          <button type="button" onClick={onLogout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
            <LogOut size={17} /> ออกจากระบบ
          </button>
        )}
      </div>
    </aside>
  )
}
