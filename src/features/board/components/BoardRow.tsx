import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'

/** How close to the board's left or right edge a dragged card has to be before the board scrolls, and how fast. */
const EDGE_ZONE_PX = 80
const MAX_EDGE_SPEED_PX = 18

/** Pressing on any of these does what it always does; anywhere else on the pan surface drags the board. */
const NOT_PANNABLE = [
  'a', 'button', 'input', 'textarea', 'select', 'label', 'summary', 'h1', 'h2', 'h3', 'p',
  '[contenteditable="true"]', '[draggable="true"]', '[role="dialog"]', '[role="menu"]', '[role="listbox"]',
  '.kc-board-column-card', '.kc-column-menu-backdrop', '.kc-task-panel', '.kc-modal-overlay', '.kc-topbar',
  '.kc-board-scrollbar',
].join(', ')

type Props = {
  className?: string
  label: string
  lang?: string
  /** Whether a column or task is being dragged, so the board scrolls when it nears an edge. */
  dragging?: boolean
  /**
   * The board page keeps the scrollbar at the bottom of the window. Elsewhere (the roadmap, inside an article)
   * it sits under the columns and only sticks to the window's bottom while the board is on screen.
   */
  fixedScrollbar?: boolean
  /** Where pressing and dragging pans the board; the row of columns when not given. */
  panSurface?: RefObject<HTMLElement | null>
  children: ReactNode
}

/**
 * The row of columns. Its own scrollbar is hidden in favour of one that is always in reach, because columns can
 * be two screens tall and a mouse user would otherwise have to scroll down to find it. Dragging empty space pans
 * the board too.
 */
export function BoardRow({ className, label, lang, dragging = false, fixedScrollbar = false, panSurface, children }: Props) {
  const row = useRef<HTMLElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const [contentWidth, setContentWidth] = useState(0)
  const [overflowing, setOverflowing] = useState(false)
  // Where the fixed scrollbar goes: under the row, so dragging it moves the board exactly as far.
  const [barBox, setBarBox] = useState({ left: 0, width: 0 })

  // Measure whenever the row or any column changes size, and watch for columns being added or removed.
  useLayoutEffect(() => {
    const element = row.current
    if (!element) return
    const measure = () => {
      setContentWidth(element.scrollWidth)
      setOverflowing(element.scrollWidth > element.clientWidth + 1)
      const rect = element.getBoundingClientRect()
      setBarBox((box) => {
        const next = { left: Math.round(rect.left + element.clientLeft), width: element.clientWidth }
        return box.left === next.left && box.width === next.width ? box : next
      })
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
    window.addEventListener('resize', measure)
    measure()
    return () => {
      sizes.disconnect()
      columns.disconnect()
      window.removeEventListener('resize', measure)
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

  // Pressing and dragging empty space pans the board. Only with a mouse: touch already swipes, and columns,
  // cards and controls keep their own behaviour.
  useEffect(() => {
    const surface = panSurface?.current ?? row.current
    if (!surface) return
    let pan: { startX: number; startScroll: number } | null = null

    const start = (event: globalThis.PointerEvent) => {
      const element = row.current
      const target = event.target as Element | null
      if (!element || element.scrollWidth <= element.clientWidth + 1) return
      if (event.pointerType !== 'mouse' || event.button !== 0) return
      if (!target || target.closest(NOT_PANNABLE)) return
      event.preventDefault()
      surface.setPointerCapture(event.pointerId)
      pan = { startX: event.clientX, startScroll: element.scrollLeft }
      surface.classList.add('kc-board-panning')
    }
    const move = (event: globalThis.PointerEvent) => {
      if (pan && row.current) row.current.scrollLeft = pan.startScroll - (event.clientX - pan.startX)
    }
    const end = () => {
      pan = null
      surface.classList.remove('kc-board-panning')
    }

    surface.addEventListener('pointerdown', start)
    surface.addEventListener('pointermove', move)
    surface.addEventListener('pointerup', end)
    surface.addEventListener('pointercancel', end)
    return () => {
      surface.removeEventListener('pointerdown', start)
      surface.removeEventListener('pointermove', move)
      surface.removeEventListener('pointerup', end)
      surface.removeEventListener('pointercancel', end)
      end()
    }
  }, [panSurface])

  const fixed = fixedScrollbar && overflowing
  return (
    <div className={['kc-board-row', fixed ? 'kc-board-row--fixed-bar' : '', className].filter(Boolean).join(' ')}>
      <section
        ref={row}
        className={['kc-board-page-columns', overflowing ? 'kc-board-page-columns--pannable' : ''].filter(Boolean).join(' ')}
        aria-label={label}
        lang={lang}
        onScroll={syncBar}
      >
        {children}
      </section>
      {overflowing && (
        // The row itself stays scrollable for keyboards, touch and screen readers; this is a mouse's handle for it.
        <div
          ref={bar}
          className={['kc-board-scrollbar', fixed ? 'kc-board-scrollbar--fixed' : ''].filter(Boolean).join(' ')}
          style={fixed ? ({ left: barBox.left, width: barBox.width } as CSSProperties) : undefined}
          onScroll={syncRow}
          aria-hidden="true"
        >
          <div style={{ width: contentWidth, height: 1 }} />
        </div>
      )}
    </div>
  )
}
