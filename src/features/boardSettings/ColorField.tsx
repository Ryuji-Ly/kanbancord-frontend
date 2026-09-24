import { useEffect, useRef, useState } from 'react'

/** How long the colour must stay put before it is saved; the picker reports every step of a drag. */
const COMMIT_DELAY_MS = 600

/**
 * A colour input that saves once the user stops changing it, rather than on every step of a drag.
 * Render with `key={value}` so a colour changed elsewhere replaces the one shown.
 */
export function ColorField({ value, label, onCommit }: { value: string; label: string; onCommit: (color: string) => void }) {
  const [color, setColor] = useState(value)
  const timer = useRef<number | null>(null)
  const commit = useRef(onCommit)
  useEffect(() => {
    commit.current = onCommit
  })
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
  }, [])

  return (
    <input
      type="color"
      className="kc-color-input"
      aria-label={label}
      value={color}
      onChange={(event) => {
        const next = event.target.value
        setColor(next)
        if (timer.current !== null) window.clearTimeout(timer.current)
        timer.current = window.setTimeout(() => {
          timer.current = null
          if (next.toLowerCase() !== value.toLowerCase()) commit.current(next)
        }, COMMIT_DELAY_MS)
      }}
    />
  )
}
