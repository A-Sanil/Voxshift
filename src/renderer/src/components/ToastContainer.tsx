import React from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAppStore } from '../store/appStore'

export function ToastContainer(): React.ReactElement {
  const toasts = useAppStore((s) => s.toasts)
  const removeToast = useAppStore((s) => s.removeToast)

  return (
    <div className="fixed bottom-[72px] right-4 z-50 flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 20, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={[
              'pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-card-hover',
              'min-w-[280px] max-w-[360px]',
              toast.type === 'success' && 'bg-surface border border-live/20',
              toast.type === 'error' && 'bg-surface border border-red-500/20',
              toast.type === 'info' && 'bg-surface border border-accent/20'
            ].join(' ')}
          >
            {/* Icon */}
            <div className={[
              'w-6 h-6 rounded-full flex items-center justify-center shrink-0',
              toast.type === 'success' && 'bg-live-dim text-live',
              toast.type === 'error' && 'bg-red-500/10 text-red-400',
              toast.type === 'info' && 'bg-accent-dim text-accent'
            ].join(' ')}>
              {toast.type === 'success' && <CheckIcon />}
              {toast.type === 'error' && <XIcon />}
              {toast.type === 'info' && <InfoIcon />}
            </div>

            <span className="flex-1 text-sm text-text-primary">{toast.message}</span>

            {toast.action && (
              <button
                onClick={() => {
                  toast.action!.onClick()
                  removeToast(toast.id)
                }}
                className="text-xs font-medium text-accent hover:text-accent/80 shrink-0 transition-colors"
              >
                {toast.action.label}
              </button>
            )}

            <button
              onClick={() => removeToast(toast.id)}
              className="text-text-secondary hover:text-text-primary transition-colors shrink-0"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

const CheckIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
)

const XIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
)

const InfoIcon = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </svg>
)
