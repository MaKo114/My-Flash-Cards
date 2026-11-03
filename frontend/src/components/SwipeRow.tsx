import { useRef, useState, type PointerEvent, type ReactNode } from 'react'

export const swipeActionWidth = 144

type Gesture = { x: number; y: number; base: number; axis: 'x' | 'y' | null }

const isWide = () => window.matchMedia('(min-width: 768px)').matches

// On phones the row slides left to reveal its actions; from the md breakpoint the row stays put
// and the page shows the actions inline instead.
export function SwipeRow({ open, onOpenChange, actions, children, className = '' }: { open: boolean; onOpenChange: (open: boolean) => void; actions: ReactNode; children: ReactNode; className?: string }) {
  const [drag, setDrag] = useState<number | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const dragged = useRef(false)
  const offset = drag ?? (open ? -swipeActionWidth : 0)

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (isWide() || (event.pointerType === 'mouse' && event.button !== 0)) return
    gesture.current = { x: event.clientX, y: event.clientY, base: open ? -swipeActionWidth : 0, axis: null }
    dragged.current = false
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const current = gesture.current
    if (!current) return
    const dx = event.clientX - current.x
    const dy = event.clientY - current.y
    if (!current.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      // Decide once per gesture so vertical scrolling never drags the row sideways.
      current.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
      if (current.axis === 'x') event.currentTarget.setPointerCapture(event.pointerId)
    }
    if (current.axis !== 'x') return
    dragged.current = true
    setDrag(Math.min(0, Math.max(-swipeActionWidth - 24, current.base + dx)))
  }

  function onPointerEnd() {
    if (gesture.current?.axis === 'x' && drag !== null) onOpenChange(drag < -swipeActionWidth / 2)
    gesture.current = null
    setDrag(null)
  }

  return <div className={`relative overflow-hidden md:overflow-visible ${className}`}>
    {/* Transparent until the row moves, so the red action never peeks through the list's rounded corners. */}
    <div className="absolute inset-y-0 right-0 flex md:hidden" style={{ width: swipeActionWidth, opacity: offset < 0 ? 1 : 0 }} onFocus={() => onOpenChange(true)}>{actions}</div>
    <div
      data-swipe-row
      className="relative touch-pan-y bg-white md:transform-none!"
      style={{ transform: `translateX(${offset}px)`, transition: drag === null ? 'transform 200ms ease' : 'none' }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClickCapture={event => {
        // A finished swipe, or a tap on an open row, only moves the row; it must not toggle anything inside.
        if (dragged.current) { event.preventDefault(); event.stopPropagation(); dragged.current = false }
        else if (open && !isWide()) { event.preventDefault(); event.stopPropagation(); onOpenChange(false) }
      }}
    >{children}</div>
  </div>
}
