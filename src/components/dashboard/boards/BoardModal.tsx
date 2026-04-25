import { useEffect, useMemo, useState } from 'react'
import { AddEntryModal } from '../AddEntryModal'
import { DeleteGroupModal } from '../DeleteGroupModal'
import { PermissionsSection } from '../permissions/PermissionsSection'
import { permissionRankWeight } from '../permissionRank'
import {
  boardPermissionCatalogEntries,
  boardPermissionGroups,
  cloneBoardPermissionDrafts,
  addDraftPermissions,
  removeDraftPermission,
  toggleDraftPermissionState,
} from './boardPermissionDraft'
import type { BoardEntry } from '../../../services/boardsService'
import {
  DISCORD_FLAG_NAMES,
  DISCORD_PERM_IMPORTANCE,
  KANBAN_PERM_INFO,
  type GrantedToGroup,
  type KanbanCatalogEntry,
  type PermissionEntry,
  type ServerMemberEntry,
  type ServerRoleEntry,
} from '../../../services/permissionsService'
import { FiX } from 'react-icons/fi'

type BoardModalProps = {
  show: boolean
  mode: 'create' | 'edit'
  board: BoardEntry | null
  initialName: string
  initialDescription: string
  initialPermissions: PermissionEntry[]
  catalogEntries: KanbanCatalogEntry[]
  serverRoles: ServerRoleEntry[]
  serverMembers: ServerMemberEntry[]
  actorRankWeight: number
  canEditDetails: boolean
  canEditPermissions: boolean
  loading: boolean
  saving: boolean
  onClose: () => void
  onSave: (payload: { name: string; description: string; permissions: PermissionEntry[] }) => void
}

export function BoardModal({
  show,
  mode,
  board,
  initialName,
  initialDescription,
  initialPermissions,
  catalogEntries,
  serverRoles,
  serverMembers,
  actorRankWeight,
  canEditDetails,
  canEditPermissions,
  loading,
  saving,
  onClose,
  onSave,
}: BoardModalProps) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [draftPermissions, setDraftPermissions] = useState<PermissionEntry[]>(() => cloneBoardPermissionDrafts(initialPermissions))
  const [permissionsCollapsed, setPermissionsCollapsed] = useState(false)
  const [expandedPermissionGroups, setExpandedPermissionGroups] = useState<Set<string>>(new Set())
  const [permFilter, setPermFilter] = useState('')
  const [openAddGroupKey, setOpenAddGroupKey] = useState('')
  const [newPermId, setNewPermId] = useState<number | ''>('')
  const [newPermState, setNewPermState] = useState<'ALLOW' | 'DENY'>('ALLOW')
  const [showAddEntryModal, setShowAddEntryModal] = useState(false)
  const [modalSearch, setModalSearch] = useState('')
  const [modalSubjectType, setModalSubjectType] = useState<string | null>(null)
  const [modalSubjectId, setModalSubjectId] = useState<string | null>(null)
  const [modalSubjectDisplay, setModalSubjectDisplay] = useState<string | null>(null)
  const [modalPermStates, setModalPermStates] = useState<Record<number, 'ALLOW' | 'DENY'>>({})
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<GrantedToGroup | null>(null)

  useEffect(() => {
    if (!show) return
    setName(initialName)
    setDescription(initialDescription)
    setDraftPermissions(cloneBoardPermissionDrafts(initialPermissions))
    setPermissionsCollapsed(false)
    setExpandedPermissionGroups(new Set())
    setPermFilter('')
    setOpenAddGroupKey('')
    setNewPermId('')
    setNewPermState('ALLOW')
    setShowAddEntryModal(false)
    setModalSearch('')
    setModalSubjectType(null)
    setModalSubjectId(null)
    setModalSubjectDisplay(null)
    setModalPermStates({})
    setDeleteGroupTarget(null)
  }, [show, initialName, initialDescription, initialPermissions])

  const boardCatalog = useMemo(() => boardPermissionCatalogEntries(catalogEntries), [catalogEntries])
  const roleMap = useMemo(() => new Map(serverRoles.map((role) => [role.roleId, role.name])), [serverRoles])
  const memberMap = useMemo(
    () => new Map(serverMembers.map((member) => [member.userId, member.displayName ?? member.nickname ?? member.userId])),
    [serverMembers],
  )
  const usernameMap = useMemo(() => new Map(serverMembers.map((member) => [member.userId, member.username ?? ''])), [serverMembers])

  const groupedPermissions = useMemo(() => boardPermissionGroups(draftPermissions, roleMap, memberMap), [draftPermissions, roleMap, memberMap])

  const filteredGroups = useMemo(() => {
    if (!permFilter.trim()) return groupedPermissions
    const q = permFilter.toLowerCase()
    return groupedPermissions.filter(
      (group) =>
        group.subjectDisplay.toLowerCase().includes(q) ||
        String(group.subjectId).includes(q) ||
        (group.subjectType === 'USER' && (usernameMap.get(group.subjectId)?.toLowerCase().includes(q) ?? false)) ||
        group.permissions.some((permission) =>
          (KANBAN_PERM_INFO[permission.kanbanPermissionKey]?.name ?? permission.kanbanPermissionKey)
            .toLowerCase()
            .includes(q),
        ),
    )
  }, [groupedPermissions, permFilter, usernameMap])

  const existingSubjectIds = useMemo(() => {
    const map: Record<string, Set<string>> = {
      DISCORD_PERMISSION: new Set(),
      ROLE: new Set(),
      USER: new Set(),
    }
    for (const permission of draftPermissions) {
      map[permission.subjectType]?.add(permission.subjectId)
    }
    return map
  }, [draftPermissions])

  const filteredDiscordPerms = useMemo(() => {
    const q = modalSearch.toLowerCase()
    return Object.entries(DISCORD_FLAG_NAMES)
      .filter(([id]) => !existingSubjectIds.DISCORD_PERMISSION.has(id))
      .filter(([id, displayName]) => !q || displayName.toLowerCase().includes(q) || id.includes(q))
      .sort(([idA], [idB]) => (DISCORD_PERM_IMPORTANCE[idA] ?? 999) - (DISCORD_PERM_IMPORTANCE[idB] ?? 999))
      .map(([id, displayName]) => ({ id, name: displayName }))
  }, [existingSubjectIds, modalSearch])

  const filteredRoles = useMemo(() => {
    const q = modalSearch.toLowerCase()
    const available = serverRoles.filter((role) => !existingSubjectIds.ROLE.has(role.roleId))
    if (!q) return available
    return available.filter((role) => role.name.toLowerCase().includes(q) || role.roleId.includes(q))
  }, [existingSubjectIds, modalSearch, serverRoles])

  const filteredMembers = useMemo(() => {
    const q = modalSearch.toLowerCase()
    const available = serverMembers.filter((member) => !existingSubjectIds.USER.has(member.userId))
    if (!q) return available
    return available.filter((member) => {
      const displayName = member.displayName ?? member.nickname ?? `User #${member.userId}`
      return (
        displayName.toLowerCase().includes(q) ||
        (member.username?.toLowerCase().includes(q) ?? false) ||
        member.userId.includes(q)
      )
    })
  }, [existingSubjectIds, modalSearch, serverMembers])

  const grantableCatalogEntries = useMemo(() => {
    if (!modalSubjectType || !modalSubjectId) return []
    const existingKeys = draftPermissions
      .filter((permission) => permission.subjectType === modalSubjectType && permission.subjectId === modalSubjectId)
      .map((permission) => permission.kanbanPermissionKey)
    return boardCatalog.filter((entry) => {
      const actorCanGrant = actorRankWeight === 1000 || actorRankWeight > permissionRankWeight(entry.key)
      return actorCanGrant && !existingKeys.includes(entry.key)
    })
  }, [actorRankWeight, boardCatalog, draftPermissions, modalSubjectId, modalSubjectType])

  function openNewEntryModal() {
    setShowAddEntryModal(true)
    setModalSearch('')
    setModalSubjectType(null)
    setModalSubjectId(null)
    setModalSubjectDisplay(null)
    setModalPermStates({})
  }

  function closeNewEntryModal() {
    setShowAddEntryModal(false)
    setModalSearch('')
    setModalSubjectType(null)
    setModalSubjectId(null)
    setModalSubjectDisplay(null)
    setModalPermStates({})
  }

  function selectModalSubject(subjectType: string, subjectId: string, display: string) {
    setModalSubjectType(subjectType)
    setModalSubjectId(subjectId)
    setModalSubjectDisplay(display)
    setModalPermStates({})
  }

  function clearModalSubject() {
    setModalSubjectType(null)
    setModalSubjectId(null)
    setModalSubjectDisplay(null)
    setModalPermStates({})
    setModalSearch('')
  }

  function cycleModalPermState(permissionId: number) {
    setModalPermStates((prev) => {
      const current = prev[permissionId] ?? null
      if (current === null) return { ...prev, [permissionId]: 'ALLOW' }
      if (current === 'ALLOW') return { ...prev, [permissionId]: 'DENY' }
      const next = { ...prev }
      delete next[permissionId]
      return next
    })
  }

  function saveNewEntryModal() {
    if (!modalSubjectType || !modalSubjectId) return
    const entries = Object.entries(modalPermStates)
    if (entries.length === 0) return

    const additions = entries
      .map(([permissionId, state]) => {
        const catalogEntry = boardCatalog.find((entry) => entry.permissionId === Number(permissionId))
        if (!catalogEntry) return null
        return {
          subjectType: modalSubjectType,
          subjectId: modalSubjectId,
          kanbanPermissionId: Number(permissionId),
          kanbanPermissionKey: catalogEntry.key,
          state,
        }
      })
      .filter(
        (entry): entry is {
          subjectType: string
          subjectId: string
          kanbanPermissionId: number
          kanbanPermissionKey: string
          state: 'ALLOW' | 'DENY'
        } => entry !== null,
      )

    setDraftPermissions((prev) => addDraftPermissions(prev, additions))
    closeNewEntryModal()
  }

  function togglePermissionGroupExpansion(groupKey: string) {
    setExpandedPermissionGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupKey)) {
        next.delete(groupKey)
      } else {
        next.add(groupKey)
      }
      return next
    })
  }

  function openAddPermission(subjectType: string, subjectId: string, existingKeys: string[]) {
    const available = boardCatalog.filter((entry) => {
      const actorCanGrant = actorRankWeight === 1000 || actorRankWeight > permissionRankWeight(entry.key)
      return actorCanGrant && !existingKeys.includes(entry.key)
    })
    if (available.length === 0) {
      return
    }
    setOpenAddGroupKey(`${subjectType}:${subjectId}`)
    setNewPermState('ALLOW')
    setNewPermId(available[0]?.permissionId ?? '')
  }

  function addPermissionToGroup(subjectType: string, subjectId: string, defaultPriority: number) {
    if (!newPermId) return
    const catalogEntry = boardCatalog.find((entry) => entry.permissionId === Number(newPermId))
    if (!catalogEntry) return

    setDraftPermissions((prev) => [
      ...prev,
      {
        id: Math.min(0, ...prev.map((permission) => permission.id)) - 1,
        scopeType: 'BOARD',
        scopeId: board?.boardId ? String(board.boardId) : '__draft_board__',
        subjectType,
        subjectId,
        kanbanPermissionId: catalogEntry.permissionId,
        kanbanPermissionKey: catalogEntry.key,
        state: newPermState,
        priority: defaultPriority,
        isImmutable: false,
      },
    ])
    setOpenAddGroupKey('')
    setNewPermId('')
    setNewPermState('ALLOW')
  }

  if (!show) return null

  return (
    <>
      <div className="kc-modal-overlay" role="dialog" aria-modal="true" aria-label={mode === 'create' ? 'Create Board' : 'Edit Board'} onClick={onClose}>
        <div className="kc-modal kc-board-modal" onClick={(e) => e.stopPropagation()}>
          <div className="kc-modal-header">
            <h3 className="kc-modal-title">{mode === 'create' ? 'Create Board' : `Configure ${board?.name ?? 'Board'}`}</h3>
            <button type="button" className="kc-modal-close" onClick={onClose} disabled={saving} aria-label="Close modal">
              <FiX aria-hidden="true" />
            </button>
          </div>

          <div className="kc-modal-body kc-board-modal-body">
            {loading ? (
              <div className="kc-loading-state" aria-live="polite" aria-busy="true">
                <span className="kc-spinner" aria-hidden="true" />
                <span className="kc-muted">Loading board configuration...</span>
              </div>
            ) : (
              <>
                {canEditDetails && (
                  <section className="kc-board-modal-section">
                    <div className="kc-board-modal-section-head">
                      <h4>Board Details</h4>
                      <p className="kc-muted">Set the board name and description.</p>
                    </div>
                    <label className="kc-field">
                      <span className="kc-field-label">Name</span>
                      <input
                        className="kc-input"
                        type="text"
                        maxLength={100}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Sprint board"
                      />
                    </label>
                    <label className="kc-field">
                      <span className="kc-field-label">Description</span>
                      <textarea
                        className="kc-textarea"
                        maxLength={500}
                        rows={4}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What this board is used for"
                      />
                    </label>
                  </section>
                )}

                {canEditPermissions && (
                  <section className="kc-board-modal-section">
                    <div className="kc-board-modal-section-head">
                      <h4>Board Permissions</h4>
                      <p className="kc-muted">Adjust inherited board permissions before saving.</p>
                    </div>
                    <PermissionsSection
                      canEditPermissions={canEditPermissions}
                      permissionsCollapsed={permissionsCollapsed}
                      permissionsLoading={false}
                      permFilter={permFilter}
                      filteredGroups={filteredGroups}
                      expandedPermissionGroups={expandedPermissionGroups}
                      actorRankWeight={actorRankWeight}
                      openAddGroupKey={openAddGroupKey}
                      newPermId={newPermId}
                      newPermState={newPermState}
                      addSaving={false}
                      catalogEntries={boardCatalog}
                      onToggleCollapsed={() => setPermissionsCollapsed((prev) => !prev)}
                      onPermFilterChange={setPermFilter}
                      onOpenNewEntryModal={openNewEntryModal}
                      onToggleGroupExpansion={togglePermissionGroupExpansion}
                      onRequestDeleteGroup={setDeleteGroupTarget}
                      onOpenAddPermission={openAddPermission}
                      onTogglePermissionState={(permissionId, currentState) => {
                        setDraftPermissions((prev) => toggleDraftPermissionState(prev, permissionId, currentState))
                      }}
                      onDeletePermission={(permissionId) => {
                        setDraftPermissions((prev) => removeDraftPermission(prev, permissionId))
                      }}
                      onSetNewPermId={setNewPermId}
                      onSetNewPermState={setNewPermState}
                      onAddPermission={addPermissionToGroup}
                      onCancelAddPermission={() => {
                        setOpenAddGroupKey('')
                        setNewPermId('')
                        setNewPermState('ALLOW')
                      }}
                    />
                  </section>
                )}
              </>
            )}
          </div>

          <div className="kc-modal-footer">
            <button type="button" className="kc-btn kc-btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="button"
              className="kc-btn kc-btn-primary"
              onClick={() => onSave({ name: name.trim(), description: description.trim(), permissions: draftPermissions })}
              disabled={loading || saving || (canEditDetails && name.trim().length === 0)}
            >
              {saving ? 'Saving…' : mode === 'create' ? 'Create Board' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>

      <DeleteGroupModal
        target={deleteGroupTarget}
        deleteGroupSaving={false}
        onClose={() => setDeleteGroupTarget(null)}
        onConfirm={() => {
          if (!deleteGroupTarget) return
          const ids = new Set(deleteGroupTarget.permissions.map((permission) => permission.id))
          setDraftPermissions((prev) => prev.filter((permission) => !ids.has(permission.id)))
          setDeleteGroupTarget(null)
        }}
      />

      <AddEntryModal
        show={showAddEntryModal}
        title="Add Board Permission Entry"
        ariaLabel="Add Board Permission Entry"
        loading={false}
        saving={false}
        modalSearch={modalSearch}
        subjectType={modalSubjectType}
        subjectDisplay={modalSubjectDisplay}
        modalPermStates={modalPermStates}
        filteredDiscordPerms={filteredDiscordPerms}
        filteredRoles={filteredRoles}
        filteredMembers={filteredMembers}
        grantableCatalogEntries={grantableCatalogEntries}
        onClose={closeNewEntryModal}
        onSearchChange={setModalSearch}
        onSelectSubject={selectModalSubject}
        onClearSubject={clearModalSubject}
        onCyclePermState={cycleModalPermState}
        onSave={saveNewEntryModal}
      />
    </>
  )
}
