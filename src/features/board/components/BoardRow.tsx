import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react'

/** How close to the board's left or right edge a dragged card has to be before the board scrolls, and how fast. */
const EDGE_ZONE_PX = 80
const MAX_EDGE_SPEED_PX = 18

type Props = {
  className?: string
  label: string
  lang?: string
  /** Whether a column or task is being dragged, so the board scrolls when it nears an edge. */
  dragging?: boolean
  children: ReactNode
}

/**
 * The row of columns. Its own scrollbar is hidden in favour of one that stays at the bottom of the window,
 * because columns can be two screens tall and a mouse user would otherwise have to scroll down to reach it.
 * Dragging the empty space between columns pans the board too.
 */
export function BoardRow({ className, label, lang, dragging = false, children }: Props) {
  const row = useRef<HTMLElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const pan = useRef<{ startX: number; startScroll: number } | null>(null)
  const [contentWidth, setContentWidth] = useState(0)
  const [overflowing, setOverflowing] = useState(false)
  const [panning, setPanning] = useState(false)

  // Measure whenever the row or any column changes size, and watch for columns being added or removed.
  useLayoutEffect(() => {
    const element = row.current
    if (!element) return
    const measure = () => {
      setContentWidth(element.scrollWidth)
      setOverflowing(element.scrollWidth > element.clientWidth + 1)
    }
    const sizes = new ResizeObserver(measure)
    const observeAll = () => {
      sizes.disconnect()
      sizes.observe(element)
      for (const child of Array.from(element.children)) sizes.observe(child)
    }
    const columns = new MutationObserver(() => {
      observeAll()
      measure()
    })
    observeAll()
    columns.observe(element, { childList: true })
    measure()
    return () => {
      sizes.disconnect()
      columns.disconnect()
    }
  }, [])

  // The scrollbar appears after the first overflow is measured, so it starts where the row already is.
  useLayoutEffect(() => {
    if (overflowing && bar.current && row.current) bar.current.scrollLeft = row.current.scrollLeft
  }, [overflowing])

  function syncBar() {
    if (bar.current && row.current && bar.current.scrollLeft !== row.current.scrollLeft) {
      bar.current.scrollLeft = row.current.scrollLeft
    }
  }

  function syncRow() {
    if (bar.current && row.current && row.current.scrollLeft !== bar.current.scrollLeft) {
      row.current.scrollLeft = bar.current.scrollLeft
    }
  }

  // While dragging, scroll when the pointer is near the board's left or right edge, so a card can reach a
  // column that is off screen. The pointer is read from the whole window: tasks stop dragover from bubbling.
  useEffect(() => {
    if (!dragging) return
    let pointer: { x: number; y: number } | null = null
    let frame = 0
    const track = (event: DragEvent) => {
      pointer = { x: event.clientX, y: event.clientY }
    }
    // Stop as soon as the drag is over, before the board has re-rendered without it.
    const stop = () => {
      pointer = null
    }
    const step = () => {
      const element = row.current
      if (element && pointer) {
        const rect = element.getBoundingClientRect()
        const left = Math.max(rect.left, 0)
        const right = Math.min(rect.right, window.innerWidth)
        if (pointer.y >= rect.top && pointer.y <= rect.bottom) {
          if (pointer.x < left + EDGE_ZONE_PX) {
            element.scrollLeft -= Math.ceil(((left + EDGE_ZONE_PX - pointer.x) / EDGE_ZONE_PX) * MAX_EDGE_SPEED_PX)
          } else if (pointer.x > right - EDGE_ZONE_PX) {
            element.scrollLeft += Math.ceil(((pointer.x - right + EDGE_ZONE_PX) / EDGE_ZONE_PX) * MAX_EDGE_SPEED_PX)
          }
        }
      }
      frame = requestAnimationFrame(step)
    }
    window.addEventListener('dragover', track, true)
    window.addEventListener('drop', stop, true)
    window.addEventListener('dragend', stop, true)
    frame = requestAnimationFrame(step)
    return () => {
      window.removeEventListener('dragover', track, true)
      window.removeEventListener('drop', stop, true)
      window.removeEventListener('dragend', stop, true)
      cancelAnimationFrame(frame)
    }
  }, [dragging])

  // Only a mouse press on the row itself pans: columns and cards start their own drags, and touch already swipes.
  function startPan(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0 || event.target !== event.currentTarget || !overflowing) return
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    pan.current = { startX: event.clientX, startScroll: event.currentTarget.scrollLeft }
    setPanning(true)
  }

  function movePan(event: PointerEvent<HTMLElement>) {
    if (!pan.current) return
    event.currentTarget.scrollLeft = pan.current.startScroll - (event.clientX - pan.current.startX)
  }

  function endPan() {
    pan.current = null
    setPanning(false)
  }

  return (
    <div className={['kc-board-row', className].filter(Boolean).join(' ')}>
      <section
        ref={row}
        className={['kc-board-page-columns', overflowing ? 'kc-board-page-columns--pannable' : '', panning ? 'kc-board-page-columns--panning' : '']
          .filter(Boolean)
          .join(' ')}
        aria-label={label}
        lang={lang}
        onScroll={syncBar}
        onPointerDown={startPan}
        onPointerMove={movePan}
        onPointerUp={endPan}
        onPointerCancel={endPan}
      >
        {children}
      </section>
      {overflowing && (
        // The row itself stays scrollable for keyboards, touch and screen readers; this is a mouse's handle for it.
        <div ref={bar} className="kc-board-scrollbar" onScroll={syncRow} aria-hidden="true">
          <div style={{ width: contentWidth, height: 1 }} />
        </div>
      )}
    </div>
  )
}
