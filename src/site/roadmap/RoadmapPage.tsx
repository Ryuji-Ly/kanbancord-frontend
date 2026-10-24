import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { readableError } from '../../api/http'
import { useSession } from '../../api/session'
import { BoardColumn } from '../../features/board/components/BoardColumn'
import { Markdown } from '../../features/board/components/Markdown'
import { formatLocale, t } from '../../i18n'
import { startDiscordLogin } from '../../services/authService'
import type { BoardColumnEntry } from '../../services/boardColumnsService'
import type { LabelEntry, PriorityEntry } from '../../services/boardsService'
import { addRoadmapIssue, fetchRoadmap, IssueLimitError, type Roadmap } from '../../services/roadmapService'
import type { TaskEntry } from '../../services/tasksService'
import { PublicLayout } from '../PublicLayout'

const ROADMAP_KEY = ['roadmap'] as const
const none = () => {}

/**
 * The roadmap as the board page's own columns and cards, read-only: the same entries the board
 * page draws, made from what the API shares publicly.
 */
function boardOf(roadmap: Roadmap) {
  const columns: BoardColumnEntry[] = roadmap.columns.map((column, index) => ({
    columnId: Number(column.id), boardId: 0, name: column.name, position: index + 1, color: column.color,
    wipLimit: null, createdAt: '', updatedAt: '',
  }))
  const labels = new Map<string, LabelEntry>((roadmap.labels ?? []).map((label) => [label.id,
    { labelId: Number(label.id), boardId: 0, name: label.name, color: label.color }]))
  const prioritiesById = new Map<number, PriorityEntry>((roadmap.priorities ?? []).map((level) => [Number(level.id),
    { priorityId: Number(level.id), boardId: 0, name: level.name, color: level.color, position: level.position }]))
  const tasks: TaskEntry[] = roadmap.tasks.map((task, index) => ({
    taskId: Number(task.id), boardId: 0, columnId: Number(task.columnId), title: task.title,
    description: task.description ?? null, position: index, priorityId: task.priorityId ? Number(task.priorityId) : null,
    dueDate: null, isArchived: false, metadata: null, createdBy: null, createdAt: '', updatedAt: '', completedAt: null,
  }))
  const labelsByTaskId = new Map<number, { label: LabelEntry }[]>(roadmap.tasks.map((task) => [Number(task.id),
    (task.labelIds ?? []).map((id) => labels.get(id)).filter((label): label is LabelEntry => Boolean(label)).map((label) => ({ label }))]))
  return { columns, tasks, labelsByTaskId, prioritiesById }
}

/** A task's details, read-only: its labels, priority and description. */
function TaskDetails({ task, labels, priority, onClose }: {
  task: TaskEntry
  labels: LabelEntry[]
  priority: PriorityEntry | null
  onClose: () => void
}) {
  return createPortal(
    <div className="kc-modal-overlay" role="dialog" aria-modal="true" aria-label={task.title} onClick={onClose}>
      <div className="kc-modal kc-roadmap-details" onClick={(event) => event.stopPropagation()}>
        <div className="kc-modal-header">
          <h3 className="kc-modal-title" lang="en">{task.title}</h3>
        </div>
        <div className="kc-modal-body" lang="en">
          {(labels.length > 0 || priority) && (
            <p className="kc-roadmap-chips">
              {priority && (
                <span className="kc-roadmap-chip kc-roadmap-chip--priority" style={{ '--chip': priority.color ?? undefined } as CSSProperties}>
                  {t('board.priority.rank', { position: priority.position })} {priority.name}
                </span>
              )}
              {labels.map((label) => (
                <span key={label.labelId} className="kc-roadmap-chip" style={{ '--chip': label.color } as CSSProperties}>
                  {label.name}
                </span>
              ))}
            </p>
          )}
          {task.description?.trim() ? <Markdown>{task.description}</Markdown> : <p className="kc-muted">{t('site.roadmap.noDetails')}</p>}
        </div>
        <div className="kc-modal-footer">
          <button type="button" className="kc-btn kc-btn-ghost" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/** Adding an issue: a form for those signed in, a way to sign in for everyone else. */
function AddIssue() {
  const session = useSession()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null)

  if (session.status === 'loading') return null
  if (session.status !== 'signedIn') {
    return (
      <section className="kc-roadmap-add">
        <h2>{t('site.roadmap.addTitle')}</h2>
        <p className="kc-muted">{t('site.roadmap.signInIntro')}</p>
        {message && <p className="kc-banner">{message.text}</p>}
        <button
          type="button"
          className="kc-btn kc-btn-primary"
          onClick={() => startDiscordLogin((text) => text && setMessage({ text, error: true }), '/roadmap')}
        >
          {t('site.roadmap.signIn')}
        </button>
      </section>
    )
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim()) return
    setBusy(true)
    setMessage(null)
    try {
      await addRoadmapIssue({ title: title.trim(), description: description.trim() })
      setTitle('')
      setDescription('')
      setMessage({ text: t('site.roadmap.added'), error: false })
      void queryClient.invalidateQueries({ queryKey: ROADMAP_KEY })
    } catch (error) {
      if (error instanceof IssueLimitError) {
        const time = error.nextAt.toLocaleTimeString(formatLocale(), { hour: '2-digit', minute: '2-digit' })
        setMessage({ text: t('site.roadmap.wait', { time }), error: true })
      } else {
        setMessage({ text: readableError(error, t('site.roadmap.failed')), error: true })
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="kc-roadmap-add">
      <h2>{t('site.roadmap.addTitle')}</h2>
      <p className="kc-muted">{t('site.roadmap.addIntro')}</p>
      <form onSubmit={(event) => void submit(event)} className="kc-roadmap-form">
        <label className="kc-field">
          <span className="kc-field-label">{t('site.roadmap.titleLabel')}</span>
          <input className="kc-input" value={title} maxLength={200} required disabled={busy} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="kc-field">
          <span className="kc-field-label">{t('site.roadmap.descriptionLabel')}</span>
          <textarea
            className="kc-input"
            rows={4}
            value={description}
            maxLength={2000}
            disabled={busy}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        {message && <p className={message.error ? 'kc-banner' : 'kc-muted'}>{message.text}</p>}
        <button type="submit" className="kc-btn kc-btn-primary" disabled={busy || !title.trim()}>
          {busy ? t('site.roadmap.submitting') : t('site.roadmap.submit')}
        </button>
      </form>
    </section>
  )
}

/**
 * KanbanCord's own board, for everyone, drawn like any board: what is being worked on, planned and
 * done. Anyone can read it and open a task; anyone signed in can add an issue to its Issues column.
 */
export function RoadmapPage() {
  const query = useQuery({ queryKey: ROADMAP_KEY, queryFn: fetchRoadmap, staleTime: 60_000 })
  const roadmap = query.data
  const board = useMemo(() => (roadmap ? boardOf(roadmap) : null), [roadmap])
  const [openTaskId, setOpenTaskId] = useState<number | null>(null)
  const openTask = board?.tasks.find((task) => task.taskId === openTaskId) ?? null

  return (
    <PublicLayout title={t('site.roadmap.metaTitle')} description={t('site.roadmap.metaDescription')} path="/roadmap" wide>
      <h1>{t('site.roadmap.title')}</h1>
      <p>{t('site.roadmap.intro')}</p>
      {query.isPending && <p className="kc-muted">{t('site.roadmap.loading')}</p>}
      {(query.isError || (query.isSuccess && !roadmap)) && <p className="kc-muted">{t('site.roadmap.unavailable')}</p>}
      {roadmap && board && (
        <>
          <section className="kc-board-page-columns kc-roadmap-board" aria-label={roadmap.name} lang="en">
            {board.columns.map((column) => (
              <BoardColumn
                key={column.columnId}
                column={column}
                tasks={board.tasks.filter((task) => task.columnId === column.columnId)}
                assigneesByTaskId={{}}
                labelsByTaskId={board.labelsByTaskId}
                prioritiesById={board.prioritiesById}
                rolesByTaskId={new Map()}
                selectedTaskId={openTaskId}
                canEdit={false}
                canDelete={false}
                canMove={false}
                canCreateTask={false}
                canMoveTasks={false}
                canArchiveTasks={false}
                menuOpen={false}
                isDragPlaceholder={false}
                draggedTaskId={null}
                draggedTaskHeight={null}
                isTaskDropTarget={false}
                justDragged={() => false}
                onRename={none}
                onToggleMenu={none}
                onRequestDelete={none}
                onRequestArchiveTasks={none}
                onAddTask={none}
                onOpenTask={(task) => setOpenTaskId(task.taskId)}
                onColumnDragStart={none}
                onColumnDragEnd={none}
                onTaskDragStart={none}
                onTaskDragEnd={none}
                onTaskDragOver={none}
                onTaskDrop={none}
              />
            ))}
          </section>
          {openTask && (
            <TaskDetails
              task={openTask}
              labels={(board.labelsByTaskId.get(openTask.taskId) ?? []).map((entry) => entry.label)}
              priority={openTask.priorityId === null ? null : (board.prioritiesById.get(openTask.priorityId) ?? null)}
              onClose={() => setOpenTaskId(null)}
            />
          )}
          {roadmap.issuesColumnId && <AddIssue />}
        </>
      )}
    </PublicLayout>
  )
}
