import { useLayoutEffect, useRef, useState, type ComponentPropsWithoutRef, type DragEvent } from 'react'
import { t } from '../../../i18n'
import type { LabelEntry, PriorityEntry } from '../../../services/boardsService'
import type { ServerRoleEntry } from '../../../services/permissionsService'
import type { TaskEntry } from '../../../services/tasksService'
import { LABEL_PATTERNS } from './LabelPicker'
import { RoleChip } from './RolePicker'
import { FiFlag } from 'react-icons/fi'
import { priorityStyle, readableTextColor, resolveAssigneeDisplayName, type AssigneeMember } from '../boardModel'

/**
 * The task title, cut to two lines with an ellipsis (CSS line clamping cannot share a line with the
 * priority tag). Render with `key={title}` so a new title starts untruncated.
 */
function TaskTitle({ title }: { title: string }) {
  const titleRef = useRef<HTMLSpanElement | null>(null)
  const [displayTitle, setDisplayTitle] = useState(title)

  useLayoutEffect(() => {
    const element = titleRef.current
    if (!element) return

    const card = element.closest('.kc-column-task-card')
    if (!(card instanceof HTMLElement)) return

    const priorityTag = card.querySelector('.kc-column-task-priority')
    const resizeObserver = new ResizeObserver(() => {
      window.requestAnimationFrame(clampTitle)
    })

    function clampTitle() {
      const titleElement = titleRef.current
      if (!titleElement) return

      const lineHeight = Number.parseFloat(window.getComputedStyle(titleElement).lineHeight)
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) return

      const maxHeight = lineHeight * 2
      const range = document.createRange()

      function countRenderedLines() {
        const lineTops: number[] = []
        for (const rect of Array.from(range.getClientRects())) {
          if (!lineTops.some((top) => Math.abs(top - rect.top) < 1)) {
            lineTops.push(rect.top)
          }
        }
        return lineTops.length
      }

      function fitsWithinClamp(text: string) {
        titleElement!.textContent = text
        range.selectNodeContents(titleElement!)
        return titleElement!.scrollHeight <= maxHeight + 1 && countRenderedLines() <= 2
      }

      if (fitsWithinClamp(title)) {
        setDisplayTitle((current) => (current === title ? current : title))
        range.detach()
        return
      }

      let low = 0
      let high = title.length
      let bestFit = '…'
      while (low <= high) {
        const mid = Math.floor((low + high) / 2)
        const candidate = `${title.slice(0, mid).trimEnd()}…`
        if (fitsWithinClamp(candidate)) {
          bestFit = candidate
          low = mid + 1
        } else {
          high = mid - 1
        }
      }

      while (bestFit.length > 1 && !fitsWithinClamp(bestFit)) {
        bestFit = `${bestFit.slice(0, -1).replace(/…$/, '').trimEnd()}…`
      }

      setDisplayTitle((current) => (current === bestFit ? current : bestFit))
      range.detach()
    }

    const frameId = window.requestAnimationFrame(clampTitle)
    resizeObserver.observe(card)
    resizeObserver.observe(element)
    if (priorityTag instanceof HTMLElement) {
      resizeObserver.observe(priorityTag)
    }

    return () => {
      window.cancelAnimationFrame(frameId)
      resizeObserver.disconnect()
    }
  }, [title])

  return (
    <span ref={titleRef} className="kc-column-task-title">
      {displayTitle}
    </span>
  )
}

export function AssigneeAvatar({
  assignee,
  className,
  loading = 'eager',
}: {
  assignee: Pick<AssigneeMember, 'avatarUrl' | 'displayName' | 'username'>
  className: string
  loading?: ComponentPropsWithoutRef<'img'>['loading']
}) {
  const label = resolveAssigneeDisplayName(assignee)
  return (
    <span className={className} aria-hidden="true" title={label}>
      {assignee.avatarUrl ? (
        <img src={assignee.avatarUrl} alt="" loading={loading} decoding="async" />
      ) : (
        <span>{label.slice(0, 1).toUpperCase()}</span>
      )}
    </span>
  )
}

function TaskCardAssigneeStack({ assignees, roles }: { assignees: AssigneeMember[]; roles: ServerRoleEntry[] }) {
  if (assignees.length === 0 && roles.length === 0) return null

  const visibleAssignees = assignees.slice(0, 4)
  const hiddenCount = assignees.length - visibleAssignees.length

  return (
    <div
      className="kc-column-task-assignees"
      aria-label={t('board.card.assignedTo', { names: assignees.map(resolveAssigneeDisplayName).join(', ') })}
    >
      {visibleAssignees.map((assignee) => (
        <AssigneeAvatar key={assignee.userId} assignee={assignee} className="kc-column-task-assignee" loading="lazy" />
      ))}
      {hiddenCount > 0 ? (
        <span className="kc-column-task-assignee kc-column-task-assignee--count" aria-label={t('board.card.moreAssignees', { count: hiddenCount })}>
          +{hiddenCount}
        </span>
      ) : null}
      {roles.length > 0 && (
        <span className="kc-column-task-roles" aria-label={t('board.card.roles', { names: roles.map((role) => role.name).join(', ') })}>
          {roles.slice(0, 2).map((role) => (
            <RoleChip key={role.roleId} role={role} />
          ))}
          {roles.length > 2 && <span className="kc-muted">+{roles.length - 2}</span>}
        </span>
      )}
    </div>
  )
}

/** Labels shown on a card before the rest are summed up as "+N". */
const MAX_CARD_LABELS = 3

function TaskCardLabels({ labels }: { labels: LabelEntry[] }) {
  if (labels.length === 0) return null
  const shown = labels.slice(0, MAX_CARD_LABELS)
  const hidden = labels.length - shown.length
  return (
    <div className="kc-column-task-labels" aria-label={t('board.card.labels', { names: labels.map((label) => label.name).join(', ') })}>
      {shown.map((label) => (
        <span
          key={label.labelId}
          className="kc-column-task-label"
          data-pattern={label.labelId % LABEL_PATTERNS}
          style={{ backgroundColor: label.color, color: readableTextColor(label.color) }}
        >
          {label.name}
        </span>
      ))}
      {hidden > 0 && <span className="kc-column-task-label kc-column-task-label--more">+{hidden}</span>}
    </div>
  )
}

type TaskCardProps = {
  task: TaskEntry
  priority: PriorityEntry | null
  labels: LabelEntry[]
  assignees: AssigneeMember[]
  roles: ServerRoleEntry[]
  movable: boolean
  draggable: boolean
  selected: boolean
  /** The card stands in for the task being dragged: an empty slot of the dragged card's height. */
  placeholderHeight: number | null
  onDragStart: (event: DragEvent<HTMLElement>) => void
  onDragEnd: () => void
  onOpen: () => void
}

export function TaskCard({
  task,
  priority,
  labels,
  assignees,
  roles,
  movable,
  draggable,
  selected,
  placeholderHeight,
  onDragStart,
  onDragEnd,
  onOpen,
}: TaskCardProps) {
  const isPlaceholder = placeholderHeight !== null
  return (
    <li
      data-task-id={task.taskId}
      style={isPlaceholder && placeholderHeight ? { height: `${placeholderHeight}px` } : undefined}
      className={[
        'kc-column-task-card',
        movable ? 'kc-column-task-card--movable' : '',
        isPlaceholder ? 'kc-column-task-card--drag-skeleton' : '',
        selected ? 'kc-column-task-card--selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      draggable={draggable}
      data-no-column-drag="true"
      onDragStart={onDragStart}
      onDragEnd={(event) => {
        event.stopPropagation()
        onDragEnd()
      }}
      onClick={() => {
        if (!isPlaceholder) onOpen()
      }}
    >
      {!isPlaceholder && (
        <>
          <TaskCardLabels labels={labels} />
          {priority && (
            <span
              className="kc-column-task-priority"
              title={t('board.card.priority', { name: priority.name })}
              style={priorityStyle(priority.color)}
            >
              <FiFlag className="kc-priority-flag" aria-hidden="true" />
              <span className="kc-priority-rank">{t('board.priority.rank', { position: priority.position })}</span>
              {priority.name}
            </span>
          )}
          <TaskTitle key={task.title} title={task.title} />
          <TaskCardAssigneeStack assignees={assignees} roles={roles} />
        </>
      )}
    </li>
  )
}
