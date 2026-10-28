import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown, ChevronUp } from 'lucide-react'
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
  name?: string
}

export function Select({ id, label, value, onValueChange, options, placeholder, className, required, name }: Props) {
  return <SelectPrimitive.Root value={value} onValueChange={onValueChange} required={required} name={name}>
    <SelectPrimitive.Trigger id={id} aria-label={label} className={cn('inline-flex h-10 min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 text-left text-sm font-semibold text-slate-700 shadow-sm outline-none transition-colors hover:border-teal-300 hover:bg-teal-50/40 focus-visible:border-teal-500 focus-visible:ring-2 focus-visible:ring-teal-200 data-[state=open]:border-teal-500 data-[state=open]:ring-2 data-[state=open]:ring-teal-100', className)}>
      <SelectPrimitive.Value placeholder={placeholder} />
      <SelectPrimitive.Icon asChild><ChevronDown aria-hidden="true" size={16} className="shrink-0 text-slate-400" /></SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content position="popper" sideOffset={6} align="start" collisionPadding={12} className="z-[70] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-1.5 text-slate-700 shadow-[0_18px_48px_-18px_rgba(15,47,44,.28)]" style={{ minWidth: 'max(11rem, var(--radix-select-trigger-width))', maxHeight: 'min(20rem, var(--radix-select-content-available-height))' }}>
        <SelectPrimitive.ScrollUpButton className="flex h-7 items-center justify-center text-slate-400"><ChevronUp aria-hidden="true" size={15} /></SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="max-h-72">
          {options.map(option => <SelectPrimitive.Item key={option.value} value={option.value} className="relative flex cursor-pointer select-none items-center rounded-lg py-2.5 pl-3 pr-9 text-sm font-medium outline-none data-[highlighted]:bg-teal-50 data-[highlighted]:text-teal-900 data-[state=checked]:font-bold data-[state=checked]:text-teal-800">
            <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
            <SelectPrimitive.ItemIndicator className="absolute right-3 text-teal-700"><Check aria-hidden="true" size={16} /></SelectPrimitive.ItemIndicator>
          </SelectPrimitive.Item>)}
        </SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex h-7 items-center justify-center text-slate-400"><ChevronDown aria-hidden="true" size={15} /></SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  </SelectPrimitive.Root>
}
