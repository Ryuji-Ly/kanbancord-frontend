import { Fragment, useState, type ReactNode } from 'react'
import { FiX } from 'react-icons/fi'
import { t } from '../../i18n'

export type ServerSettingsSection = {
  key: string
  label: string
  content: ReactNode
  /** The heading this section is listed under; a heading is shown where the group changes. */
  group?: string
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

/**
 * The server's settings, laid out like Discord's: the sections listed on the left, the chosen one
 * filling the rest. On narrow screens the list becomes a row of tabs above the content.
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
  const [active, setActive] = useState(initialKey ?? sections[0]?.key ?? '')
  const current = sections.find((section) => section.key === active) ?? sections[0]

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
                  section.key === current?.key ? ' kc-server-settings-tab--active' : ''
                }`}
                aria-current={section.key === current?.key ? 'page' : undefined}
                onClick={() => setActive(section.key)}
              >
                {section.label}
              </button>
            </Fragment>
          ))}
        </nav>
        <div className="kc-server-settings-main">
          <div className="kc-server-settings-head">
            <h3>{current?.label}</h3>
            <button type="button" className="kc-modal-close" aria-label={t('settings.dialog.close', { title: title.toLocaleLowerCase() })} onClick={onClose}>
              <FiX aria-hidden="true" />
            </button>
          </div>
          <div className="kc-server-settings-body">{current?.content}</div>
        </div>
      </div>
    </div>
  )
}
