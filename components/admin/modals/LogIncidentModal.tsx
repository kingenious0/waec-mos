'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { ExamCenter } from '@/components/admin/FleetMap'
import type { UserAccount } from '@/lib/db'

export interface LogIncidentPayload {
  title: string
  category: string
  severity: string
  centerCode: string
  centerName: string
  reportedBy: string
  description: string
  isSos: boolean
}

interface LogIncidentModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (payload: LogIncidentPayload) => Promise<void>
  examCenters: ExamCenter[]
  officers: UserAccount[]
  currentUserId: string
}

export function LogIncidentModal({
  isOpen,
  onClose,
  onSubmit,
  examCenters,
  officers,
  currentUserId,
}: LogIncidentModalProps) {
  const [mounted, setMounted] = useState(false)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('SECURITY_THREAT')
  const [severity, setSeverity] = useState('HIGH')
  const [centerCode, setCenterCode] = useState('')
  const [reportedBy, setReportedBy] = useState(currentUserId)
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setTitle('')
    setCategory('SECURITY_THREAT')
    setSeverity('HIGH')
    setCenterCode(examCenters[0]?.code || '')
    setReportedBy(currentUserId)
    setDescription('')
    setError('')
    setIsSubmitting(false)
  }, [isOpen, examCenters, currentUserId])

  if (!isOpen || !mounted) return null

  const selectedCenter = examCenters.find((c) => c.code === centerCode)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!description.trim()) {
      setError('Incident description is required.')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        title: title.trim(),
        category,
        severity,
        centerCode,
        centerName: selectedCenter?.name || 'Regional Command',
        reportedBy: reportedBy || currentUserId,
        description: description.trim(),
        isSos: category === 'SOS' || severity === 'CRITICAL',
      })
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to log incident.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-[#22263C] bg-[#0E111D] text-slate-100 shadow-[0_25px_80px_rgba(0,0,0,0.95)] select-none font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-rose-500/20 border border-rose-500/40 flex items-center justify-center text-rose-400">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">
                Log Operations Incident
              </h2>
              <p className="text-xs text-slate-400">
                Record incident directly to Neon database and notify command
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-full bg-[#181D2E] text-slate-400 hover:text-white hover:bg-[#222942] transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          <div className="rounded-2xl border border-[#22263C] bg-[#121626] p-4 space-y-3.5">
            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Incident Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Exam Hall Perimeter Breach or Escort Delay"
                className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-sky-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Category
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3 py-2.5 text-xs text-white focus:outline-hidden focus:border-sky-400 cursor-pointer"
                >
                  <option value="SECURITY_THREAT">Security Threat</option>
                  <option value="SOS">Critical SOS</option>
                  <option value="MALPRACTICE">Exam Malpractice</option>
                  <option value="LOGISTICS">Logistics / Escort</option>
                  <option value="MEDICAL">Medical Emergency</option>
                  <option value="OTHER">Other Operational</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Severity
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3 py-2.5 text-xs text-white focus:outline-hidden focus:border-sky-400 cursor-pointer"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="CRITICAL">Critical (Triggers SOS Banner)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Examination Center
                </label>
                <select
                  value={centerCode}
                  onChange={(e) => setCenterCode(e.target.value)}
                  className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3 py-2.5 text-xs text-white focus:outline-hidden focus:border-sky-400 cursor-pointer"
                >
                  <option value="">Regional Command (General)</option>
                  {examCenters.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Reported By
                </label>
                <select
                  value={reportedBy}
                  onChange={(e) => setReportedBy(e.target.value)}
                  className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3 py-2.5 text-xs text-white focus:outline-hidden focus:border-sky-400 cursor-pointer"
                >
                  <option value={currentUserId}>HQ Command Controller</option>
                  {officers.map((off) => (
                    <option key={off.id} value={off.id}>
                      {off.name} ({off.staffId})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Detailed Report <span className="text-red-400">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what happened, location details, and immediate actions taken..."
                className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] p-3 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-sky-400 resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-[#22263C] bg-[#121626] hover:bg-[#181D2E] text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 text-xs font-bold text-white shadow-lg transition cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="size-3.5" />
              <span>{isSubmitting ? 'Submitting...' : 'Log Incident'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

