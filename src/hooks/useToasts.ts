import { useCallback, useRef, useState } from 'react'
import type { ToastMessage } from '../components/dashboard/types'

/** Short-lived notifications: successes disappear after 3 seconds, errors after 5. */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastMessage[]>([])
  const nextId = useRef(0)

  const showToast = useCallback((text: string, type: ToastMessage['type'] = 'success') => {
    const id = nextId.current
    nextId.current += 1
    setToasts((current) => [...current, { id, text, type }])
    window.setTimeout(
      () => setToasts((current) => current.filter((toast) => toast.id !== id)),
      type === 'success' ? 3000 : 5000,
    )
  }, [])

  return { toasts, showToast }
}
