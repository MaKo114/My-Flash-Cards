import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const variants = cva('inline-flex items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:pointer-events-none disabled:opacity-50', {
  variants: {
    variant: {
      default: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm',
      secondary: 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50',
      ghost: 'text-slate-600 hover:bg-slate-100',
      danger: 'text-red-600 hover:bg-red-50',
    },
    size: { default: 'h-10 px-4 py-2', sm: 'h-8 px-3', icon: 'h-9 w-9' },
  },
  defaultVariants: { variant: 'default', size: 'default' },
})

type Props = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof variants>
export const Button = forwardRef<HTMLButtonElement, Props>(function Button({ className, variant, size, ...props }, ref) {
  return <button ref={ref} className={cn(variants({ variant, size }), className)} {...props} />
})
