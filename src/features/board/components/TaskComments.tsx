import { useState } from 'react'
import type { TaskCommentEntry } from '../../../services/taskCommentsService'
import type { MeResponse } from '../../../types/auth'
import { useCommentMutations, useTaskComments } from '../boardQueries'
import {
  commentEditLabel,
  formatCommentTimestamp,
  resolveCommentAuthorName,
  toggleTaskListItemByIndex,
  type BoardAbilities,
} from '../boardModel'
import { ConfirmDialog } from './ConfirmDialog'
import { Markdown } from './Markdown'

type TaskCommentsProps = {
  serverId: string
  boardId: string
  taskId: number
  me: MeResponse | null
  abilities: BoardAbilities
}

/** The comment thread of a task: read, write, edit, delete, and tick checklists in comments. */
export function TaskComments({ serverId, boardId, taskId, me, abilities }: TaskCommentsProps) {
  const commentsQuery = useTaskComments(serverId, boardId, taskId)
  const mutations = useCommentMutations(serverId, boardId, taskId)
  const comments = commentsQuery.data ?? []

  const [composing, setComposing] = useState(false)
  const [draft, setDraft] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingContent, setEditingContent] = useState('')
  const [openMenuId, setOpenMenuId] = useState<number | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TaskCommentEntry | null>(null)
  const [error, setError] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [togglingIds, setTogglingIds] = useState<Set<number>>(new Set())

  // Mirrors the API: authors manage their own comments with the permission to comment at all, and
  // only they can edit them; DELETE_TASK_COMMENT lets moderators delete other people's.
  const isOwn = (comment: TaskCommentEntry) => me !== null && String(comment.userId) === String(me.userId)
  const canEdit = (comment: TaskCommentEntry) => isOwn(comment) && abilities.comment
  const canDelete = (comment: TaskCommentEntry) =>
    isOwn(comment) ? abilities.comment : abilities.moderateCommentDeletes

  function post() {
    const content = draft.trim()
    if (!content) return
    setError('')
    mutations.create.mutate(content, {
      onSuccess: () => {
        setDraft('')
        setComposing(false)
      },
      onError: (err) => setError(String(err)),
    })
  }

  function saveEdit() {
    const content = editingContent.trim()
    if (editingId === null || !content) return
    setError('')
    mutations.edit.mutate(
      { commentId: editingId, content },
      {
        onSuccess: () => {
          setEditingId(null)
          setEditingContent('')
          setOpenMenuId(null)
        },
        onError: (err) => setError(String(err)),
      },
    )
  }

  function toggleChecklist(comment: TaskCommentEntry, itemIndex: number, checked: boolean) {
    if (!canEdit(comment) || togglingIds.has(comment.commentId)) return
    const content = toggleTaskListItemByIndex(comment.content ?? '', itemIndex, checked)
    if (content === comment.content) return

    setError('')
    setTogglingIds((prev) => new Set(prev).add(comment.commentId))
    mutations.edit.mutate(
      { commentId: comment.commentId, content },
      {
        onError: (err) => setError(String(err)),
        onSettled: () =>
          setTogglingIds((prev) => {
            const next = new Set(prev)
            next.delete(comment.commentId)
            return next
          }),
      },
    )
  }

  function confirmDelete() {
    if (!deleteTarget) return
    setDeleteError('')
    mutations.remove.mutate(deleteTarget.commentId, {
      onSuccess: () => {
        setDeleteTarget(null)
        setOpenMenuId(null)
      },
      onError: (err) => setDeleteError(String(err)),
    })
  }

  const loadError = commentsQuery.isError ? `Failed to load comments: ${commentsQuery.error}` : ''

  return (
    <section className="kc-task-comments" aria-label="Task comments">
      <div className="kc-task-comments-header">
        <h4>Comments</h4>
        {abilities.comment && (
          <button
            type="button"
            className="kc-btn kc-btn-ghost"
            onClick={() => {
              setComposing((prev) => !prev)
              setError('')
              setOpenMenuId(null)
            }}
          >
            {composing ? 'Cancel' : 'New comment'}
          </button>
        )}
      </div>

      {commentsQuery.isPending && <p className="kc-muted">Loading comments...</p>}
      {(error || loadError) && <p className="kc-banner">{error || loadError}</p>}

      {composing && abilities.comment && (
        <div className="kc-task-comment-compose">
          <textarea
            className="kc-textarea"
            value={draft}
            placeholder="Write a comment..."
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault()
                post()
              }
            }}
          />
          <div className="kc-task-comment-compose-actions">
            <button
              type="button"
              className="kc-btn kc-btn-primary"
              disabled={mutations.create.isPending || !draft.trim()}
              onClick={post}
            >
              {mutations.create.isPending ? 'Posting...' : 'Post comment'}
            </button>
          </div>
        </div>
      )}

      {commentsQuery.isSuccess && comments.length === 0 && <p className="kc-muted">No comments yet.</p>}

      {comments.length > 0 && (
        <ul className="kc-task-comments-list">
          {comments.map((comment) => {
            const editing = editingId === comment.commentId
            const editable = canEdit(comment)
            const deletable = canDelete(comment)
            const editLabel = commentEditLabel(comment)
            const authorName = resolveCommentAuthorName(comment)

            return (
              <li key={comment.commentId} className="kc-task-comment-item">
                <div className="kc-task-comment-avatar" aria-hidden="true">
                  {comment.authorAvatarUrl ? (
                    <img src={comment.authorAvatarUrl} alt="" />
                  ) : (
                    <span>{authorName.slice(0, 1).toUpperCase()}</span>
                  )}
                </div>

                <div className="kc-task-comment-main">
                  <div className="kc-task-comment-meta">
                    <strong>{authorName}</strong>
                    <span>{formatCommentTimestamp(comment.createdAt)}</span>
                    {editLabel && <small>{editLabel}</small>}
                  </div>

                  {editing ? (
                    <div className="kc-task-comment-edit">
                      <textarea
                        className="kc-textarea"
                        value={editingContent}
                        onChange={(event) => setEditingContent(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault()
                            saveEdit()
                          }
                        }}
                      />
                      <div className="kc-task-comment-edit-actions">
                        <button
                          type="button"
                          className="kc-btn kc-btn-ghost"
                          onClick={() => {
                            setEditingId(null)
                            setEditingContent('')
                          }}
                          disabled={mutations.edit.isPending}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="kc-btn kc-btn-primary"
                          onClick={saveEdit}
                          disabled={mutations.edit.isPending || !editingContent.trim()}
                        >
                          {mutations.edit.isPending ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="kc-task-comment-content kc-markdown">
                      <Markdown
                        editable={editable && !togglingIds.has(comment.commentId)}
                        onToggle={(itemIndex, checked) => toggleChecklist(comment, itemIndex, checked)}
                      >
                        {comment.content}
                      </Markdown>
                    </div>
                  )}
                </div>

                {(editable || deletable) && (
                  <div className="kc-task-comment-menu-wrap">
                    <button
                      type="button"
                      className="kc-column-menu-btn"
                      aria-label="Comment options"
                      aria-expanded={openMenuId === comment.commentId}
                      onClick={() => setOpenMenuId((prev) => (prev === comment.commentId ? null : comment.commentId))}
                    >
                      {'⋯'}
                    </button>
                    {openMenuId === comment.commentId && (
                      <ul className="kc-column-menu-dropdown" role="menu">
                        {editable && (
                          <li role="none">
                            <button
                              type="button"
                              role="menuitem"
                              className="kc-column-menu-item"
                              onClick={() => {
                                setEditingId(comment.commentId)
                                setEditingContent(comment.content)
                                setOpenMenuId(null)
                              }}
                            >
                              Edit comment
                            </button>
                          </li>
                        )}
                        {deletable && (
                          <li role="none">
                            <button
                              type="button"
                              role="menuitem"
                              className="kc-column-menu-item kc-column-menu-item--danger"
                              onClick={() => {
                                setDeleteTarget(comment)
                                setDeleteError('')
                                setOpenMenuId(null)
                              }}
                            >
                              Delete comment
                            </button>
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete Comment"
          error={deleteError}
          busy={mutations.remove.isPending}
          onCancel={() => {
            setDeleteTarget(null)
            setDeleteError('')
          }}
          onConfirm={confirmDelete}
        >
          <p className="kc-modal-confirm-desc">Delete this comment? This cannot be undone.</p>
        </ConfirmDialog>
      )}
    </section>
  )
}
