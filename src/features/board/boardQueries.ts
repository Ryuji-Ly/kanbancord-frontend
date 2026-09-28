import { useMutation, useQuery } from '@tanstack/react-query'
import { useOptimisticCache } from '../../api/useOptimisticCache'
import { fetchBoardSnapshot, type BoardSnapshot } from '../../services/boardsService'
import { createColumn, deleteColumn, moveColumn, updateColumn, type BoardColumnEntry } from '../../services/boardColumnsService'
import {
  assignTaskRole,
  createTaskAssignment,
  deleteTaskAssignment,
  unassignTaskRole,
} from '../../services/taskAssignmentsService'
import { addTaskLabel, createLabel, deleteLabel, removeTaskLabel, updateLabel } from '../../services/labelsService'
import { createPriority, deletePriority, movePriority, updatePriority } from '../../services/prioritiesService'
import {
  createTaskComment,
  deleteTaskComment,
  fetchTaskComments,
  updateTaskComment,
  type TaskCommentEntry,
} from '../../services/taskCommentsService'
import { createTask, deleteTask, moveTask, setTaskFollowing, updateTask, type TaskEntry } from '../../services/tasksService'
import { snapshotWithColumnMoved, snapshotWithTaskMoved, sortCommentsByCreatedAt, type TaskDraft } from './boardModel'

// ── Keys ─────────────────────────────────────────────────────────────────────

/** Everything cached for one board shares the prefix, so one invalidation refreshes all of it. */
export const boardKeys = {
  all: (serverId: string, boardId: string) => ['board', serverId, boardId] as const,
  snapshot: (serverId: string, boardId: string) => ['board', serverId, boardId, 'snapshot'] as const,
  comments: (serverId: string, boardId: string, taskId: number) =>
    ['board', serverId, boardId, 'comments', taskId] as const,
}

// ── Queries ──────────────────────────────────────────────────────────────────

export function useBoardSnapshot(serverId: string, boardId: string) {
  return useQuery({
    queryKey: boardKeys.snapshot(serverId, boardId),
    queryFn: () => fetchBoardSnapshot(serverId, boardId),
    enabled: Boolean(serverId && boardId),
  })
}

export function useTaskComments(serverId: string, boardId: string, taskId: number | null) {
  return useQuery({
    queryKey: boardKeys.comments(serverId, boardId, taskId ?? -1),
    queryFn: () => fetchTaskComments(serverId, boardId, taskId as number),
    enabled: taskId !== null,
    select: sortCommentsByCreatedAt,
  })
}

// ── Optimistic updates ───────────────────────────────────────────────────────

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
  priorityId: number | null
  dueDate: string | null
}

export function taskFieldsFromDraft(draft: TaskDraft, fallbackTitle = ''): TaskFields {
  return {
    title: draft.title.trim() || fallbackTitle,
    description: draft.description.trim() || null,
    priorityId: draft.priorityId,
    dueDate: draft.dueDate || null,
  }
}

// ── Board mutations ──────────────────────────────────────────────────────────

export function useBoardMutations(serverId: string, boardId: string) {
  const board = useOptimisticCache<BoardSnapshot>(boardKeys.snapshot(serverId, boardId))
  const settle = { onSettled: () => board.refresh() }

  const renameColumn = useMutation({
    // No position: sending one would also require MOVE_COLUMN.
    mutationFn: ({ column, name }: { column: BoardColumnEntry; name: string }) =>
      updateColumn(serverId, boardId, column.columnId, name, {
        color: column.color,
        wipLimit: column.wipLimit,
      }),
    onMutate: ({ column, name }) => board.apply((snapshot) => replaceColumn(snapshot, { ...column, name })),
    onError: (_error, _variables, context) => board.rollback(context),
    ...settle,
  })

  const addColumn = useMutation({
    mutationFn: ({ name }: { name: string; optimisticId: number }) =>
      createColumn(serverId, boardId, name),
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
    mutationFn: (column: BoardColumnEntry) => deleteColumn(serverId, boardId, column.columnId),
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
      moveColumn(serverId, boardId, columnId, index),
    onMutate: ({ columnId, index }) => board.apply((snapshot) => snapshotWithColumnMoved(snapshot, columnId, index)),
    onError: (_error, _variables, context) => board.rollback(context),
    ...settle,
  })

  const relocateTask = useMutation({
    mutationFn: ({ taskId, columnId, index }: { taskId: number; columnId: number; index: number }) =>
      moveTask(serverId, boardId, taskId, columnId, index),
    onMutate: ({ taskId, columnId, index }) =>
      board.apply((snapshot) => snapshotWithTaskMoved(snapshot, taskId, columnId, index)),
    onError: (_error, _variables, context) => board.rollback(context),
    ...settle,
  })

  const addTask = useMutation({
    /**
     * Creates the task, then assigns the chosen members and applies the chosen labels. A failed
     * assignment or label does not undo the task.
     */
    mutationFn: async (input: {
      columnId: number
      position: number
      fields: TaskFields
      assigneeIds: string[]
      roleIds: string[]
      labelIds: number[]
      optimisticId: number
      createdBy: string
    }) => {
      const created = await createTask(serverId, boardId, {
        ...input.fields,
        columnId: input.columnId,
        position: input.position,
      })
      const extras = await Promise.allSettled([
        ...input.assigneeIds.map((userId) => createTaskAssignment(serverId, boardId, created.taskId, userId)),
        ...input.roleIds.map((roleId) => assignTaskRole(serverId, boardId, created.taskId, roleId)),
        ...input.labelIds.map((labelId) => addTaskLabel(serverId, boardId, created.taskId, labelId)),
      ])
      return { created, extrasFailed: extras.some((result) => result.status === 'rejected') }
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
      updateTask(serverId, boardId, task.taskId, {
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
    mutationFn: (task: TaskEntry) => deleteTask(serverId, boardId, task.taskId),
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
      createTaskAssignment(serverId, boardId, taskId, userId),
    onSuccess: (created) =>
      board.set((snapshot) => ({ ...snapshot, assignments: [...snapshot.assignments, created] })),
    ...settle,
  })

  const assignRole = useMutation({
    mutationFn: ({ taskId, roleId }: { taskId: number; roleId: string }) =>
      assignTaskRole(serverId, boardId, taskId, roleId),
    onSuccess: (created) =>
      board.set((snapshot) => ({ ...snapshot, roleAssignments: [...snapshot.roleAssignments, created] })),
    ...settle,
  })

  const unassignRole = useMutation({
    mutationFn: ({ taskId, assignmentId }: { taskId: number; assignmentId: number }) =>
      unassignTaskRole(serverId, boardId, taskId, assignmentId),
    onMutate: ({ assignmentId }) =>
      board.apply((snapshot) => ({
        ...snapshot,
        roleAssignments: snapshot.roleAssignments.filter((assignment) => assignment.id !== assignmentId),
      })),
    onError: (_error, _variables, context) => board.rollback(context),
    ...settle,
  })

  const labelTask = useMutation({
    mutationFn: ({ taskId, labelId }: { taskId: number; labelId: number }) =>
      addTaskLabel(serverId, boardId, taskId, labelId),
    onSuccess: (created) => board.set((snapshot) => ({ ...snapshot, taskLabels: [...snapshot.taskLabels, created] })),
    ...settle,
  })

  const unlabelTask = useMutation({
    mutationFn: ({ taskId, taskLabelId }: { taskId: number; taskLabelId: number }) =>
      removeTaskLabel(serverId, boardId, taskId, taskLabelId),
    onMutate: ({ taskLabelId }) =>
      board.apply((snapshot) => ({
        ...snapshot,
        taskLabels: snapshot.taskLabels.filter((taskLabel) => taskLabel.id !== taskLabelId),
      })),
    onError: (_error, _variables, context) => board.rollback(context),
    ...settle,
  })

  const follow = useMutation({
    mutationFn: ({ taskId, following }: { taskId: number; following: boolean }) =>
      setTaskFollowing(serverId, boardId, taskId, following),
    onMutate: ({ taskId, following }) =>
      board.apply((snapshot) => {
        const others = (snapshot.followedTaskIds ?? []).filter((id) => id !== taskId)
        return { ...snapshot, followedTaskIds: following ? [...others, taskId] : others }
      }),
    onError: (_error, _variables, context) => board.rollback(context),
    ...settle,
  })

  const unassign = useMutation({
    mutationFn: ({ taskId, assignmentId }: { taskId: number; assignmentId: number }) =>
      deleteTaskAssignment(serverId, boardId, taskId, assignmentId),
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
    labelTask,
    unlabelTask,
    assignRole,
    unassignRole,
    removeTask,
    assign,
    unassign,
    follow,
  }
}

// ── Comment mutations ────────────────────────────────────────────────────────

export function useCommentMutations(serverId: string, boardId: string, taskId: number | null) {
  const comments = useOptimisticCache<TaskCommentEntry[]>(boardKeys.comments(serverId, boardId, taskId ?? -1))
  const settle = { onSettled: () => comments.refresh() }
  const currentTaskId = () => {
    if (taskId === null) throw new Error('No task is selected.')
    return taskId
  }

  const create = useMutation({
    mutationFn: (content: string) => createTaskComment(serverId, boardId, currentTaskId(), content),
    onSuccess: (created) => comments.set((current) => [...current, created]),
    ...settle,
  })

  const edit = useMutation({
    mutationFn: ({ commentId, content }: { commentId: number; content: string }) =>
      updateTaskComment(serverId, boardId, currentTaskId(), commentId, content),
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
    mutationFn: (commentId: number) => deleteTaskComment(serverId, boardId, currentTaskId(), commentId),
    onSuccess: (_result, commentId) =>
      comments.set((current) => current.filter((comment) => comment.commentId !== commentId)),
    ...settle,
  })

  return { create, edit, remove }
}

// ── Labels and priority levels of the board ──────────────────────────────────

/**
 * Managing the board's labels and priority levels, from the board settings or inline while editing
 * a task. Each change updates the cached board at once; the server's copy follows.
 */
export function useBoardCatalogMutations(serverId: string, boardId: string) {
  const board = useOptimisticCache<BoardSnapshot>(boardKeys.snapshot(serverId, boardId))
  const settle = { onSettled: () => board.refresh() }

  const addLabel = useMutation({
    mutationFn: (input: { name: string; color: string }) => createLabel(serverId, boardId, input),
    onSuccess: (created) => board.set((snapshot) => ({ ...snapshot, labels: [...snapshot.labels, created] })),
    ...settle,
  })

  const editLabel = useMutation({
    mutationFn: ({ labelId, ...input }: { labelId: number; name: string; color: string }) =>
      updateLabel(serverId, boardId, labelId, input),
    onSuccess: (updated) =>
      board.set((snapshot) => ({
        ...snapshot,
        labels: snapshot.labels.map((label) => (label.labelId === updated.labelId ? updated : label)),
      })),
    ...settle,
  })

  const removeLabel = useMutation({
    mutationFn: (labelId: number) => deleteLabel(serverId, boardId, labelId),
    onSuccess: (_result, labelId) =>
      board.set((snapshot) => ({
        ...snapshot,
        labels: snapshot.labels.filter((label) => label.labelId !== labelId),
        taskLabels: snapshot.taskLabels.filter((taskLabel) => taskLabel.labelId !== labelId),
      })),
    ...settle,
  })

  const addPriority = useMutation({
    mutationFn: (input: { name: string; color?: string }) => createPriority(serverId, boardId, input),
    onSuccess: (created) =>
      board.set((snapshot) => ({ ...snapshot, priorities: [...snapshot.priorities, created] })),
    ...settle,
  })

  const editPriority = useMutation({
    mutationFn: ({ priorityId, ...input }: { priorityId: number; name: string; color: string }) =>
      updatePriority(serverId, boardId, priorityId, input),
    onSuccess: (updated) =>
      board.set((snapshot) => ({
        ...snapshot,
        priorities: snapshot.priorities.map((level) => (level.priorityId === updated.priorityId ? updated : level)),
      })),
    ...settle,
  })

  const reorderPriority = useMutation({
    mutationFn: ({ priorityId, index }: { priorityId: number; index: number }) =>
      movePriority(serverId, boardId, priorityId, index),
    onMutate: ({ priorityId, index }) =>
      board.apply((snapshot) => {
        const moving = snapshot.priorities.find((level) => level.priorityId === priorityId)
        if (!moving) return snapshot
        const rest = snapshot.priorities.filter((level) => level.priorityId !== priorityId)
        rest.splice(index, 0, moving)
        return { ...snapshot, priorities: rest.map((level, i) => ({ ...level, position: i + 1 })) }
      }),
    onSuccess: (ordered) => board.set((snapshot) => ({ ...snapshot, priorities: ordered })),
    onError: (_error, _variables, context) => board.rollback(context),
    ...settle,
  })

  const removePriority = useMutation({
    mutationFn: (priorityId: number) => deletePriority(serverId, boardId, priorityId),
    onSuccess: (_result, priorityId) =>
      board.set((snapshot) => ({
        ...snapshot,
        priorities: snapshot.priorities
          .filter((level) => level.priorityId !== priorityId)
          .map((level, i) => ({ ...level, position: i + 1 })),
        tasks: snapshot.tasks.map((task) => (task.priorityId === priorityId ? { ...task, priorityId: null } : task)),
      })),
    ...settle,
  })

  return { addLabel, editLabel, removeLabel, addPriority, editPriority, reorderPriority, removePriority }
}
