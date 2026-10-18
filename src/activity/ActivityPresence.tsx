import { useEffect, useState } from 'react'
import { t } from '../i18n'
import { type ActivityParticipant, watchParticipants } from './activity'
import { isActivity } from './detect'

/** How many faces are shown before the rest become a count. */
const SHOWN = 4

/**
 * Inside the Discord Activity, the other people who have this same Activity session open, as a row
 * of avatars. Outside the Activity, or alone in it, it shows nothing.
 */
export function ActivityPresence({ selfId }: { selfId?: string }) {
  const [participants, setParticipants] = useState<ActivityParticipant[]>([])
  useEffect(() => (isActivity() ? watchParticipants(setParticipants) : undefined), [])

  const others = participants.filter((p) => p.id !== selfId)
  if (others.length === 0) return null
  const names = others.map((p) => p.name).join(', ')
  const hidden = others.length - SHOWN
  return (
    <div className="kc-presence" role="group" aria-label={t('dashboard.presence', { names })} title={t('dashboard.presence', { names })}>
      {others.slice(0, hidden > 0 ? SHOWN - 1 : SHOWN).map((p) =>
        p.avatarUrl ? (
          <img key={p.id} src={p.avatarUrl} alt="" className="kc-presence-face" />
        ) : (
          <span key={p.id} className="kc-presence-face kc-presence-initial" aria-hidden="true">
            {p.name.slice(0, 1).toUpperCase()}
          </span>
        ),
      )}
      {hidden > 0 && (
        <span className="kc-presence-face kc-presence-initial" aria-hidden="true">
          +{hidden + 1}
        </span>
      )}
    </div>
  )
}
