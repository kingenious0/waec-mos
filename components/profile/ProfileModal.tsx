'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { SessionData } from '@/lib/auth/session'
import {
  X,
  Pencil,
  Eye,
  EyeOff,
  CheckCircle2,
  Star,
} from 'lucide-react'

interface ProfileModalProps {
  isOpen: boolean
  onClose: () => void
  session: SessionData | null
  onDutyStatus?: string
  onSave?: (updated: Partial<SessionData>) => void
}

export function ProfileModal({
  isOpen,
  onClose,
  session,
  onDutyStatus,
  onSave,
}: ProfileModalProps) {
  const [mounted, setMounted] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [staffId, setStaffId] = useState('')
  const [pin, setPin] = useState('')
  const [bio, setBio] = useState('')
  const [photo, setPhoto] = useState<string>('')
  const [isSaved, setIsSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize form state when session changes or modal opens
  useEffect(() => {
    if (session) {
      const parts = (session.name || '').trim().split(' ')
      setFirstName(parts[0] || '')
      setLastName(parts.slice(1).join(' ') || '')
      setEmail(session.email || '')
      setPhone(session.phone || '')
      setStaffId(session.staffId || '')
      setPin(session.pin || '1234')
      setPhoto(session.photo || '')
      setBio(
        session.role === 'ADMIN'
          ? 'Regional Operations Director & Surveillance Coordinator for WAEC Ashanti Region.'
          : 'Official Field Examination Officer assigned to regional depot security and materials escort.'
      )
      setIsSaved(false)
    }
  }, [session, isOpen])

  if (!isOpen || !session || !mounted) return null

  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || 'OP'
  const isLeader = Boolean(session.isGroupLeader)
  const roleName = session.role === 'ADMIN' ? 'Headquarters Admin' : 'Field Officer'
  const statusLabel = onDutyStatus || (session.status === 'ACTIVE' ? 'Active' : 'Offline')

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhoto(reader.result)
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    const fullName = `${firstName} ${lastName}`.trim()

    if (onSave) {
      onSave({
        name: fullName,
        email,
        phone,
        pin,
        photo,
      })
    }

    // Save to local storage session if it's the current user
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('waec_mos_session')
        if (stored) {
          const parsed = JSON.parse(stored)
          if (parsed.userId === session.userId) {
            const updated = {
              ...parsed,
              name: fullName,
              email,
              phone,
              pin,
              photo,
            }
            localStorage.setItem('waec_mos_session', JSON.stringify(updated))
          }
        }
      } catch {
        // Fallback
      }
    }

    setIsSaved(true)
    setTimeout(() => {
      setIsSaved(false)
      onClose()
    }, 900)
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-[#22263C] bg-[#0E111D] text-slate-100 shadow-[0_25px_80px_rgba(0,0,0,0.95)] select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Title Bar matching screenshot */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <h2 className="text-xl font-bold tracking-tight text-white font-sans">
            My Profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-full bg-[#181D2E] text-slate-400 hover:text-white hover:bg-[#222942] transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Scrollable Form Container */}
        <form onSubmit={handleSave} className="max-h-[82vh] overflow-y-auto px-6 pb-6 space-y-5">
          {/* Main Card Surface with Decorative Banner + Overlapping Avatar */}
          <div className="rounded-2xl border border-[#22263C] bg-[#121626] overflow-hidden">
            {/* Banner: Abstract Deep Blue & Cyan Pattern Header */}
            <div className="relative h-28 sm:h-32 w-full bg-gradient-to-r from-[#1E2B7B] via-[#2A3B9E] to-[#1258A2] overflow-hidden flex items-center justify-between px-6">
              <div className="absolute inset-0 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px] opacity-15" />
              <div className="absolute right-4 top-4 flex gap-1 opacity-25">
                <span className="w-1.5 h-6 bg-white rounded-full rotate-12" />
                <span className="w-1.5 h-6 bg-white rounded-full rotate-12" />
                <span className="w-1.5 h-6 bg-white rounded-full rotate-12" />
                <span className="w-1.5 h-6 bg-white rounded-full rotate-12" />
              </div>
              <div className="absolute -left-6 -bottom-6 size-24 rounded-full border-4 border-white/10 pointer-events-none" />
            </div>

            {/* Centered Overlapping Avatar (Uploadable & Replaceable) */}
            <div className="relative flex flex-col items-center -mt-12 sm:-mt-14 pb-4">
              <div className="relative group">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handlePhotoChange}
                />

                {/* Circular Avatar */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  title="Click to change profile picture"
                  className="size-24 sm:size-28 rounded-full border-4 border-[#121626] bg-[#1E2B7B] shadow-2xl flex items-center justify-center overflow-hidden text-2xl font-bold text-[#F6D300] cursor-pointer relative"
                >
                  {photo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photo}
                      alt={session.name}
                      className="size-full object-cover"
                    />
                  ) : (
                    <span>{initials}</span>
                  )}

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-[10px] text-white font-medium">
                    <Pencil className="size-4 mb-0.5 text-[#F6D300]" />
                    <span>Upload</span>
                  </div>
                </div>

                {/* Edit Pencil Badge Button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  title="Upload profile picture"
                  className="absolute bottom-0 right-1 size-7 rounded-full bg-[#1E2B7B] border-2 border-[#121626] text-white hover:text-[#F6D300] hover:bg-[#28389E] flex items-center justify-center shadow-lg transition-transform hover:scale-105 cursor-pointer"
                >
                  <Pencil className="size-3.5" />
                </button>
              </div>

              {/* Name & Role Tag below avatar */}
              <div className="text-center mt-2.5">
                <div className="flex items-center justify-center gap-1.5 font-bold text-base text-white">
                  <span>{firstName} {lastName}</span>
                  {isLeader && (
                    <span title="Leader" className="text-[#F6D300]">
                      <Star className="size-3.5 fill-[#F6D300]" />
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-center gap-2 mt-0.5 text-xs text-slate-400">
                  <span>{roleName}</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-400" />
                    {statusLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* 2-Column Clean Input Fields Form (Layout from Reference Image) */}
            <div className="p-4 sm:p-6 pt-2 space-y-4 border-t border-[#22263C]/80">
              {/* Row 1: First Name & Last Name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    First Name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="First Name"
                    className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-sky-400 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Last Name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Last Name"
                    className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-sky-400 transition-colors"
                  />
                </div>
              </div>

              {/* Row 2: Staff ID & Email Address */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Staff ID
                  </label>
                  <input
                    type="text"
                    value={staffId}
                    readOnly
                    className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17]/60 px-3.5 py-2.5 text-xs text-slate-400 cursor-not-allowed font-sans"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@waec.org"
                    className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-sky-400 transition-colors font-sans"
                  />
                </div>
              </div>

              {/* Row 3: Phone Number & Login PIN (Assigned Center Removed) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+233 24 000 0000"
                    className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-sky-400 transition-colors font-sans"
                  />
                </div>

                {/* Login PIN with Interactive Eye Toggle Button */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-semibold text-slate-300">
                      Login PIN
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer transition-colors"
                    >
                      {showPin ? <EyeOff className="size-3 text-sky-400" /> : <Eye className="size-3" />}
                      <span className={showPin ? 'text-sky-400 font-medium' : ''}>
                        {showPin ? 'Hide' : 'Show'}
                      </span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPin ? 'text' : 'password'}
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="••••"
                      className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] pl-3.5 pr-10 py-2.5 text-xs font-sans font-bold text-[#F6D300] placeholder:text-slate-500 tracking-widest focus:outline-hidden focus:border-sky-400 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPin(!showPin)}
                      aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                      title={showPin ? 'Hide PIN' : 'Show PIN'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {showPin ? <EyeOff className="size-4 text-sky-400" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Row 4: Account Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Account Status
                </label>
                <div className="flex items-center h-10 px-3.5 rounded-xl border border-[#22263C] bg-[#0A0D17]/60 text-xs font-medium text-emerald-400 gap-2">
                  <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>Verified Active</span>
                </div>
              </div>

              {/* Row 5: Notes / Bio (0/200 characters) matching screenshot */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  About / Notes
                </label>
                <textarea
                  rows={3}
                  maxLength={200}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Add brief notes about your role or station..."
                  className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] p-3 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-sky-400 transition-colors resize-none"
                />
                <div className="text-right text-[10px] text-slate-500 mt-1 font-sans">
                  {bio.length}/200 characters
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Action Buttons: Cancel & Save Changes */}
          <div className="flex items-center justify-between pt-2">
            {isSaved ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                <CheckCircle2 className="size-4" />
                <span>Changes saved successfully!</span>
              </div>
            ) : (
              <span className="text-[11px] text-slate-500">
                WAEC Official Operations Account
              </span>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[#22263C] bg-[#121626] hover:bg-[#181D2E] text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] active:bg-[#152062] border border-[#F6D300]/40 text-xs font-bold text-white shadow-lg shadow-blue-950/40 transition-colors cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
