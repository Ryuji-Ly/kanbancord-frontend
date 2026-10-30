import { formatLocale, language, t } from '../../../i18n'
import type { LabelEntry } from '../../../services/boardsService'
import { resolveAssignee, resolveAssigneeDisplayName, type AssigneeMember, type LabelProgress } from '../boardModel'

/**
 * One line while the board is filtered by a label: how many of its tasks are done (in the last column, or
 * archived) and who still has the open ones.
 */
export function LabelSummary({
  label,
  progress,
  directory,
  showPeople,
}: {
  label: LabelEntry
  progress: LabelProgress
  directory: Map<string, AssigneeMember>
  /** Whether assignees are shown on this board; without them there is nobody to name. */
  showPeople: boolean
}) {
  if (progress.total === 0) {
    return <p className="kc-label-summary">{t('board.labelSummary.none', { label: label.name })}</p>
  }
  const open = showPeople
    ? [
        ...progress.people.map((person) =>
          t('board.labelSummary.person', {
            name: resolveAssigneeDisplayName(resolveAssignee(directory, person.userId)),
            count: person.count,
          }),
        ),
        ...(progress.unassigned > 0 ? [t('board.labelSummary.unassigned', { count: progress.unassigned })] : []),
      ]
    : []
  let people = open.join(', ')
  try {
    people = new Intl.ListFormat(formatLocale() ?? language(), { type: 'conjunction' }).format(open)
  } catch {
    // An older browser: commas will do.
  }
  return (
    <p className="kc-label-summary" aria-live="polite">
      <strong>{t('board.labelSummary.progress', { label: label.name, done: progress.done, total: progress.total })}</strong>
      {open.length > 0 && progress.done < progress.total && <span>{t('board.labelSummary.open', { people })}</span>}
    </p>
  )
}
