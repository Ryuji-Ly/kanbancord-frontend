import { formatLocale, language, t } from '../../i18n'

/** Reminder times in the reader's language, with the browser's own words for units. */

const UNITS = [
  { unit: 'week', minutes: 10_080 },
  { unit: 'day', minutes: 1440 },
  { unit: 'hour', minutes: 60 },
  { unit: 'minute', minutes: 1 },
] as const

const locale = () => formatLocale() ?? language()

/** 1440 → "1 day", 1500 → "1 day, 1 hour", in the reader's language. */
export function formatReminderTime(minutes: number): string {
  const parts: string[] = []
  let rest = minutes
  for (const { unit, minutes: size } of UNITS) {
    const count = Math.floor(rest / size)
    if (count > 0) {
      parts.push(new Intl.NumberFormat(locale(), { style: 'unit', unit, unitDisplay: 'long' }).format(count))
      rest -= count * size
    }
  }
  try {
    return new Intl.ListFormat(locale(), { type: 'unit', style: 'narrow' }).format(parts)
  } catch {
    return parts.join(' ')
  }
}

/** "1 day and 3 hours", or that there are none. */
export function formatReminderTimes(minutes: number[]): string {
  if (minutes.length === 0) return t('notifications.reminders.none')
  const parts = minutes.map(formatReminderTime)
  try {
    return new Intl.ListFormat(locale(), { type: 'conjunction' }).format(parts)
  } catch {
    return parts.join(', ')
  }
}
