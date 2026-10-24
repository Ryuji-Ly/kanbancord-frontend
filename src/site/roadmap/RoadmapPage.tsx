import { useState, type CSSProperties, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { readableError } from '../../api/http'
import { useSession } from '../../api/session'
import { Markdown } from '../../features/board/components/Markdown'
import { formatLocale, t } from '../../i18n'
import { startDiscordLogin } from '../../services/authService'
import { addRoadmapIssue, fetchRoadmap, IssueLimitError, type RoadmapChip, type RoadmapTask } from '../../services/roadmapService'
import { PublicLayout } from '../PublicLayout'

const ROADMAP_KEY = ['roadmap'] as const

function Chip({ chip, priority = false }: { chip: RoadmapChip; priority?: boolean }) {
  return (
    <span className={`kc-roadmap-chip${priority ? ' kc-roadmap-chip--priority' : ''}`} style={chip.color ? ({ '--chip': chip.color } as CSSProperties) : undefined}>
      {chip.name}
    </span>
  )
}

/** A task on the roadmap; its details open in place. */
function RoadmapCard({ task }: { task: RoadmapTask }) {
  const [open, setOpen] = useState(false)
  const chips = [...(task.labels ?? [])]
  const hasDetails = Boolean(task.description?.trim())
  return (
    <li className="kc-roadmap-card">
      <button
        type="button"
        className="kc-roadmap-card-head"
        aria-expanded={hasDetails ? open : undefined}
        disabled={!hasDetails}
        onClick={() => setOpen((value) => !value)}
      >
        {(chips.length > 0 || task.priority) && (
          <span className="kc-roadmap-chips">
            {task.priority && <Chip chip={task.priority} priority />}
            {chips.map((chip) => (
              <Chip key={chip.name} chip={chip} />
            ))}
          </span>
        )}
        <span className="kc-roadmap-card-title">{task.title}</span>
      </button>
      {open && hasDetails && (
        <div className="kc-roadmap-card-details">
          <Markdown>{task.description ?? ''}</Markdown>
        </div>
      )}
    </li>
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
 * KanbanCord's own board, for everyone: what is being worked on, planned and done. Anyone can read
 * it; anyone signed in can add an issue to its Issues column.
 */
export function RoadmapPage() {
  const query = useQuery({ queryKey: ROADMAP_KEY, queryFn: fetchRoadmap, staleTime: 60_000 })
  const roadmap = query.data

  return (
    <PublicLayout title={t('site.roadmap.metaTitle')} description={t('site.roadmap.metaDescription')} path="/roadmap" wide>
      <h1>{t('site.roadmap.title')}</h1>
      <p>{t('site.roadmap.intro')}</p>
      {query.isPending && <p className="kc-muted">{t('site.roadmap.loading')}</p>}
      {(query.isError || (query.isSuccess && !roadmap)) && <p className="kc-muted">{t('site.roadmap.unavailable')}</p>}
      {roadmap && (
        <>
          <div className="kc-roadmap-board" lang="en">
            {roadmap.columns.map((column) => {
              const tasks = roadmap.tasks.filter((task) => task.columnId === column.id)
              return (
                <section key={column.id} className="kc-roadmap-column" aria-label={column.name}>
                  <h2>
                    {column.name} <span className="kc-roadmap-count">{tasks.length}</span>
                  </h2>
                  {tasks.length > 0 ? (
                    <ul>
                      {tasks.map((task) => (
                        <RoadmapCard key={task.id} task={task} />
                      ))}
                    </ul>
                  ) : (
                    <p className="kc-muted">{t('site.roadmap.emptyColumn')}</p>
                  )}
                </section>
              )
            })}
          </div>
          {roadmap.issuesColumnId && <AddIssue />}
        </>
      )}
    </PublicLayout>
  )
}
