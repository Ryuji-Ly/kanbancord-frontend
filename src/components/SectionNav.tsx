import { useEffect, useRef, useState, type RefObject } from 'react'

type NavEntry = { index: number; label: string }

type SectionNavProps = {
  /** The scrolling container whose direct `<section>` children are listed, by their first heading. */
  containerRef: RefObject<HTMLElement | null>
  label: string
}

/** How far below the top of the container a section may start and still count as the one being read. */
const ACTIVE_OFFSET = 48

/**
 * A list of the sections in a scrolling container. Every section stays where it is; choosing one
 * scrolls to it, and the list follows along as the container scrolls.
 */
export function SectionNav({ containerRef, label }: SectionNavProps) {
  const [entries, setEntries] = useState<NavEntry[]>([])
  const [active, setActive] = useState(0)
  // A chosen section stays highlighted, even when it is too near the end to scroll to the top.
  const chosen = useRef<number | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const sections = () => Array.from(container.querySelectorAll<HTMLElement>(':scope > section'))

    function collect() {
      const next = sections()
        .map((section, index) => ({ index, label: section.querySelector('h3, h4')?.textContent?.trim() ?? '' }))
        .filter((entry) => entry.label)
      setEntries((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next))
    }

    function track() {
      const list = sections()
      const top = container!.getBoundingClientRect().top
      if (chosen.current !== null) return setActive(chosen.current)
      let current = 0
      let currentTop = -Infinity
      list.forEach((section, index) => {
        const sectionTop = section.getBoundingClientRect().top - top
        // Side-by-side sections share a top; the first of them wins.
        if (sectionTop <= ACTIVE_OFFSET && sectionTop > currentTop) {
          current = index
          currentTop = sectionTop
        }
      })
      setActive(current)
    }

    collect()
    track()
    const observer = new MutationObserver(collect)
    observer.observe(container, { childList: true, subtree: true, characterData: true })
    // Scrolling by hand hands the highlight back to the scroll position.
    const release = () => {
      chosen.current = null
    }
    const manual = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const
    container.addEventListener('scroll', track, { passive: true })
    manual.forEach((type) => container.addEventListener(type, release, { passive: true }))
    return () => {
      observer.disconnect()
      container.removeEventListener('scroll', track)
      manual.forEach((type) => container.removeEventListener(type, release))
    }
  }, [containerRef])

  function go(index: number) {
    const section = containerRef.current?.querySelectorAll<HTMLElement>(':scope > section')[index]
    if (!section) return
    chosen.current = index
    setActive(index)
    const reduce = document.documentElement.dataset.kcReduceMotion === 'on'
      || (document.documentElement.dataset.kcReduceMotion !== 'off' && matchMedia('(prefers-reduced-motion: reduce)').matches)
    section.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }

  if (entries.length < 2) return null

  return (
    <nav className="kc-section-nav" aria-label={label}>
      {entries.map((entry) => (
        <button
          key={entry.index}
          type="button"
          className={`kc-server-settings-tab${entry.index === active ? ' kc-server-settings-tab--active' : ''}`}
          aria-current={entry.index === active ? 'location' : undefined}
          onClick={() => go(entry.index)}
        >
          {entry.label}
        </button>
      ))}
    </nav>
  )
}
