import { useRef, useState, type KeyboardEvent } from 'react'
import * as Popover from '@radix-ui/react-popover'
import { Command } from 'cmdk'
import { Check, ChevronDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

type Option = { value: string; label: string }

type Props = {
  id: string
  label: string
  value: string
  onValueChange: (value: string) => void
  options: Option[]
  placeholder?: string
  className?: string
  required?: boolean
}

export function Select({ id, label, value, onValueChange, options, placeholder, className, required }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const selected = options.find(option => option.value === value)

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
    } else if (event.key.length === 1 && event.key !== ' ' && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault()
      setSearch(event.key)
      setOpen(true)
    }
  }

  return <Popover.Root open={open} onOpenChange={next => { setOpen(next); if (!next) setSearch('') }}>
    <Popover.Trigger asChild>
      <button type="button" id={id} role="combobox" aria-label={label} aria-expanded={open} aria-required={required} onKeyDown={handleTriggerKeyDown} className={cn('inline-flex h-10 min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 text-left text-sm font-semibold text-slate-700 shadow-sm outline-none transition-colors hover:border-teal-300 hover:bg-teal-50/40 focus-visible:border-teal-500 focus-visible:ring-2 focus-visible:ring-teal-200 data-[state=open]:border-teal-500 data-[state=open]:ring-2 data-[state=open]:ring-teal-100', className)}>
        <span className={cn('min-w-0 truncate', !selected && 'text-slate-400')}>{selected?.label || placeholder}</span>
        <ChevronDown aria-hidden="true" size={16} className="shrink-0 text-slate-400" />
      </button>
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Content align="start" sideOffset={6} collisionPadding={12} onOpenAutoFocus={event => { event.preventDefault(); inputRef.current?.focus() }} className="z-[70] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-[0_18px_48px_-18px_rgba(15,47,44,.28)]" style={{ minWidth: 'max(11rem, var(--radix-popover-trigger-width))', maxHeight: 'var(--radix-popover-content-available-height)' }}>
        <Command label={`ค้นหา${label}`} loop filter={(candidate, term) => {
          const optionLabel = options.find(option => option.value === candidate)?.label.toLocaleLowerCase()
          const query = term.toLocaleLowerCase()
          if (!optionLabel) return 0
          if (optionLabel === query) return 3
          if (optionLabel.startsWith(query)) return 2
          return optionLabel.includes(query) ? 1 : 0
        }}>
          <div className="flex items-center gap-2 border-b border-slate-100 px-2 pb-1.5">
            <Search aria-hidden="true" size={16} className="shrink-0 text-slate-400" />
            <Command.Input ref={inputRef} value={search} onValueChange={setSearch} aria-label={`ค้นหา${label}`} autoComplete="off" spellCheck={false} placeholder="พิมพ์เพื่อค้นหา…" className="h-9 w-full min-w-0 bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400" />
          </div>
          <Command.List className="max-h-64 overflow-y-auto overscroll-contain py-1 scroll-py-2">
            <Command.Empty className="px-3 py-5 text-center text-sm text-slate-500">ไม่พบตัวเลือก</Command.Empty>
            {options.map(option => <Command.Item key={option.value} value={option.value} onSelect={() => { onValueChange(option.value); setOpen(false); setSearch('') }} className="relative flex cursor-pointer select-none items-center rounded-lg py-2.5 pl-3 pr-9 text-sm font-medium outline-none data-[selected=true]:bg-teal-50 data-[selected=true]:text-teal-900">
              <span className="truncate">{option.label}</span>
              {value === option.value && <Check aria-hidden="true" size={16} className="absolute right-3 text-teal-700" />}
            </Command.Item>)}
          </Command.List>
        </Command>
      </Popover.Content>
    </Popover.Portal>
  </Popover.Root>
}
