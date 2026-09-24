import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useOptimisticCache } from '../../api/useOptimisticCache'
import { archiveBoard, createBoard, deleteBoard, updateBoard } from '../../services/boardsService'
import {
  createPermission,
  deletePermission,
  fetchScopedPermissions,
  updatePermissionState,
  type PermissionEntry,
} from '../../services/permissionsService'
import { boardPermissionOverrides, diffBoardPermissions } from '../../components/dashboard/boards/boardPermissionDraft'
import { requireToken, serverKeys } from '../server/serverQueries'

type RuleState = 'ALLOW' | 'DENY'

export type NewServerRule = {
  subjectType: string
  subjectId: string
  kanbanPermissionId: number
  state: RuleState
  priority: number
}

export type BoardSave = {
  /** Absent when creating a board. */
  boardId?: string
  details?: { name: string; description: string; columnNames: string[] }
  /** The board's rules as drafted, including those inherited from the server. */
  permissions?: PermissionEntry[]
}

/**
 * Brings a board's stored rules in line with a draft. Boards inherit server rules, so only entries
 * that differ from what they inherit are stored; stored rules that no longer differ are removed.
 */
async function reconcileBoardPermissions(serverId: string, boardId: string, desired: PermissionEntry[]) {
  const token = requireToken()
  const existing = await fetchScopedPermissions(token, serverId, 'BOARD', boardId)
  const { toDelete, toToggle, toCreate } = diffBoardPermissions(existing, boardPermissionOverrides(desired))

  await Promise.all([
    ...toDelete.map((permission) => deletePermission(token, serverId, permission.id)),
    ...toToggle.map((permission) => updatePermissionState(token, serverId, permission.permissionId, permission.newState)),
    ...toCreate.map((permission) =>
      createPermission(token, serverId, {
        scopeType: 'BOARD',
        scopeId: boardId,
        subjectType: permission.subjectType,
        subjectId: permission.subjectId,
        kanbanPermissionId: permission.kanbanPermissionId,
        state: permission.state,
        priority: permission.priority,
        isImmutable: false,
      }),
    ),
  ])
}

/**
 * Changes to a server's permission rules and boards. Rule changes can change what the user may do,
 * so every change refreshes everything cached for the server afterwards.
 */
export function useServerMutations(serverId: string) {
  const queryClient = useQueryClient()
  const rules = useOptimisticCache<PermissionEntry[]>(serverKeys.permissions(serverId))
  const settle = { onSettled: () => queryClient.invalidateQueries({ queryKey: serverKeys.all(serverId) }) }

  const setRuleState = useMutation({
    mutationFn: ({ permissionId, state }: { permissionId: number; state: RuleState }) =>
      updatePermissionState(requireToken(), serverId, permissionId, state),
    onMutate: ({ permissionId, state }) =>
      rules.apply((current) => current.map((rule) => (rule.id === permissionId ? { ...rule, state } : rule))),
    onError: (_error, _variables, context) => rules.rollback(context),
    ...settle,
  })

  const removeRule = useMutation({
    mutationFn: (permissionId: number) => deletePermission(requireToken(), serverId, permissionId),
    onMutate: (permissionId) => rules.apply((current) => current.filter((rule) => rule.id !== permissionId)),
    onError: (_error, _variables, context) => rules.rollback(context),
    ...settle,
  })

  const removeRules = useMutation({
    mutationFn: (permissionIds: number[]) =>
      Promise.all(permissionIds.map((id) => deletePermission(requireToken(), serverId, id))),
    ...settle,
  })

  const addRules = useMutation({
    mutationFn: (newRules: NewServerRule[]) =>
      Promise.all(
        newRules.map((rule) =>
          createPermission(requireToken(), serverId, {
            scopeType: 'SERVER',
            scopeId: serverId,
            ...rule,
            isImmutable: false,
          }),
        ),
      ),
    ...settle,
  })

  const saveBoard = useMutation({
    mutationFn: async ({ boardId, details, permissions }: BoardSave) => {
      const token = requireToken()
      let savedBoardId = boardId
      if (!savedBoardId) {
        if (!details) throw new Error('A new board needs a name.')
        savedBoardId = String((await createBoard(token, serverId, details)).boardId)
      } else if (details) {
        await updateBoard(token, serverId, savedBoardId, { name: details.name, description: details.description })
      }
      if (permissions) {
        await reconcileBoardPermissions(serverId, savedBoardId, permissions)
      }
    },
    ...settle,
  })

  const setBoardArchived = useMutation({
    mutationFn: ({ boardId, archived }: { boardId: string; archived: boolean }) =>
      archiveBoard(requireToken(), serverId, boardId, archived),
    ...settle,
  })

  const removeBoard = useMutation({
    mutationFn: (boardId: string) => deleteBoard(requireToken(), serverId, boardId),
    ...settle,
  })

  return { setRuleState, removeRule, removeRules, addRules, saveBoard, setBoardArchived, removeBoard }
}
