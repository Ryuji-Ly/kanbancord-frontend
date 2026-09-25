import { useState, type CSSProperties, type DragEvent } from 'react'
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
  onAddTask: () => void
  onOpenTask: (task: TaskEntry) => void
  onColumnDragStart: (event: DragEvent<HTMLElement>) => void
  onColumnDragEnd: () => void
  onTaskDragStart: (event: DragEvent<HTMLElement>, taskId: number) => void
  onTaskDragEnd: () => void
  onTaskDragOver: (event: DragEvent<HTMLElement>) => void
  onTaskDrop: (event: DragEvent<HTMLElement>) => void
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
  menuOpen,
  isDragPlaceholder,
  draggedTaskId,
  draggedTaskHeight,
  isTaskDropTarget,
  justDragged,
  onRename,
  onToggleMenu,
  onRequestDelete,
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

  function finishRename() {
    const trimmed = editingName?.trim() ?? ''
    setEditingName(null)
    if (trimmed && trimmed !== column.name) onRename(trimmed)
  }

  return (
    <article
      data-column-id={column.columnId}
      style={{ '--kc-column-accent': column.color ?? '#60a5fa' } as CSSProperties}
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

        {canDelete && (
          <div className="kc-column-menu-wrap" data-no-column-drag="true">
            <button
              className="kc-column-menu-btn"
              aria-label="Column options"
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
                <li role="none">
                  <button role="menuitem" className="kc-column-menu-item kc-column-menu-item--danger" onClick={onRequestDelete}>
                    Delete column
                  </button>
                </li>
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
            <ul className="kc-column-task-list">
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
        </div>

        {canCreateTask && (
          <button type="button" className="kc-column-add-task-btn" data-no-column-drag="true" onClick={onAddTask}>
            + Add a task
          </button>
        )}
      </div>
    </article>
  )
}
