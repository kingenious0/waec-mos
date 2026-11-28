'use client'

/**
 * One shared confirmation dialog for destructive/consequential actions.
 *
 * Replaces native window.confirm everywhere in the console so the whole app
 * speaks one language (Google heuristic #4 — consistency and standards):
 * - safe default focus on Cancel (not the destructive action)
 * - Escape or backdrop click cancels (user control and freedom)
 * - role="dialog" + aria-modal + aria-labelledby (assistive tech)
 * - consequence stated in plain words, not "Are you sure?"
 */

import React, { useEffect, useRef } from 'react'
import { ShieldAlert, X } from 'lucide-react'

export interface ConfirmDialogProps {
  open: boolean
  /** Plain-language statement of the consequence, e.g. "Block Elliot's account?" */
  title: string
  /** One short line explaining what happens — and how to undo it if possible. */
  description: React.ReactNode
  confirmLabel: string
  cancelLabel?: string
  /** danger = red confirm (block/delete), primary = navy confirm */
  tone?: 'danger' | 'primary'
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Safe default focus on Cancel — never on the destructive action.
  useEffect(() => {
    if (!open) return
    const t = window.setTimeout(() => cancelRef.current?.focus(), 30)
    return () => window.clearTimeout(t)
  }, [open])

  // Escape cancels
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  const danger = tone === 'danger'

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 animate-in fade-in"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-rose-500/40 bg-[#0F121E] p-5 sm:p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span
              className={`size-12 shrink-0 rounded-2xl flex items-center justify-center ${
                danger
                  ? 'bg-rose-500/15 border border-rose-500/35 text-rose-400'
                  : 'bg-indigo-500/15 border border-indigo-500/35 text-indigo-300'
              }`}
            >
              <ShieldAlert className="size-6" aria-hidden />
            </span>
            <div className="min-w-0">
              <h3
                id="confirm-dialog-title"
                className="text-base font-semibold text-white leading-snug"
              >
                {title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="size-9 shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition cursor-pointer"
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="mt-3 pl-[60px] text-xs text-slate-300 leading-relaxed">{description}</div>

        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-11 px-5 rounded-xl border border-[#22263C] bg-[#161B2E] text-xs font-semibold text-slate-200 hover:text-white hover:border-[#2E3654] transition cursor-pointer disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`h-11 px-5 rounded-xl text-xs font-semibold text-white transition cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60 min-w-[140px] ${
              danger
                ? 'bg-[#EF4444] hover:bg-red-500 active:bg-red-700'
                : 'bg-[#1E2B7B] hover:bg-[#28389E] active:bg-[#152062]'
            }`}
          >
            {busy ? (
              <span
                className="size-4 rounded-full border-2 border-white/40 border-t-white animate-spin"
                aria-hidden
              />
            ) : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
