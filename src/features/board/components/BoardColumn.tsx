import { useEffect, useState, type CSSProperties, type DragEvent } from 'react'
import { t } from '../../../i18n'
import type { BoardColumnEntry } from '../../../services/boardColumnsService'
import type { LabelEntry, PriorityEntry } from '../../../services/boardsService'
import type { ServerRoleEntry } from '../../../services/permissionsService'
import type { TaskEntry } from '../../../services/tasksService'
import type { AssigneeMember } from '../boardModel'
import { TaskCard } from './TaskCard'

type BoardColumnProps = {
  column: BoardColumnEntry
  tasks: TaskEntry[]
  assigneesByTaskId: Record<number, AssigneeMember[]>
  labelsByTaskId: Map<number, { label: LabelEntry }[]>
  prioritiesById: Map<number, PriorityEntry>
  rolesByTaskId: Map<number, { role: ServerRoleEntry }[]>
  selectedTaskId: number | null
  canEdit: boolean
  canDelete: boolean
  canMove: boolean
  canCreateTask: boolean
  canMoveTasks: boolean
  /** Whether the column's menu offers archiving all of its tasks. */
  canArchiveTasks: boolean
  menuOpen: boolean
  /** The column being dragged renders as an empty slot where it would land. */
  isDragPlaceholder: boolean
  draggedTaskId: number | null
  draggedTaskHeight: number | null
  isTaskDropTarget: boolean
  justDragged: () => boolean
  onRename: (name: string) => void
  onToggleMenu: () => void
  onRequestDelete: () => void
  onRequestArchiveTasks: () => void
  onAddTask: () => void
  onOpenTask: (task: TaskEntry) => void
  onColumnDragStart: (event: DragEvent<HTMLElement>) => void
  onColumnDragEnd: () => void
  onTaskDragStart: (event: DragEvent<HTMLElement>, taskId: number) => void
  onTaskDragEnd: () => void
  onTaskDragOver: (event: DragEvent<HTMLElement>) => void
  onTaskDrop: (event: DragEvent<HTMLElement>) => void
}

/** How tall a column's tasks may be, in screen heights, before the rest is folded away. */
const FOLD_SCREENS = 2

/**
 * Whether a list is taller than {@link FOLD_SCREENS} screens, kept up to date as it or the window
 * changes size.
 */
function useTallerThanScreens(element: HTMLElement | null): boolean {
  const [tall, setTall] = useState(false)
  useEffect(() => {
    if (!element) return
    const check = () => setTall(element.scrollHeight > FOLD_SCREENS * window.innerHeight)
    const observer = new ResizeObserver(check)
    observer.observe(element)
    window.addEventListener('resize', check)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', check)
    }
  }, [element])
  return Boolean(element) && tall
}

export function BoardColumn({
  column,
  tasks,
  assigneesByTaskId,
  labelsByTaskId,
  prioritiesById,
  rolesByTaskId,
  selectedTaskId,
  canEdit,
  canDelete,
  canMove,
  canCreateTask,
  canMoveTasks,
  canArchiveTasks,
  menuOpen,
  isDragPlaceholder,
  draggedTaskId,
  draggedTaskHeight,
  isTaskDropTarget,
  justDragged,
  onRename,
  onToggleMenu,
  onRequestDelete,
  onRequestArchiveTasks,
  onAddTask,
  onOpenTask,
  onColumnDragStart,
  onColumnDragEnd,
  onTaskDragStart,
  onTaskDragEnd,
  onTaskDragOver,
  onTaskDrop,
}: BoardColumnProps) {
  const [editingName, setEditingName] = useState<string | null>(null)
  const editing = canEdit && editingName !== null
  // A very long column (a Done column with a hundred tasks, say) is folded at two screens, with a
  // button at the bottom to show the rest.
  const [list, setList] = useState<HTMLUListElement | null>(null)
  const tall = useTallerThanScreens(list)
  const [unfolded, setUnfolded] = useState(false)
  const folded = tall && !unfolded

  function finishRename() {
    const trimmed = editingName?.trim() ?? ''
    setEditingName(null)
    if (trimmed && trimmed !== column.name) onRename(trimmed)
  }

  return (
    <article
      data-column-id={column.columnId}
      style={{ '--kc-column-accent': column.color ?? 'var(--kc-info)' } as CSSProperties}
      className={[
        'kc-panel',
        'kc-board-column-card',
        canMove ? 'kc-board-column-card--movable' : '',
        isDragPlaceholder ? 'kc-board-column-card--drag-skeleton' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      draggable={canMove && !editing}
      onDragStart={(event) => {
        setEditingName(null)
        onColumnDragStart(event)
      }}
      onDragEnd={onColumnDragEnd}
    >
      <div className="kc-column-header">
        {editing ? (
          <input
            data-no-column-drag="true"
            className="kc-column-name-input"
            value={editingName ?? ''}
            autoFocus
            onChange={(event) => setEditingName(event.target.value)}
            onBlur={finishRename}
            onKeyDown={(event) => {
              if (event.key === 'Enter') finishRename()
              if (event.key === 'Escape') setEditingName(null)
            }}
          />
        ) : (
          <h3
            className={canEdit ? 'kc-column-name-editable' : undefined}
            onClick={() => {
              if (canEdit && !justDragged()) setEditingName(column.name)
            }}
          >
            {column.name}
          </h3>
        )}

        {(canDelete || canArchiveTasks) && (
          <div className="kc-column-menu-wrap" data-no-column-drag="true">
            <button
              className="kc-column-menu-btn"
              aria-label={t('board.column.options')}
              aria-expanded={menuOpen}
              onClick={(event) => {
                event.stopPropagation()
                onToggleMenu()
              }}
            >
              {'⋯'}
            </button>
            {menuOpen && (
              <ul className="kc-column-menu-dropdown" role="menu">
                {canArchiveTasks && (
                  <li role="none">
                    <button role="menuitem" className="kc-column-menu-item" onClick={onRequestArchiveTasks}>
                      {t('board.column.archiveTasks')}
                    </button>
                  </li>
                )}
                {canDelete && (
                  <li role="none">
                    <button role="menuitem" className="kc-column-menu-item kc-column-menu-item--danger" onClick={onRequestDelete}>
                      {t('board.column.delete')}
                    </button>
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="kc-column-content" data-no-column-drag="true">
        <div
          className={['kc-column-task-dropzone', isTaskDropTarget ? 'kc-column-task-dropzone--active' : '']
            .filter(Boolean)
            .join(' ')}
          data-no-column-drag="true"
          onDragOver={onTaskDragOver}
          onDrop={onTaskDrop}
        >
          {tasks.length > 0 ? (
            <ul
              ref={setList}
              className={['kc-column-task-list', folded ? 'kc-column-task-list--folded' : ''].filter(Boolean).join(' ')}
              style={folded ? ({ '--kc-fold-height': `${FOLD_SCREENS * 100}vh` } as CSSProperties) : undefined}
            >
              {tasks.map((task) => (
                <TaskCard
                  key={task.taskId}
                  task={task}
                  assignees={assigneesByTaskId[task.taskId] ?? []}
                  priority={task.priorityId === null ? null : (prioritiesById.get(task.priorityId) ?? null)}
                  labels={(labelsByTaskId.get(task.taskId) ?? []).map((entry) => entry.label)}
                  roles={(rolesByTaskId.get(task.taskId) ?? []).map((entry) => entry.role)}
                  movable={canMoveTasks}
                  draggable={canMoveTasks}
                  selected={selectedTaskId === task.taskId}
                  placeholderHeight={draggedTaskId === task.taskId ? (draggedTaskHeight ?? 0) : null}
                  onDragStart={(event) => onTaskDragStart(event, task.taskId)}
                  onDragEnd={onTaskDragEnd}
                  onOpen={() => {
                    if (!justDragged()) onOpenTask(task)
                  }}
                />
              ))}
            </ul>
          ) : null}
          {folded && (
            <button type="button" className="kc-column-unfold-btn" data-no-column-drag="true" onClick={() => setUnfolded(true)}>
              {t('board.column.showAll', { count: tasks.length })}
            </button>
          )}
        </div>

        {canCreateTask && (
          <button type="button" className="kc-column-add-task-btn" data-no-column-drag="true" onClick={onAddTask}>
            {t('board.column.addTask')}
          </button>
        )}
      </div>
    </article>
  )
}
