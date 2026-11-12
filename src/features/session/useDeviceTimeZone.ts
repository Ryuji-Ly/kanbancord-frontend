import { useEffect } from 'react'
import { useSession } from '../../api/session'
import { saveDetectedTimeZone } from '../../services/meService'

/**
 * Saves this device's time zone to the account, so times typed in Discord, where the bot cannot see anyone's
 * clock, are read in the same zone the website shows. Once per tab for each signed-in person; the API keeps a
 * time zone the person chose in Discord instead.
 */
export function useDeviceTimeZone() {
  const session = useSession()
  const userId = session.status === 'signedIn' ? String(session.user.userId) : ''

  useEffect(() => {
    if (!userId) return
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (!zone) return
    const key = `kc-time-zone-sent:${userId}`
    try {
      if (sessionStorage.getItem(key) === zone) return
    } catch {
      // No session storage (a private window, say): sending it again is harmless.
    }
    saveDetectedTimeZone(zone)
      .then(() => {
        try {
          sessionStorage.setItem(key, zone)
        } catch {
          // As above.
        }
      })
      // Nothing to show anyone: Discord reads times in UTC until it is saved, and says so.
      .catch(() => undefined)
  }, [userId])
}
