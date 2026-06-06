'use client'

import { useEffect, useRef } from 'react'
import { AlertTriangle } from 'lucide-react'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Confirmer',
  cancelText = 'Annuler',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    confirmRef.current?.focus()

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        onCancel()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-dialog-backdrop"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="relative w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[#0e0e14] shadow-2xl p-6 animate-dialog-content"
      >
        <div className="flex items-start gap-3 mb-5">
          {danger && (
            <div className="shrink-0 w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-red-400" />
            </div>
          )}
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 id="confirm-title" className="text-base font-medium text-white/90">
              {title}
            </h3>
            {message && (
              <p className="mt-1.5 text-sm text-white/50 leading-relaxed">
                {message}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-9 px-4 rounded-xl text-sm text-white/70 hover:text-white/90 hover:bg-white/[0.05] transition-colors"
          >
            {cancelText}
          </button>
          <button
            ref={confirmRef}
            type="button"
            onClick={onConfirm}
            className={`h-9 px-4 rounded-xl text-sm font-medium transition-colors ${
              danger
                ? 'bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20'
                : 'bg-white text-[#07070a] hover:bg-white/90'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}
