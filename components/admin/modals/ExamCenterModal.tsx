'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Building2, CheckCircle2 } from 'lucide-react'
import type { ExamCenter } from '@/components/admin/FleetMap'

export interface DistrictOption {
  id: string
  name: string
  code: string
  regionId: string
}

export interface ExamCenterFormPayload {
  id?: string
  name: string
  code: string
  lat: number
  lng: number
  radius: number
  districtId: string
  supervisorContact: string
}

interface ExamCenterModalProps {
  isOpen: boolean
  mode: 'create' | 'edit'
  initialCenter?: ExamCenter | null
  districts: DistrictOption[]
  defaultRadius?: number
  onClose: () => void
  onSubmit: (payload: ExamCenterFormPayload) => Promise<void>
}

export function ExamCenterModal({
  isOpen,
  mode,
  initialCenter,
  districts,
  defaultRadius = 150,
  onClose,
  onSubmit,
}: ExamCenterModalProps) {
  const [mounted, setMounted] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [lat, setLat] = useState('6.7028')
  const [lng, setLng] = useState('-1.6369')
  const [radius, setRadius] = useState(String(defaultRadius))
  const [districtId, setDistrictId] = useState('')
  const [supervisorContact, setSupervisorContact] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    setError('')
    setIsSubmitting(false)
    if (mode === 'edit' && initialCenter) {
      setName(initialCenter.name)
      setCode(initialCenter.code)
      setLat(String(initialCenter.lat))
      setLng(String(initialCenter.lng))
      setRadius(String(initialCenter.radius || defaultRadius))
      setDistrictId(initialCenter.districtId || districts[0]?.id || 'dist-kumasi-metro')
      setSupervisorContact(initialCenter.supervisorContact || '')
    } else {
      setName('')
      setCode('')
      setLat('6.6924')
      setLng('-1.6241')
      setRadius(String(defaultRadius))
      setDistrictId(districts[0]?.id || 'dist-kumasi-metro')
      setSupervisorContact('')
    }
  }, [isOpen, mode, initialCenter, districts, defaultRadius])

  if (!isOpen || !mounted) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const parsedLat = Number(lat)
    const parsedLng = Number(lng)
    const parsedRadius = Number(radius)

    if (!name.trim() || !code.trim()) {
      setError('Center name and index code are required.')
      return
    }
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
      setError('Enter valid numeric latitude and longitude coordinates.')
      return
    }
    if (Number.isNaN(parsedRadius) || parsedRadius < 25) {
      setError('Geofence radius must be at least 25 meters.')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        id: mode === 'edit' ? initialCenter?.id : undefined,
        name: name.trim(),
        code: code.trim(),
        lat: parsedLat,
        lng: parsedLng,
        radius: Math.round(parsedRadius),
        districtId,
        supervisorContact: supervisorContact.trim(),
      })
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to save examination center.')
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
            <div className="size-9 rounded-xl bg-[#1E2B7B] border border-[#F6D300]/30 flex items-center justify-center text-[#F6D300]">
              <Building2 className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">
                {mode === 'edit' ? 'Edit Examination Center' : 'Register Examination Center'}
              </h2>
              <p className="text-xs text-slate-400">
                Configure venue coordinates and geofence perimeter in database
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
                Center Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. St. Louis Senior High Center 1"
                className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-sky-400"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Index Code <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="050412"
                  className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3.5 py-2.5 text-xs text-[#F6D300] font-bold placeholder:text-slate-500 focus:outline-hidden focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  District
                </label>
                <select
                  value={districtId}
                  onChange={(e) => setDistrictId(e.target.value)}
                  className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-sky-400 cursor-pointer"
                >
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                  {districts.length === 0 && (
                    <option value="dist-kumasi-metro">Kumasi Metropolitan</option>
                  )}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3 py-2.5 text-xs text-white focus:outline-hidden focus:border-sky-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3 py-2.5 text-xs text-white focus:outline-hidden focus:border-sky-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Radius (m)
                </label>
                <input
                  type="number"
                  min={25}
                  max={2000}
                  required
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3 py-2.5 text-xs text-sky-400 font-bold focus:outline-hidden focus:border-sky-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Center Supervisor Contact
              </label>
              <input
                type="tel"
                value={supervisorContact}
                onChange={(e) => setSupervisorContact(e.target.value)}
                placeholder="+233 24 000 0000"
                className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-sky-400"
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
              className="px-5 py-2 rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] border border-[#F6D300]/40 disabled:opacity-60 text-xs font-bold text-white shadow-lg transition cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="size-3.5 text-[#F6D300]" />
              <span>{isSubmitting ? 'Saving...' : mode === 'edit' ? 'Save Center Changes' : 'Register Center'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
