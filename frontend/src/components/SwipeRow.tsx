import { useLayoutEffect, useRef, type PointerEvent, type ReactNode } from 'react'

export const swipeActionWidth = 144

type Gesture = {
  startX: number
  startY: number
  base: number          // offset when the finger went down (0 closed, -width open)
  axis: 'x' | 'y' | null
  offset: number
  lastX: number
  lastTime: number
  velocity: number      // px per ms; negative means moving left
}

const isWide = () => window.matchMedia('(min-width: 768px)').matches
const settle = 'transform 300ms cubic-bezier(.22,1,.36,1)'

// Past either end the row moves at a quarter of the finger's speed, like iOS lists.
function resist(offset: number) {
  if (offset > 0) return offset * 0.25
  const limit = -swipeActionWidth
  return offset < limit ? limit + (offset - limit) * 0.25 : offset
}

// On phones the row slides left to reveal its actions; from the md breakpoint the row stays put
// and the page shows the actions inline instead.
//
// While a finger drags, the transform is written straight to the element inside requestAnimationFrame,
// so React does not re-render on every pointer move. That is what keeps the swipe smooth.
export function SwipeRow({ open, onOpenChange, actions, children }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  actions: ReactNode
  children: ReactNode
}) {
  const rowRef = useRef<HTMLDivElement>(null)
  const actionsRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<Gesture | null>(null)
  const frame = useRef(0)
  const swiped = useRef(false)

  function paint(offset: number, animate: boolean) {
    const row = rowRef.current
    const actionsBox = actionsRef.current
    if (!row || !actionsBox) return
    row.style.transition = animate ? settle : 'none'
    row.style.transform = offset ? `translate3d(${offset}px, 0, 0)` : ''
    // Hidden until the row moves, so the red action never peeks through the list's rounded corners.
    const reveal = Math.min(1, Math.max(0, -offset / swipeActionWidth))
    actionsBox.style.opacity = reveal > 0 ? '1' : '0'
    actionsBox.style.setProperty('--reveal', String(reveal))
  }

  // Follow the `open` prop (another row opened, an action was used) unless a finger is dragging.
  useLayoutEffect(() => {
    if (!gesture.current?.axis) paint(open ? -swipeActionWidth : 0, true)
  }, [open])

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (isWide() || (event.pointerType === 'mouse' && event.button !== 0)) return
    const base = open ? -swipeActionWidth : 0
    gesture.current = { startX: event.clientX, startY: event.clientY, base, axis: null, offset: base, lastX: event.clientX, lastTime: event.timeStamp, velocity: 0 }
    swiped.current = false
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current
    if (!current) return
    const dx = event.clientX - current.startX
    const dy = event.clientY - current.startY
    if (!current.axis) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      // Decide once per gesture so vertical scrolling never drags the row sideways.
      current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (current.axis === 'x') event.currentTarget.setPointerCapture(event.pointerId)
    }
    if (current.axis !== 'x') return
    swiped.current = true
    const elapsed = Math.max(1, event.timeStamp - current.lastTime)
    current.velocity = (event.clientX - current.lastX) / elapsed
    current.lastX = event.clientX
    current.lastTime = event.timeStamp
    current.offset = resist(current.base + dx)
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => paint(current.offset, false))
  }

  function onPointerEnd() {
    const current = gesture.current
    gesture.current = null
    cancelAnimationFrame(frame.current)
    if (current?.axis !== 'x') return
    // A quick flick decides on its own; a slow drag opens past the halfway point.
    const flick = Math.abs(current.velocity) > 0.35
    const shouldOpen = flick ? current.velocity < 0 : current.offset < -swipeActionWidth / 2
    paint(shouldOpen ? -swipeActionWidth : 0, true)
    if (shouldOpen && !open) navigator.vibrate?.(8)
    if (shouldOpen !== open) onOpenChange(shouldOpen)
  }

  return (
    <div className="relative overflow-hidden md:overflow-visible">
      <div
        ref={actionsRef}
        className="absolute inset-y-0 right-0 flex opacity-0 md:hidden"
        style={{ width: swipeActionWidth }}
        onFocus={() => onOpenChange(true)}
      >
        {actions}
      </div>
      <div
        ref={rowRef}
        data-swipe-row
        className="relative touch-pan-y bg-surface will-change-transform md:transform-none!"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClickCapture={event => {
          // A finished swipe, or a tap on an open row, only moves the row; it must not toggle anything inside.
          if (swiped.current) {
            event.preventDefault()
            event.stopPropagation()
            swiped.current = false
          } else if (open && !isWide()) {
            event.preventDefault()
            event.stopPropagation()
            onOpenChange(false)
          }
        }}
      >
        {children}
      </div>
    </div>
  )
}

// One of the buttons revealed behind a swiped row. It grows slightly as the row opens.
export function SwipeAction({ label, icon, text, tone, onClick }: {
  label: string
  icon: ReactNode
  text: string
  tone: 'neutral' | 'danger'
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex flex-1 flex-col items-center justify-center gap-1 text-xs font-semibold text-white ${tone === 'danger' ? 'bg-red-600' : 'bg-slate-600 dark:bg-slate-300'}`}
    >
      <span className="flex flex-col items-center gap-1" style={{ transform: 'scale(calc(0.8 + var(--reveal, 1) * 0.2))' }}>
        {icon}
        {text}
      </span>
    </button>
  )
}
