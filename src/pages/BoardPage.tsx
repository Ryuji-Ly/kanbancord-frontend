import { Suspense, useEffect, useMemo, useState } from 'react'
import { filtersFromParams, isFiltering, matchesFilters, paramsWithFilters, type BoardFilters } from '../features/board/boardFilters'
import { BoardFilterBar } from '../features/board/components/BoardFilterBar'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { readableError } from '../api/http'
import { t } from '../i18n'
import { Trans } from '../i18n/Trans'
import { signOut, useSession } from '../api/session'
import type { BoardColumnEntry } from '../services/boardColumnsService'
import type { TaskEntry } from '../services/tasksService'
import { DashboardHeader } from '../components/dashboard/DashboardHeader'
import { BoardActionsMenu } from '../components/dashboard/boards/BoardActionsMenu'
import { ToastStack } from '../components/dashboard/ToastStack'
import { useToasts } from '../hooks/useToasts'
import {
  archivedTaskAbilities,
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
  boardKeys,
  taskFieldsFromDraft,
  useArchivedTasks,
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
import { usePreferences } from '../features/preferences/usePreferences'
import { TaskPanel } from '../features/board/components/TaskPanel'
import { lazyNamed } from '../components/lazyNamed'

// Opens on a click: loaded then.
const BoardSettingsDialog = lazyNamed(() => import('../features/boardSettings/BoardSettingsDialog'), 'BoardSettingsDialog')

export function BoardPage() {
  const { boardId = '' } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
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
  // Archiving and deleting are in the ⋯ menu, so they alone do not make the settings worth opening.
  const settingsAccess = boardSettingsAccess(snapshot?.permissions, snapshot?.features)
  const canOpenSettings = hasAnySetting({ ...settingsAccess, archive: false, delete: false })
  const queryClient = useQueryClient()
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
  const [archiveTargetColumn, setArchiveTargetColumn] = useState<BoardColumnEntry | null>(null)
  const [archiveColumnError, setArchiveColumnError] = useState('')

  // Search and filters, kept in the address so a filtered board can be shared.
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams])
  const filtering = isFiltering(filters)
  const setFilters = (next: BoardFilters) => setSearchParams(paramsWithFilters(searchParams, next), { replace: true })
  const showingArchived = filters.archived === 'only'

  // The panel shows the task as currently cached, so remote changes appear and a deleted task closes it.
  // Archived tasks are not in the snapshot: they are loaded when shown, or when a link opens one.
  const selectedOnBoard = snapshot?.tasks.find((task) => task.taskId === selectedTaskId) ?? null
  const archivedQuery = useArchivedTasks(
    serverId,
    boardId,
    ready && (showingArchived || (selectedTaskId !== null && !selectedOnBoard)),
  )
  const archivedTasks = useMemo(() => archivedQuery.data ?? [], [archivedQuery.data])
  const archivedByColumn = useMemo(() => groupTasksByColumn(archivedTasks), [archivedTasks])
  const selectedTask = selectedOnBoard ?? archivedTasks.find((task) => task.taskId === selectedTaskId) ?? null

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

  const peopleOnBoard = useMemo(() => {
    const unique = new Map<string, AssigneeMember>()
    Object.values(assigneesByTaskId).flat().forEach((person) => unique.set(person.userId, person))
    return [...unique.values()].sort((a, b) => (a.nickname ?? a.displayName).localeCompare(b.nickname ?? b.displayName))
  }, [assigneesByTaskId])
  const taskMatches = useMemo(() => {
    const facts = {
      assigneeIds: (taskId: number) => (assigneesByTaskId[taskId] ?? []).map((person) => person.userId),
      labelIds: (taskId: number) => (labelsByTaskId.get(taskId) ?? []).map((entry: { label: { labelId: number } }) => entry.label.labelId),
      myId: me ? String(me.userId) : null,
      now: new Date(),
    }
    return (task: TaskEntry) => matchesFilters(task, filters, facts)
  }, [filters, assigneesByTaskId, labelsByTaskId, me])
  const listedTasks = showingArchived ? archivedTasks : (snapshot?.tasks ?? [])
  const totalTaskCount = listedTasks.length
  const shownTaskCount = filtering ? listedTasks.filter(taskMatches).length : totalTaskCount

  const drag = useBoardDragAndDrop({
    columns,
    tasksByColumn,
    canMoveColumns: abilities.moveColumn,
    canMoveTasks: abilities.moveTask,
    onMoveColumn: (columnId, index) =>
      mutations.reorderColumn.mutate(
        { columnId, index },
        {
          onSuccess: () => showToast(t('board.toast.columnsReordered'), 'success'),
          onError: () => showToast(t('board.toast.reorderColumnsFailed'), 'error'),
        },
      ),
    onMoveTask: (taskId, columnId, index) =>
      mutations.relocateTask.mutate(
        { taskId, columnId, index },
        {
          onSuccess: () => showToast(t('board.toast.tasksReordered'), 'success'),
          onError: () => showToast(t('board.toast.reorderTasksFailed'), 'error'),
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
        onSuccess: () => showToast(t('board.toast.columnUpdated'), 'success'),
        onError: () => showToast(t('board.toast.updateColumnFailed'), 'error'),
      },
    )
  }

  function addColumn(name: string) {
    mutations.addColumn.mutate(
      { name, optimisticId: -Date.now() },
      {
        onSuccess: () => showToast(t('board.toast.columnCreated'), 'success'),
        onError: () => showToast(t('board.toast.createColumnFailed'), 'error'),
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
          if (extrasFailed) showToast(t('board.toast.taskCreatedPartly'), 'error')
          setCreateInColumn(null)
          showToast(t('board.toast.taskCreated'), 'success')
        },
        onError: (err) => {
          setCreateTaskError(String(err))
          showToast(t('board.toast.createTaskFailed'), 'error')
        },
      },
    )
  }

  async function saveTask(task: TaskEntry, fields: TaskFields) {
    await mutations.editTask.mutateAsync({ task, fields })
    showToast(t('board.toast.taskUpdated'), 'success')
  }

  function deleteTask() {
    if (!deleteTargetTask) return
    setDeleteTaskError('')
    mutations.removeTask.mutate(deleteTargetTask, {
      onSuccess: () => {
        setDeleteTargetTask(null)
        setSelectedTaskId(null)
        showToast(t('board.toast.taskDeleted'), 'success')
      },
      onError: (err) => setDeleteTaskError(String(err)),
    })
  }

  function setArchived(task: TaskEntry, archived: boolean) {
    mutations.archiveTask.mutate(
      { task, archived },
      {
        onSuccess: () => {
          // An archived task leaves the board, so its panel closes; a restored one stays open.
          if (archived && !showingArchived) setSelectedTaskId(null)
          showToast(archived ? t('board.toast.taskArchived') : t('board.toast.taskRestored'), 'success')
        },
        onError: (err) => showToast(readableError(err, t('board.page.unknownError')), 'error'),
      },
    )
  }

  function archiveColumn() {
    if (!archiveTargetColumn) return
    setArchiveColumnError('')
    mutations.archiveColumn.mutate(archiveTargetColumn, {
      onSuccess: (count) => {
        setArchiveTargetColumn(null)
        showToast(t('board.toast.tasksArchived', { count }), 'success')
      },
      onError: (err) => setArchiveColumnError(String(err)),
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
    ? t('board.page.noContext')
    : session.status === 'signedOut'
      ? t('board.page.signedOut')
      : revokedReason === 'BOARD_DELETED'
        ? t('board.page.deleted')
        : revokedReason === 'ACCESS_LOST'
          ? t('board.page.accessLost')
          : snapshotQuery.isError || meQuery.isError
            ? t('board.page.loadFailed', {
                error: readableError(snapshotQuery.error ?? meQuery.error, t('board.page.unknownError')),
              })
            : ''
  const loading = hasContext && !loadError && !ready
  const deleteColumnTaskCount = deleteTargetColumn ? (tasksByColumn[deleteTargetColumn.columnId] ?? []).length : 0
  const archiveColumnTaskCount = archiveTargetColumn ? (tasksByColumn[archiveTargetColumn.columnId] ?? []).length : 0

  return (
    <>
      <div className="kc-dashboard-root" onDragOver={drag.rowDragOver} onDrop={drag.rowDrop}>
        <DashboardHeader
          isAuthenticated={Boolean(me)}
          me={me}
          loading={loading}
          subtitle={t('board.page.board')}
          onBrandClick={() => navigate('/')}
          onLogout={() => void signOut().finally(() => navigate('/'))}
          onLogin={() => navigate('/')}
        />

        <div className="kc-board-subbar" role="banner" aria-label={t('board.page.titleBar')}>
          <h2>{board?.name ?? t('board.page.board')}</h2>
          {board?.isArchived && <span className="kc-board-archived-badge">{t('board.page.archived')}</span>}
          {ready && board && (
            <BoardFilterBar
              filters={filters}
              onChange={setFilters}
              features={shown}
              people={peopleOnBoard}
              labels={snapshot?.labels ?? []}
              priorities={snapshot?.priorities ?? []}
              shownCount={shownTaskCount}
              totalCount={totalTaskCount}
            />
          )}
          {ready && board && (
            <BoardActionsMenu
              serverId={serverId}
              board={board}
              canOpenSettings={canOpenSettings}
              canArchive={settingsAccess.archive}
              canDelete={settingsAccess.delete}
              onOpenSettings={() => setShowSettings(true)}
              onChanged={() => void queryClient.invalidateQueries({ queryKey: boardKeys.all(serverId, boardId) })}
              onDeleted={() => navigate('/')}
              showToast={showToast}
              showError={(text) => showToast(text, 'error')}
            />
          )}
        </div>

        <main className="kc-content kc-board-page">
          {loading && (
            <div className="kc-loading-state" aria-live="polite" aria-busy="true">
              <span className="kc-spinner" aria-hidden="true" />
              <span className="kc-muted">{t('board.page.loading')}</span>
            </div>
          )}

          {loadError && <p className="kc-banner">{loadError}</p>}

          {ready && board?.isArchived && (
            <p className="kc-banner kc-banner--success">
              {t('board.page.archivedBanner')}
            </p>
          )}

          {ready && showingArchived && (
            <p className="kc-banner kc-banner--success kc-archived-tasks-banner">
              <span>{archivedQuery.isPending ? t('board.page.loadingArchived') : t('board.page.showingArchived')}</span>
              <button type="button" className="kc-btn kc-btn-small kc-btn-ghost" onClick={() => setFilters({ ...filters, archived: '' })}>
                {t('board.page.backToBoard')}
              </button>
            </p>
          )}

          {ready && board && (
            <section className="kc-board-page-columns" aria-label={t('board.page.columns')}>
              {openMenuColumnId !== null && (
                <div className="kc-column-menu-backdrop" onClick={() => setOpenMenuColumnId(null)} />
              )}

              {columns.length === 0 && !abilities.createColumn && (
                <p className="kc-muted">{t('board.page.noColumns')}</p>
              )}

              {drag.columnsForRender.map((column) => (
                <BoardColumn
                  key={column.columnId}
                  column={column}
                  tasks={showingArchived
                    ? (archivedByColumn[column.columnId] ?? []).filter(taskMatches)
                    : filtering
                      ? (drag.tasksForRender[column.columnId] ?? []).filter(taskMatches)
                      : (drag.tasksForRender[column.columnId] ?? [])}
                  assigneesByTaskId={assigneesByTaskId}
                  labelsByTaskId={labelsByTaskId}
                  prioritiesById={prioritiesById}
                  rolesByTaskId={rolesByTaskId}
                  selectedTaskId={selectedTaskId}
                  canEdit={abilities.editColumn}
                  canDelete={abilities.deleteColumn}
                  canMove={abilities.moveColumn}
                  canCreateTask={abilities.createTask && !showingArchived}
                  // With some tasks hidden, a drop position would be ambiguous: dragging waits for no filters.
                  canMoveTasks={abilities.moveTask && !filtering}
                  canArchiveTasks={abilities.archiveTask && !showingArchived && (tasksByColumn[column.columnId] ?? []).length > 0}
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
                  onRequestArchiveTasks={() => {
                    setArchiveTargetColumn(column)
                    setOpenMenuColumnId(null)
                    setArchiveColumnError('')
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
            abilities={selectedTask.isArchived ? archivedTaskAbilities(abilities) : abilities}
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
            onSetArchived={(archived) => setArchived(selectedTask, archived)}
            archiving={mutations.archiveTask.isPending}
            onAssign={(userId) => assign(selectedTask, userId)}
            onUnassign={(assignee) => unassign(selectedTask, assignee)}
            onAssignRole={(roleId) => mutations.assignRole.mutateAsync({ taskId: selectedTask.taskId, roleId })}
            onUnassignRole={(assignmentId) =>
              mutations.unassignRole.mutateAsync({ taskId: selectedTask.taskId, assignmentId })
            }
            following={(snapshot?.followedTaskIds ?? []).includes(selectedTask.taskId)}
            onToggleFollow={(following) => mutations.follow.mutateAsync({ taskId: selectedTask.taskId, following })}
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
          <Suspense fallback={null}>
            <BoardSettingsDialog
              serverId={serverId}
              boardId={boardId}
              onClose={() => setShowSettings(false)}
              onDeleted={() => navigate('/')}
              showToast={showToast}
              showError={(text) => showToast(text, 'error')}
            />
          </Suspense>
        )}

        {deleteTargetTask && (
          <ConfirmDialog
            title={t('board.page.deleteTask')}
            error={deleteTaskError}
            busy={mutations.removeTask.isPending}
            onCancel={() => {
              setDeleteTargetTask(null)
              setDeleteTaskError('')
            }}
            onConfirm={deleteTask}
          >
            <p className="kc-modal-confirm-desc">
              <Trans k="board.page.deleteConfirm" values={{ name: deleteTargetTask.title }} />
            </p>
          </ConfirmDialog>
        )}

        {archiveTargetColumn && (
          <ConfirmDialog
            title={t('board.page.archiveColumnTasks')}
            confirmLabel={t('board.page.archiveColumnTasks')}
            busyLabel={t('common.applying')}
            error={archiveColumnError}
            busy={mutations.archiveColumn.isPending}
            onCancel={() => {
              setArchiveTargetColumn(null)
              setArchiveColumnError('')
            }}
            onConfirm={archiveColumn}
          >
            <p className="kc-modal-confirm-desc">
              <Trans k="board.page.archiveColumnConfirm" values={{ name: archiveTargetColumn.name, count: archiveColumnTaskCount }} />
            </p>
          </ConfirmDialog>
        )}

        {deleteTargetColumn && (
          <ConfirmDialog
            title={t('board.page.deleteColumn')}
            error={deleteColumnError}
            busy={mutations.removeColumn.isPending}
            onCancel={() => {
              setDeleteTargetColumn(null)
              setDeleteColumnError('')
            }}
            onConfirm={deleteColumn}
          >
            <p className="kc-modal-confirm-desc">
              <Trans k="board.page.deleteConfirm" values={{ name: deleteTargetColumn.name }} />
            </p>
            {deleteColumnTaskCount > 0 && (
              <p className="kc-modal-confirm-desc">
                {t('board.page.deleteColumnTasks', { count: deleteColumnTaskCount })}
              </p>
            )}
          </ConfirmDialog>
        )}
      </div>
      <ToastStack toasts={toasts} />
    </>
  )
}
