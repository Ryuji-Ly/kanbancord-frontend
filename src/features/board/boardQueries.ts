import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getStoredToken } from '../../services/authService'
import { fetchMe } from '../../services/meService'
import { fetchBoardSnapshot, type BoardSnapshot } from '../../services/boardsService'
import { createColumn, deleteColumn, moveColumn, updateColumn, type BoardColumnEntry } from '../../services/boardColumnsService'
import { fetchServerMembers } from '../../services/serverMembersService'
import { createTaskAssignment, deleteTaskAssignment } from '../../services/taskAssignmentsService'
import {
  createTaskComment,
  deleteTaskComment,
  fetchTaskComments,
  updateTaskComment,
  type TaskCommentEntry,
} from '../../services/taskCommentsService'
import { createTask, deleteTask, moveTask, updateTask, type TaskEntry } from '../../services/tasksService'
import { snapshotWithColumnMoved, snapshotWithTaskMoved, sortCommentsByCreatedAt, type TaskDraft } from './boardModel'

// ── Keys ─────────────────────────────────────────────────────────────────────

/** Everything cached for one board shares the prefix, so one invalidation refreshes all of it. */
export const boardKeys = {
  all: (serverId: string, boardId: string) => ['board', serverId, boardId] as const,
  snapshot: (serverId: string, boardId: string) => ['board', serverId, boardId, 'snapshot'] as const,
  comments: (serverId: string, boardId: string, taskId: number) =>
    ['board', serverId, boardId, 'comments', taskId] as const,
}

const meKey = ['me'] as const
const serverMembersKey = (serverId: string) => ['server', serverId, 'members'] as const

function requireToken(): string {
  const token = getStoredToken()
  if (!token) throw new Error('You are not signed in.')
  return token
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function useMe() {
  return useQuery({ queryKey: meKey, queryFn: () => fetchMe(requireToken()), staleTime: 5 * 60_000 })
}

export function useBoardSnapshot(serverId: string, boardId: string) {
  return useQuery({
    queryKey: boardKeys.snapshot(serverId, boardId),
    queryFn: () => fetchBoardSnapshot(requireToken(), serverId, boardId),
    enabled: Boolean(serverId && boardId && getStoredToken()),
  })
}

export function useServerMembers(serverId: string, enabled: boolean) {
  return useQuery({
    queryKey: serverMembersKey(serverId),
    queryFn: () => fetchServerMembers(requireToken(), serverId),
    enabled: enabled && Boolean(serverId),
    staleTime: 5 * 60_000,
  })
}

export function useTaskComments(serverId: string, boardId: string, taskId: number | null) {
  return useQuery({
    queryKey: boardKeys.comments(serverId, boardId, taskId ?? -1),
    queryFn: () => fetchTaskComments(requireToken(), serverId, boardId, taskId as number),
    enabled: taskId !== null,
    select: sortCommentsByCreatedAt,
  })
}

// ── Optimistic updates ───────────────────────────────────────────────────────

type Rollback<T> = { previous: T | undefined }

/**
 * Applies a change to cached data before the server confirms it, restores the previous data if the
 * request fails, and refetches afterwards so the cache ends up as the server has it.
 */
function useOptimistic<T>(queryKey: readonly unknown[]) {
  const queryClient = useQueryClient()
  return {
    async apply(update: (current: T) => T): Promise<Rollback<T>> {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<T>(queryKey)
      if (previous !== undefined) queryClient.setQueryData<T>(queryKey, update(previous))
      return { previous }
    },
    rollback(context: Rollback<T> | undefined) {
      if (context?.previous !== undefined) queryClient.setQueryData<T>(queryKey, context.previous)
    },
    set(update: (current: T) => T) {
      queryClient.setQueryData<T>(queryKey, (current) => (current === undefined ? current : update(current)))
    },
    refresh() {
      return queryClient.invalidateQueries({ queryKey })
    },
  }
}

/** Replaces the task with id `taskId` (by default the task's own id, or a temporary one being confirmed). */
function replaceTask(snapshot: BoardSnapshot, task: TaskEntry, taskId = task.taskId): BoardSnapshot {
  return { ...snapshot, tasks: snapshot.tasks.map((entry) => (entry.taskId === taskId ? task : entry)) }
}

/** Replaces the column with id `columnId` (by default the column's own id, or a temporary one being confirmed). */
function replaceColumn(snapshot: BoardSnapshot, column: BoardColumnEntry, columnId = column.columnId): BoardSnapshot {
  return { ...snapshot, columns: snapshot.columns.map((entry) => (entry.columnId === columnId ? column : entry)) }
}

export type TaskFields = {
  title: string
  description: string | null
  priority: string | null
  dueDate: string | null
}

export function taskFieldsFromDraft(draft: TaskDraft, fallbackTitle = ''): TaskFields {
  return {
    title: draft.title.trim() || fallbackTitle,
    description: draft.description.trim() || null,
    priority: draft.priority.trim() || null,
    dueDate: draft.dueDate || null,
  }
}

// ── Board mutations ──────────────────────────────────────────────────────────

export function useBoardMutations(serverId: string, boardId: string) {
  const board = useOptimistic<BoardSnapshot>(boardKeys.snapshot(serverId, boardId))
  const settle = { onSettled: () => board.refresh() }

  const renameColumn = useMutation({
    // No position: sending one would also require MOVE_COLUMN.
    mutationFn: ({ column, name }: { column: BoardColumnEntry; name: string }) =>
      updateColumn(requireToken(), serverId, boardId, column.columnId, name, {
        color: column.color,
        wipLimit: column.wipLimit,
      }),
    onMutate: ({ column, name }) => board.apply((snapshot) => replaceColumn(snapshot, { ...column, name })),
    onError: (_error, _variables, context) => board.rollback(context),
    ...settle,
  })

  const addColumn = useMutation({
    mutationFn: ({ name }: { name: string; optimisticId: number }) =>
      createColumn(requireToken(), serverId, boardId, name),
    onMutate: ({ name, optimisticId }) =>
      board.apply((snapshot) => ({
        ...snapshot,
        columns: [
          ...snapshot.columns,
          {
            columnId: optimisticId,
            boardId: Number(boardId),
            name,
            position: snapshot.columns.length + 1,
            color: null,
            wipLimit: null,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      })),
    onSuccess: (created, { optimisticId }) =>
      board.set((snapshot) => replaceColumn(snapshot, created, optimisticId)),
    onError: (_error, _variables, context) => board.rollback(context),
    ...settle,
  })

  const removeColumn = useMutation({
    mutationFn: (column: BoardColumnEntry) => deleteColumn(requireToken(), serverId, boardId, column.columnId),
    onSuccess: (_result, column) =>
      board.set((snapshot) => ({
        ...snapshot,
        columns: snapshot.columns.filter((entry) => entry.columnId !== column.columnId),
        tasks: snapshot.tasks.filter((task) => task.columnId !== column.columnId),
      })),
    ...settle,
  })

  const reorderColumn = useMutation({
    mutationFn: ({ columnId, index }: { columnId: number; index: number }) =>
      moveColumn(requireToken(), serverId, boardId, columnId, index),
    onMutate: ({ columnId, index }) => board.apply((snapshot) => snapshotWithColumnMoved(snapshot, columnId, index)),
    onError: (_error, _variables, context) => board.rollback(context),
    ...settle,
  })

  const relocateTask = useMutation({
    mutationFn: ({ taskId, columnId, index }: { taskId: number; columnId: number; index: number }) =>
      moveTask(requireToken(), serverId, boardId, taskId, columnId, index),
    onMutate: ({ taskId, columnId, index }) =>
      board.apply((snapshot) => snapshotWithTaskMoved(snapshot, taskId, columnId, index)),
    onError: (_error, _variables, context) => board.rollback(context),
    ...settle,
  })

  const addTask = useMutation({
    /** Creates the task, then assigns the chosen members; a failed assignment does not undo the task. */
    mutationFn: async (input: {
      columnId: number
      position: number
      fields: TaskFields
      assigneeIds: string[]
      optimisticId: number
      createdBy: string
    }) => {
      const token = requireToken()
      const created = await createTask(token, serverId, boardId, {
        ...input.fields,
        columnId: input.columnId,
        position: input.position,
      })
      const assigned = await Promise.allSettled(
        input.assigneeIds.map((userId) => createTaskAssignment(token, serverId, boardId, created.taskId, userId)),
      )
      return { created, assignmentFailed: assigned.some((result) => result.status === 'rejected') }
    },
    onMutate: (input) =>
      board.apply((snapshot) => {
        const now = new Date().toISOString()
        const optimistic: TaskEntry = {
          taskId: input.optimisticId,
          boardId: Number(boardId),
          columnId: input.columnId,
          position: input.position,
          ...input.fields,
          isArchived: false,
          metadata: null,
          createdBy: input.createdBy,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        }
        return { ...snapshot, tasks: [...snapshot.tasks, optimistic] }
      }),
    onSuccess: ({ created }, { optimisticId }) =>
      board.set((snapshot) => replaceTask(snapshot, created, optimisticId)),
    onError: (_error, _variables, context) => board.rollback(context),
    ...settle,
  })

  const editTask = useMutation({
    mutationFn: ({ task, fields }: { task: TaskEntry; fields: TaskFields }) =>
      updateTask(requireToken(), serverId, boardId, task.taskId, {
        ...fields,
        columnId: task.columnId,
        position: task.position,
      }),
    onMutate: ({ task, fields }) => board.apply((snapshot) => replaceTask(snapshot, { ...task, ...fields })),
    onSuccess: (updated) => board.set((snapshot) => replaceTask(snapshot, updated)),
    onError: (_error, _variables, context) => board.rollback(context),
    ...settle,
  })

  const removeTask = useMutation({
    mutationFn: (task: TaskEntry) => deleteTask(requireToken(), serverId, boardId, task.taskId),
    onSuccess: (_result, task) =>
      board.set((snapshot) => ({
        ...snapshot,
        tasks: snapshot.tasks.filter((entry) => entry.taskId !== task.taskId),
        assignments: snapshot.assignments.filter((assignment) => assignment.taskId !== task.taskId),
      })),
    ...settle,
  })

  const assign = useMutation({
    mutationFn: ({ taskId, userId }: { taskId: number; userId: string }) =>
      createTaskAssignment(requireToken(), serverId, boardId, taskId, userId),
    onSuccess: (created) =>
      board.set((snapshot) => ({ ...snapshot, assignments: [...snapshot.assignments, created] })),
    ...settle,
  })

  const unassign = useMutation({
    mutationFn: ({ taskId, assignmentId }: { taskId: number; assignmentId: number }) =>
      deleteTaskAssignment(requireToken(), serverId, boardId, taskId, assignmentId),
    onMutate: ({ assignmentId }) =>
      board.apply((snapshot) => ({
        ...snapshot,
        assignments: snapshot.assignments.filter((assignment) => assignment.id !== assignmentId),
      })),
    onError: (_error, _variables, context) => board.rollback(context),
    ...settle,
  })

  return {
    renameColumn,
    addColumn,
    removeColumn,
    reorderColumn,
    relocateTask,
    addTask,
    editTask,
    removeTask,
    assign,
    unassign,
  }
}

// ── Comment mutations ────────────────────────────────────────────────────────

export function useCommentMutations(serverId: string, boardId: string, taskId: number | null) {
  const comments = useOptimistic<TaskCommentEntry[]>(boardKeys.comments(serverId, boardId, taskId ?? -1))
  const settle = { onSettled: () => comments.refresh() }
  const currentTaskId = () => {
    if (taskId === null) throw new Error('No task is selected.')
    return taskId
  }

  const create = useMutation({
    mutationFn: (content: string) => createTaskComment(requireToken(), serverId, boardId, currentTaskId(), content),
    onSuccess: (created) => comments.set((current) => [...current, created]),
    ...settle,
  })

  const edit = useMutation({
    mutationFn: ({ commentId, content }: { commentId: number; content: string }) =>
      updateTaskComment(requireToken(), serverId, boardId, currentTaskId(), commentId, content),
    onMutate: ({ commentId, content }) =>
      comments.apply((current) =>
        current.map((comment) => (comment.commentId === commentId ? { ...comment, content } : comment)),
      ),
    onSuccess: (updated) =>
      comments.set((current) =>
        current.map((comment) => (comment.commentId === updated.commentId ? updated : comment)),
      ),
    onError: (_error, _variables, context) => comments.rollback(context),
    ...settle,
  })

  const remove = useMutation({
    mutationFn: (commentId: number) => deleteTaskComment(requireToken(), serverId, boardId, currentTaskId(), commentId),
    onSuccess: (_result, commentId) =>
      comments.set((current) => current.filter((comment) => comment.commentId !== commentId)),
    ...settle,
  })

  return { create, edit, remove }
}
