import { useEffect, useMemo, useState } from 'react'
import { FiSettings } from 'react-icons/fi'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { readableError } from '../api/http'
import { signOut, useSession } from '../api/session'
import type { BoardColumnEntry } from '../services/boardColumnsService'
import type { TaskEntry } from '../services/tasksService'
import { DashboardHeader } from '../components/dashboard/DashboardHeader'
import { ToastStack } from '../components/dashboard/ToastStack'
import { useToasts } from '../hooks/useToasts'
import {
  assigneeDirectory,
  boardAbilities,
  boardSettingsAccess,
  groupTasksByColumn,
  hasAnySetting,
  labelsByTask,
  nextLabelColor,
  rolesByTask,
  withSimpleView,
  resolveAssignee,
  sortColumns,
  toAssigneeMembers,
  type AssigneeMember,
  type TaskDraft,
} from '../features/board/boardModel'
import {
  taskFieldsFromDraft,
  useBoardCatalogMutations,
  useBoardMutations,
  useBoardSnapshot,
  type TaskFields,
} from '../features/board/boardQueries'
import { useServerMembers, useServerRoles } from '../features/server/serverQueries'
import { useMe } from '../features/session/sessionQueries'
import { useBoardDragAndDrop } from '../features/board/useBoardDragAndDrop'
import { useBoardRealtime } from '../features/board/useBoardRealtime'
import { AddColumn } from '../features/board/components/AddColumn'
import { BoardColumn } from '../features/board/components/BoardColumn'
import { ConfirmDialog } from '../features/board/components/ConfirmDialog'
import { CreateTaskModal } from '../features/board/components/CreateTaskModal'
import { BoardSettingsDialog } from '../features/boardSettings/BoardSettingsDialog'
import { usePreferences } from '../features/preferences/usePreferences'
import { TaskPanel } from '../features/board/components/TaskPanel'

export function BoardPage() {
  const { boardId = '' } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const serverId = searchParams.get('serverId') ?? ''
  const session = useSession()
  const hasContext = Boolean(boardId && serverId)
  const [revokedReason, setRevokedReason] = useState<'ACCESS_LOST' | 'BOARD_DELETED' | null>(null)

  const meQuery = useMe()
  const snapshotQuery = useBoardSnapshot(serverId, boardId)
  const mutations = useBoardMutations(serverId, boardId)
  const catalogMutations = useBoardCatalogMutations(serverId, boardId)
  const [showSettings, setShowSettings] = useState(false)
  const { toasts, showToast } = useToasts()

  const me = meQuery.data ?? null
  const snapshot = snapshotQuery.data
  const board = snapshot?.board ?? null
  const simpleView = usePreferences()?.simpleView
  const abilities = useMemo(() => withSimpleView(boardAbilities(snapshot), simpleView), [snapshot, simpleView])
  const shown = abilities.features
  const columns = useMemo(() => sortColumns(snapshot?.columns ?? []), [snapshot])
  const tasksByColumn = useMemo(() => groupTasksByColumn(snapshot?.tasks ?? []), [snapshot])
  // Features that are off, for the server or in the user's simple view, show nothing on the board.
  const labelsByTaskId = useMemo(() => (shown.LABELS ? labelsByTask(snapshot) : new Map()), [snapshot, shown.LABELS])
  const prioritiesById = useMemo(
    () => new Map(shown.PRIORITIES ? (snapshot?.priorities ?? []).map((level) => [level.priorityId, level]) : []),
    [snapshot, shown.PRIORITIES],
  )
  const rolesQuery = useServerRoles(serverId, Boolean(snapshot?.features.ASSIGNEES))
  const roles = useMemo(() => rolesQuery.data ?? [], [rolesQuery.data])
  const rolesByTaskId = useMemo(
    () => (shown.ASSIGNEES ? rolesByTask(snapshot, new Map(roles.map((role) => [String(role.roleId), role]))) : new Map()),
    [snapshot, roles, shown.ASSIGNEES],
  )
  const canOpenSettings = hasAnySetting(boardSettingsAccess(snapshot?.permissions, snapshot?.features))
  const ready = Boolean(snapshot && me)

  useBoardRealtime(serverId, boardId, ready, setRevokedReason)

  const [openMenuColumnId, setOpenMenuColumnId] = useState<number | null>(null)
  const [deleteTargetColumn, setDeleteTargetColumn] = useState<BoardColumnEntry | null>(null)
  const [deleteColumnError, setDeleteColumnError] = useState('')
  const [createInColumn, setCreateInColumn] = useState<BoardColumnEntry | null>(null)
  const [createTaskError, setCreateTaskError] = useState('')
  // A link can open a task straight away (`&task=<id>`), as links from Discord do.
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(() => {
    const linked = Number(searchParams.get('task'))
    return Number.isInteger(linked) && linked > 0 ? linked : null
  })
  const [deleteTargetTask, setDeleteTargetTask] = useState<TaskEntry | null>(null)
  const [deleteTaskError, setDeleteTaskError] = useState('')

  // The panel shows the task as currently cached, so remote changes appear and a deleted task closes it.
  const selectedTask = snapshot?.tasks.find((task) => task.taskId === selectedTaskId) ?? null

  const canAssign = abilities.assignSelf || abilities.assignOthers
  const membersQuery = useServerMembers(serverId, Boolean(me) && (canAssign || selectedTask !== null))
  const members = useMemo(() => toAssigneeMembers(membersQuery.data ?? []), [membersQuery.data])
  const directory = useMemo(() => assigneeDirectory(members, me), [members, me])
  const assigneesByTaskId = useMemo(() => {
    const groups: Record<number, AssigneeMember[]> = {}
    for (const assignment of shown.ASSIGNEES ? (snapshot?.assignments ?? []) : []) {
      ;(groups[assignment.taskId] ??= []).push(resolveAssignee(directory, String(assignment.userId)))
    }
    return groups
  }, [snapshot, directory, shown.ASSIGNEES])

  const drag = useBoardDragAndDrop({
    columns,
    tasksByColumn,
    canMoveColumns: abilities.moveColumn,
    canMoveTasks: abilities.moveTask,
    onMoveColumn: (columnId, index) =>
      mutations.reorderColumn.mutate(
        { columnId, index },
        {
          onSuccess: () => showToast('Columns reordered', 'success'),
          onError: () => showToast('Failed to reorder columns', 'error'),
        },
      ),
    onMoveTask: (taskId, columnId, index) =>
      mutations.relocateTask.mutate(
        { taskId, columnId, index },
        {
          onSuccess: () => showToast('Tasks reordered', 'success'),
          onError: () => showToast('Failed to reorder tasks', 'error'),
        },
      ),
  })

  // Close the task panel on any click outside it, a task card or a dialog.
  useEffect(() => {
    if (selectedTaskId === null) return
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Element
      if (target.closest('.kc-task-panel') || target.closest('[data-task-id]') || target.closest('.kc-modal-overlay')) {
        return
      }
      setSelectedTaskId(null)
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [selectedTaskId])

  function renameColumn(column: BoardColumnEntry, name: string) {
    mutations.renameColumn.mutate(
      { column, name },
      {
        onSuccess: () => showToast('Column updated', 'success'),
        onError: () => showToast('Failed to update column', 'error'),
      },
    )
  }

  function addColumn(name: string) {
    mutations.addColumn.mutate(
      { name, optimisticId: -Date.now() },
      {
        onSuccess: () => showToast('Column created', 'success'),
        onError: () => showToast('Failed to create column', 'error'),
      },
    )
  }

  function deleteColumn() {
    if (!deleteTargetColumn) return
    setDeleteColumnError('')
    mutations.removeColumn.mutate(deleteTargetColumn, {
      onSuccess: () => setDeleteTargetColumn(null),
      onError: (err) => setDeleteColumnError(String(err)),
    })
  }

  // Labels and priority levels typed into a task that do not exist yet are added to the board.
  function createLabel(name: string) {
    return catalogMutations.addLabel.mutateAsync({ name, color: nextLabelColor(snapshot?.labels ?? []) })
  }

  function createPriority(name: string) {
    return catalogMutations.addPriority.mutateAsync({ name })
  }

  function createTask(draft: TaskDraft, assigneeIds: string[], roleIds: string[], labelIds: number[]) {
    if (!createInColumn || !me) return
    const columnTasks = tasksByColumn[createInColumn.columnId] ?? []
    const position = columnTasks.reduce((max, task) => Math.max(max, Number(task.position ?? 0)), 0) + 1
    setCreateTaskError('')
    mutations.addTask.mutate(
      {
        columnId: createInColumn.columnId,
        position,
        fields: taskFieldsFromDraft(draft),
        assigneeIds,
        roleIds,
        labelIds,
        optimisticId: -Date.now(),
        createdBy: me.userId,
      },
      {
        onSuccess: ({ extrasFailed }) => {
          if (extrasFailed) showToast('Task created, but some assignees or labels could not be added', 'error')
          setCreateInColumn(null)
          showToast('Task created', 'success')
        },
        onError: (err) => {
          setCreateTaskError(String(err))
          showToast('Failed to create task', 'error')
        },
      },
    )
  }

  async function saveTask(task: TaskEntry, fields: TaskFields) {
    await mutations.editTask.mutateAsync({ task, fields })
    showToast('Task updated', 'success')
  }

  function deleteTask() {
    if (!deleteTargetTask) return
    setDeleteTaskError('')
    mutations.removeTask.mutate(deleteTargetTask, {
      onSuccess: () => {
        setDeleteTargetTask(null)
        setSelectedTaskId(null)
        showToast('Task deleted', 'success')
      },
      onError: (err) => setDeleteTaskError(String(err)),
    })
  }

  function assign(task: TaskEntry, userId: string) {
    const alreadyAssigned = (snapshot?.assignments ?? []).some(
      (assignment) => assignment.taskId === task.taskId && String(assignment.userId) === userId,
    )
    return alreadyAssigned ? Promise.resolve() : mutations.assign.mutateAsync({ taskId: task.taskId, userId })
  }

  function unassign(task: TaskEntry, assignee: AssigneeMember) {
    const assignment = (snapshot?.assignments ?? []).find(
      (entry) => entry.taskId === task.taskId && String(entry.userId) === assignee.userId,
    )
    return assignment
      ? mutations.unassign.mutateAsync({ taskId: task.taskId, assignmentId: assignment.id })
      : Promise.resolve()
  }

  const loadError = !hasContext
    ? 'Missing board context. Please open a board from the dashboard.'
    : session.status === 'signedOut'
      ? 'You are signed out. Sign in from the dashboard to open this board.'
      : revokedReason === 'BOARD_DELETED'
        ? 'This board was deleted.'
        : revokedReason === 'ACCESS_LOST'
          ? 'You no longer have access to this board.'
          : snapshotQuery.isError || meQuery.isError
            ? `Failed to load board: ${readableError(snapshotQuery.error ?? meQuery.error, 'unknown error')}`
            : ''
  const loading = hasContext && !loadError && !ready
  const deleteColumnTaskCount = deleteTargetColumn ? (tasksByColumn[deleteTargetColumn.columnId] ?? []).length : 0

  return (
    <>
      <div className="kc-dashboard-root" onDragOver={drag.rowDragOver} onDrop={drag.rowDrop}>
        <DashboardHeader
          isAuthenticated={Boolean(me)}
          me={me}
          loading={loading}
          subtitle="Board"
          onBrandClick={() => navigate('/')}
          onLogout={() => void signOut().finally(() => navigate('/'))}
          onLogin={() => navigate('/')}
        />

        <div className="kc-board-subbar" role="banner" aria-label="Board title bar">
          <h2>{board?.name ?? 'Board'}</h2>
          {board?.isArchived && <span className="kc-board-archived-badge">Archived</span>}
          {ready && canOpenSettings && (
            <button
              type="button"
              className="kc-icon-btn kc-board-settings-btn"
              aria-label="Board settings"
              title="Board settings"
              onClick={() => setShowSettings(true)}
            >
              <FiSettings aria-hidden="true" />
            </button>
          )}
        </div>

        <main className="kc-content kc-board-page">
          {loading && (
            <div className="kc-loading-state" aria-live="polite" aria-busy="true">
              <span className="kc-spinner" aria-hidden="true" />
              <span className="kc-muted">Loading board...</span>
            </div>
          )}

          {loadError && <p className="kc-banner">{loadError}</p>}

          {ready && board?.isArchived && (
            <p className="kc-banner kc-banner--success">
              This board is archived. All columns and tasks are view-only until the board is restored.
            </p>
          )}

          {ready && board && (
            <section className="kc-board-page-columns" aria-label="Board columns">
              {openMenuColumnId !== null && (
                <div className="kc-column-menu-backdrop" onClick={() => setOpenMenuColumnId(null)} />
              )}

              {columns.length === 0 && !abilities.createColumn && (
                <p className="kc-muted">No columns found on this board.</p>
              )}

              {drag.columnsForRender.map((column) => (
                <BoardColumn
                  key={column.columnId}
                  column={column}
                  tasks={drag.tasksForRender[column.columnId] ?? []}
                  assigneesByTaskId={assigneesByTaskId}
                  labelsByTaskId={labelsByTaskId}
                  prioritiesById={prioritiesById}
                  rolesByTaskId={rolesByTaskId}
                  selectedTaskId={selectedTaskId}
                  canEdit={abilities.editColumn}
                  canDelete={abilities.deleteColumn}
                  canMove={abilities.moveColumn}
                  canCreateTask={abilities.createTask}
                  canMoveTasks={abilities.moveTask}
                  menuOpen={openMenuColumnId === column.columnId}
                  isDragPlaceholder={drag.draggedColumnId === column.columnId}
                  draggedTaskId={drag.draggedTaskId}
                  draggedTaskHeight={drag.draggedTaskHeight}
                  isTaskDropTarget={drag.taskDropColumnId === column.columnId}
                  justDragged={drag.justDragged}
                  onRename={(name) => renameColumn(column, name)}
                  onToggleMenu={() => setOpenMenuColumnId((prev) => (prev === column.columnId ? null : column.columnId))}
                  onRequestDelete={() => {
                    setDeleteTargetColumn(column)
                    setOpenMenuColumnId(null)
                    setDeleteColumnError('')
                  }}
                  onAddTask={() => {
                    setCreateTaskError('')
                    setCreateInColumn(column)
                  }}
                  onOpenTask={(task) => setSelectedTaskId(task.taskId)}
                  onColumnDragStart={(event) => {
                    setOpenMenuColumnId(null)
                    drag.columnDragStart(event, column.columnId)
                  }}
                  onColumnDragEnd={drag.columnDragEnd}
                  onTaskDragStart={drag.taskDragStart}
                  onTaskDragEnd={drag.taskDragEnd}
                  onTaskDragOver={(event) => drag.taskDragOver(event, column.columnId)}
                  onTaskDrop={(event) => drag.taskDrop(event, column.columnId)}
                />
              ))}

              {abilities.createColumn && <AddColumn onAdd={addColumn} />}
            </section>
          )}
        </main>

        {selectedTask && (
          <TaskPanel
            key={selectedTask.taskId}
            serverId={serverId}
            boardId={boardId}
            task={selectedTask}
            me={me}
            abilities={abilities}
            assignees={assigneesByTaskId[selectedTask.taskId] ?? []}
            members={members}
            priorities={snapshot?.priorities ?? []}
            labels={snapshot?.labels ?? []}
            taskLabels={labelsByTaskId.get(selectedTask.taskId) ?? []}
            roles={roles}
            taskRoles={rolesByTaskId.get(selectedTask.taskId) ?? []}
            saving={mutations.editTask.isPending}
            onClose={() => setSelectedTaskId(null)}
            onSave={(fields) => saveTask(selectedTask, fields)}
            onRequestDelete={() => {
              setDeleteTargetTask(selectedTask)
              setDeleteTaskError('')
            }}
            onAssign={(userId) => assign(selectedTask, userId)}
            onUnassign={(assignee) => unassign(selectedTask, assignee)}
            onAssignRole={(roleId) => mutations.assignRole.mutateAsync({ taskId: selectedTask.taskId, roleId })}
            onUnassignRole={(assignmentId) =>
              mutations.unassignRole.mutateAsync({ taskId: selectedTask.taskId, assignmentId })
            }
            onAddLabel={(labelId) => mutations.labelTask.mutateAsync({ taskId: selectedTask.taskId, labelId })}
            onRemoveLabel={(taskLabelId) =>
              mutations.unlabelTask.mutateAsync({ taskId: selectedTask.taskId, taskLabelId })
            }
            onCreateLabel={createLabel}
            onCreatePriority={createPriority}
          />
        )}

        {createInColumn && (
          <CreateTaskModal
            serverId={serverId}
            boardId={boardId}
            column={createInColumn}
            me={me}
            canAssignSelf={abilities.assignSelf}
            canAssignOthers={abilities.assignOthers}
            members={members}
            directory={directory}
            priorities={snapshot?.priorities ?? []}
            labels={snapshot?.labels ?? []}
            canApplyLabels={abilities.applyLabel}
            canCreateLabels={abilities.createLabel}
            canCreatePriorities={abilities.managePriorities}
            features={abilities.features}
            roles={roles}
            onCreateLabel={createLabel}
            onCreatePriority={createPriority}
            creating={mutations.addTask.isPending}
            error={createTaskError}
            onClose={() => setCreateInColumn(null)}
            onCreate={createTask}
          />
        )}

        {showSettings && (
          <BoardSettingsDialog
            serverId={serverId}
            boardId={boardId}
            onClose={() => setShowSettings(false)}
            onDeleted={() => navigate('/')}
            showToast={showToast}
            showError={(text) => showToast(text, 'error')}
          />
        )}

        {deleteTargetTask && (
          <ConfirmDialog
            title="Delete Task"
            error={deleteTaskError}
            busy={mutations.removeTask.isPending}
            onCancel={() => {
              setDeleteTargetTask(null)
              setDeleteTaskError('')
            }}
            onConfirm={deleteTask}
          >
            <p className="kc-modal-confirm-desc">
              Delete <strong>{deleteTargetTask.title}</strong>? This cannot be undone.
            </p>
          </ConfirmDialog>
        )}

        {deleteTargetColumn && (
          <ConfirmDialog
            title="Delete Column"
            error={deleteColumnError}
            busy={mutations.removeColumn.isPending}
            onCancel={() => {
              setDeleteTargetColumn(null)
              setDeleteColumnError('')
            }}
            onConfirm={deleteColumn}
          >
            <p className="kc-modal-confirm-desc">
              Delete <strong>{deleteTargetColumn.name}</strong>? This cannot be undone.
            </p>
            {deleteColumnTaskCount > 0 && (
              <p className="kc-modal-confirm-desc">
                This will also delete {deleteColumnTaskCount} {deleteColumnTaskCount === 1 ? 'task' : 'tasks'} in this
                column.
              </p>
            )}
          </ConfirmDialog>
        )}
      </div>
      <ToastStack toasts={toasts} />
    </>
  )
}
