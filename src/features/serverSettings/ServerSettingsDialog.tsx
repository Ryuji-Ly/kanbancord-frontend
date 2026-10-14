import { Fragment, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { FiX } from 'react-icons/fi'
import { t } from '../../i18n'

export type ServerSettingsSection = {
  key: string
  label: string
  content: ReactNode
  /** The heading this section is listed under; a heading is shown where the group changes. */
  group?: string
  /**
   * Shown on a page of its own instead of in the one scrolling page with the other sections: for a
   * section that is long and scrolls by itself, such as the audit log.
   */
  separate?: boolean
}

type ServerSettingsDialogProps = {
  /** Shown above the list of sections. */
  serverName: string
  /** What the dialog is, for screen readers; "Server settings" unless given. */
  title?: string
  /** Only the sections the user may open; the first is shown first unless `initialKey` names another. */
  sections: ServerSettingsSection[]
  initialKey?: string
  onClose: () => void
}

/** How far below the top of the page a section may start and still count as the one being read. */
const ACTIVE_OFFSET = 48

function reduceMotion(): boolean {
  const setting = document.documentElement.dataset.kcReduceMotion
  return setting === 'on' || (setting !== 'off' && matchMedia('(prefers-reduced-motion: reduce)').matches)
}

/**
 * The server's settings, laid out like Discord's: the sections listed on the left, the content on
 * the right. The sections are one page to scroll through; the list jumps to a section and follows
 * along as the page scrolls. A section marked `separate` opens as a page of its own. On narrow
 * screens the list becomes a row of tabs above the content.
 *
 * Rendered in place rather than into the document body, so dialogs opened from a section and
 * rendered after it (such as adding a permission entry) appear on top of it.
 */
export function ServerSettingsDialog({
  serverName,
  title = t('dashboard.serverSettings'),
  sections,
  initialKey,
  onClose,
}: ServerSettingsDialogProps) {
  const flowing = sections.filter((section) => !section.separate)
  const start = sections.find((section) => section.key === initialKey) ?? flowing[0] ?? sections[0]
  // The separate section being shown, or null for the scrolling page of all the others.
  const [page, setPage] = useState<string | null>(start?.separate ? start.key : null)
  const [active, setActive] = useState(start?.separate ? '' : (start?.key ?? ''))
  const bodyRef = useRef<HTMLDivElement | null>(null)
  // A section to scroll to once the scrolling page is showing, and whether to glide there.
  const pending = useRef<{ key: string; smooth: boolean } | null>(start && !start.separate ? { key: start.key, smooth: false } : null)
  // A chosen section stays highlighted, even when it is too near the end to scroll to the top, and
  // stays in view while the sections above it are still loading and growing.
  const chosen = useRef<string | null>(start && !start.separate ? start.key : null)

  const current = page ? sections.find((section) => section.key === page) : undefined

  useLayoutEffect(() => {
    if (page || !pending.current) return
    const { key, smooth } = pending.current
    pending.current = null
    const section = bodyRef.current?.querySelector<HTMLElement>(`:scope > section[data-key="${key}"]`)
    section?.scrollIntoView({ behavior: smooth && !reduceMotion() ? 'smooth' : 'auto', block: 'start' })
  }, [page])

  // Follow the scrolling page with the highlight in the list.
  useEffect(() => {
    const body = bodyRef.current
    if (page || !body) return
    function track() {
      if (chosen.current) return setActive(chosen.current)
      const top = body!.getBoundingClientRect().top
      let key = ''
      const atEnd = body!.scrollTop + body!.clientHeight >= body!.scrollHeight - 2
      body!.querySelectorAll<HTMLElement>(':scope > section').forEach((section) => {
        // At the very end, the last section counts even though it cannot reach the top.
        if (!key || atEnd || section.getBoundingClientRect().top - top <= ACTIVE_OFFSET) key = section.dataset.key ?? key
      })
      setActive(key)
    }
    // Until the user scrolls, keep the chosen section at the top as the sections load and resize.
    const resized = new ResizeObserver(() => {
      if (!chosen.current) return
      body!.querySelector<HTMLElement>(`:scope > section[data-key="${chosen.current}"]`)?.scrollIntoView({ block: 'start' })
    })
    body.querySelectorAll(':scope > section').forEach((section) => resized.observe(section))
    // Scrolling by hand hands the highlight back to the scroll position.
    const release = () => {
      chosen.current = null
    }
    const manual = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const
    body.addEventListener('scroll', track, { passive: true })
    manual.forEach((type) => body.addEventListener(type, release, { passive: true }))
    return () => {
      resized.disconnect()
      body.removeEventListener('scroll', track)
      manual.forEach((type) => body.removeEventListener(type, release))
    }
  }, [page])

  function choose(section: ServerSettingsSection) {
    if (section.separate) {
      setPage(section.key)
      return
    }
    chosen.current = section.key
    setActive(section.key)
    if (page === null) {
      bodyRef.current
        ?.querySelector<HTMLElement>(`:scope > section[data-key="${section.key}"]`)
        ?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' })
    } else {
      // Back from a separate page: scroll once the page of sections is showing again.
      pending.current = { key: section.key, smooth: false }
      setPage(null)
    }
  }

  function isCurrent(section: ServerSettingsSection) {
    return section.separate ? section.key === page : page === null && section.key === active
  }

  return (
    <div className="kc-modal-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="kc-modal kc-server-settings" onClick={(event) => event.stopPropagation()}>
        <nav className="kc-server-settings-nav" aria-label={t('settings.dialog.sections', { title })}>
          <p className="kc-server-settings-server" lang="">
            {serverName}
          </p>
          {sections.map((section, index) => (
            <Fragment key={section.key}>
              {section.group && section.group !== sections[index - 1]?.group && (
                <p className="kc-server-settings-group">{section.group}</p>
              )}
              <button
                type="button"
                className={`kc-server-settings-tab${section.group ? ' kc-server-settings-tab--grouped' : ''}${
                  isCurrent(section) ? ' kc-server-settings-tab--active' : ''
                }`}
                aria-current={isCurrent(section) ? (section.separate ? 'page' : 'location') : undefined}
                onClick={() => choose(section)}
              >
                {section.label}
              </button>
            </Fragment>
          ))}
        </nav>
        <div className="kc-server-settings-main">
          <div className="kc-server-settings-head">
            <h2>{current?.label ?? title}</h2>
            <button type="button" className="kc-modal-close" aria-label={t('settings.dialog.close', { title: title.toLocaleLowerCase() })} onClick={onClose}>
              <FiX aria-hidden="true" />
            </button>
          </div>
          {current ? (
            <div className="kc-server-settings-body">{current.content}</div>
          ) : (
            <div className="kc-server-settings-body kc-server-settings-body--flow" ref={bodyRef}>
              {flowing.map((section, index) => (
                <section key={section.key} data-key={section.key} className="kc-server-settings-section">
                  {section.group && section.group !== flowing[index - 1]?.group && (
                    <p className="kc-server-settings-section-group">{section.group}</p>
                  )}
                  <h3 className="kc-server-settings-section-title">{section.label}</h3>
                  {section.content}
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
