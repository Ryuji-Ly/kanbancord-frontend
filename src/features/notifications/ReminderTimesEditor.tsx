import { useState } from 'react'
import { SwitchRow } from '../../components/SwitchRow'
import { t } from '../../i18n'
import { MAX_REMINDER_MINUTES, MAX_REMINDER_TIMES, MIN_REMINDER_MINUTES } from '../../services/remindersService'
import { formatReminderTime } from './reminderFormat'

/**
 * Reminder times before a due date: each as a chip that can be removed, and a way to add one (an amount and a
 * unit). With `inherited`, a switch to use the times from the level above instead (the server's for a board,
 * the board's for a person); while it is on, the times are shown but not changed.
 */
export function ReminderTimesEditor({
  minutes,
  effective,
  inherited,
  disabled,
  onSave,
}: {
  /** The times set here, or null when the level above applies. */
  minutes: number[] | null
  /** What applies here. */
  effective: number[]
  /** The switch to use the level above: its label, and what it applies. Without it, times are always set here. */
  inherited?: { label: string; description: string }
  disabled?: boolean
  onSave: (minutes: number[] | null) => void
}) {
  const [amount, setAmount] = useState('1')
  const [unit, setUnit] = useState<number>(1440)
  const own = minutes !== null || !inherited
  const shown = own ? (minutes ?? effective) : effective

  const value = Math.round(Number(amount) * unit)
  const valid = Number.isFinite(value) && value >= MIN_REMINDER_MINUTES && value <= MAX_REMINDER_MINUTES
  const full = shown.length >= MAX_REMINDER_TIMES
  const add = () => {
    if (!valid || full || shown.includes(value)) return
    onSave([...shown, value].sort((a, b) => b - a))
  }

  return (
    <div className="kc-reminder-times">
      {inherited && (
        <ul className="kc-features-list">
          <SwitchRow
            label={inherited.label}
            description={inherited.description}
            on={!own}
            disabled={disabled}
            onToggle={(on) => onSave(on ? null : effective)}
          />
        </ul>
      )}
      {own && (
        <>
          {shown.length === 0 ? (
            <p className="kc-muted">{t('notifications.reminders.none')}</p>
          ) : (
            <ul className="kc-reminder-chips">
              {shown.map((time) => (
                <li key={time}>
                  <span>{formatReminderTime(time)}</span>
                  <button
                    type="button"
                    className="kc-btn kc-btn-small kc-btn-ghost"
                    aria-label={t('notifications.reminders.removeTime', { time: formatReminderTime(time) })}
                    disabled={disabled}
                    onClick={() => onSave(shown.filter((entry) => entry !== time))}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="kc-reminder-add">
            <input
              type="number"
              className="kc-input"
              min={1}
              step="any"
              value={amount}
              aria-label={t('notifications.reminders.amount')}
              disabled={disabled || full}
              onChange={(event) => setAmount(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') add()
              }}
            />
            <select
              className="kc-input"
              value={unit}
              aria-label={t('notifications.reminders.unit')}
              disabled={disabled || full}
              onChange={(event) => setUnit(Number(event.target.value))}
            >
              <option value={1}>{t('notifications.reminders.minutes')}</option>
              <option value={60}>{t('notifications.reminders.hours')}</option>
              <option value={1440}>{t('notifications.reminders.days')}</option>
              <option value={10_080}>{t('notifications.reminders.weeks')}</option>
            </select>
            <button
              type="button"
              className="kc-btn kc-btn-ghost"
              disabled={disabled || full || !valid || shown.includes(value)}
              onClick={add}
            >
              {t('notifications.reminders.add')}
            </button>
          </div>
          <p className="kc-muted kc-reminder-limit">{t('notifications.reminders.limit')}</p>
        </>
      )}
    </div>
  )
}
