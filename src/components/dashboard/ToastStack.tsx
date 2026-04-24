import type { ToastMessage } from './types'

type ToastStackProps = {
  toasts: ToastMessage[]
}

export function ToastStack({ toasts }: ToastStackProps) {
  return (
    <div className="kc-toast-container">
      {toasts.map((toast) => (
        <div key={toast.id} className={`kc-toast kc-toast--${toast.type}`}>
          {toast.text}
        </div>
      ))}
    </div>
  )
}
