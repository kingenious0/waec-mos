'use client'

/**
 * Non-emergency issue reporting.
 *
 * Kept visually and behaviourally separate from the red SOS trigger so an
 * officer never mistakes a routine problem for a distress call.
 */
import React, { useEffect, useState } from 'react'
import { ClipboardList, X } from 'lucide-react'

interface IncidentReportSheetProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (input: { category: string; description: string }) => Promise<void>
  centerName?: string
  isOffline?: boolean
}

const CATEGORIES = [
  'Exam paper problem',
  'Centre problem',
  'Equipment',
  'Student issue',
  'Other',
] as const

export function IncidentReportSheet({
  isOpen,
  onClose,
  onSubmit,
  centerName = 'your centre',
  isOffline = false,
}: IncidentReportSheetProps) {
  const [category, setCategory] = useState<string>('Centre problem')
  const [description, setDescription] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!isOpen) return
    setCategory('Centre problem')
    setDescription('')
    setError('')
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const submit = async () => {
    const clean = description.trim()
    if (clean.length < 3) {
      setError('Write a short description so Command knows what to check.')
      return
    }
    if (isOffline) {
      setError('You are offline. Reconnect and try again — nothing was sent.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await onSubmit({ category, description: clean })
    } catch {
      setError('Could not send the report. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#06070C]/90 p-0 backdrop-blur sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Report a non-emergency issue"
        className="w-full max-w-lg rounded-t-3xl border border-[#26304A] bg-[#0E1220] p-5 shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-center justify-between border-b border-white/10 pb-3.5">
          <div className="flex items-center gap-2.5">
            <ClipboardList className="size-5 text-sky-300" />
            <h2 className="text-base font-extrabold text-white">Report an issue</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full p-1.5 text-zinc-400 transition hover:bg-white/10 hover:text-white cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="space-y-4 py-4">
          <p className="rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2.5 text-xs leading-snug text-sky-100">
            This is for a routine problem at {centerName}. If anyone is in danger, use the red SOS
            button instead.
          </p>

          <div>
            <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-zinc-400">
              What is it about?
            </p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  aria-pressed={category === item}
                  className={`min-h-[42px] rounded-xl px-3 text-xs font-bold transition cursor-pointer ${
                    category === item
                      ? 'bg-[#3B57F0] text-white ring-2 ring-blue-300/40'
                      : 'border border-white/10 bg-white/5 text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-zinc-400">
              What happened?
            </span>
            <textarea
              value={description}
              onChange={(event) => {
                setDescription(event.target.value)
                setError('')
              }}
              rows={3}
              placeholder="Short and clear — e.g. projector not working in Room 2"
              className="w-full resize-none rounded-xl border border-white/10 bg-[#090C18] px-3 py-2.5 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-sky-500"
            />
          </label>

          {error && <p className="text-xs font-semibold text-red-300">{error}</p>}

          <button
            type="button"
            disabled={busy}
            onClick={() => void submit()}
            className="min-h-[52px] w-full rounded-xl bg-[#3B57F0] text-sm font-extrabold text-white transition hover:bg-[#314BD6] disabled:opacity-60 cursor-pointer"
          >
            {busy ? 'Sending…' : 'Send report to Command'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] w-full text-xs font-bold text-zinc-400 transition hover:text-zinc-200 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
