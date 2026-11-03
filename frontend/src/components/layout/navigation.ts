import { BookOpen, ChartColumn, Layers3, Target } from 'lucide-react'

export type View = 'library' | 'study' | 'challenge' | 'stats'

export const appName = 'My Flash Cards'

// The four main pages, in menu order.
export const navItems = [
  { view: 'library', label: 'คลังคำศัพท์', title: 'คลังคำศัพท์ของฉัน', icon: BookOpen },
  { view: 'study', label: 'อ่านบัตรคำ', title: 'ฝึกจำคำศัพท์', icon: Layers3 },
  { view: 'challenge', label: 'Challenge', title: 'Challenge', icon: Target },
  { view: 'stats', label: 'สถิติ', title: 'สถิติการฝึก', icon: ChartColumn },
] as const satisfies readonly { view: View; label: string; title: string; icon: unknown }[]

export function navItem(view: View) {
  return navItems.find(item => item.view === view)!
}
