import { Plus, Settings as SettingsIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { appName, navItem, navItems, type View } from './navigation'

// Top bar with the page title (all sizes) and the tab menu (below lg). Sticks to the top on phones.
export function MobileHeader({ view, onNavigate, onAdd, onOpenSettings }: {
  view: View
  onNavigate: (view: View) => void
  onAdd: () => void
  onOpenSettings: () => void
}) {
  return (
    <div className="sticky top-0 z-30 lg:static">
      <header className="flex h-16 items-center justify-between gap-2 border-b border-slate-200/80 bg-surface px-4 sm:px-6 lg:h-20 lg:px-10">
        <div className="flex min-w-0 items-center gap-3">
          <img src="/app-icon.svg" alt="" className="h-9 w-9 shrink-0 lg:hidden" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 lg:hidden">{appName}</p>
            <h1 className="truncate text-lg font-bold text-slate-900">{navItem(view).title}</h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="ตั้งค่า" title="ตั้งค่า" onClick={onOpenSettings} className="lg:hidden">
            <SettingsIcon size={18} />
          </Button>
          <Button onClick={onAdd} size="sm" className="h-9">
            <Plus size={16} />
            <span className="hidden sm:inline">เพิ่มคำศัพท์</span>
            <span className="sm:hidden">เพิ่ม</span>
          </Button>
        </div>
      </header>

      <nav aria-label="เมนูหลัก" className="grid grid-cols-4 gap-1 border-b border-slate-200 bg-surface px-2 py-1.5 lg:hidden">
        {navItems.map(({ view: key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onNavigate(key)}
            aria-current={view === key ? 'page' : undefined}
            className={`flex flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-xs font-semibold sm:flex-row sm:gap-1.5 sm:text-sm ${view === key ? 'bg-teal-50 text-teal-800' : 'text-slate-600'}`}
          >
            <Icon size={17} className="shrink-0" />
            {label}
          </button>
        ))}
      </nav>
    </div>
  )
}
