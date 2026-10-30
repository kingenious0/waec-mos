'use client'

import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  UserPlus,
  Eye,
  EyeOff,
  Star,
  CheckCircle2,
  Building2,
  Shield,
  Phone,
  Hash,
  MapPin,
  Users,
} from 'lucide-react'

export interface PreProvisionData {
  name: string
  staffId: string
  phone: string
  pin: string
  region: string
  group: string
  centerCode: string
  centerName: string
  isGroupLeader: boolean
}

interface PreProvisionOfficerModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (data: PreProvisionData) => void
  examCenters: Array<{ code: string; name: string }>
}

export function PreProvisionOfficerModal({
  isOpen,
  onClose,
  onSubmit,
  examCenters,
}: PreProvisionOfficerModalProps) {
  const [mounted, setMounted] = useState(false)
  const [showPin, setShowPin] = useState(false)
  const [name, setName] = useState('')
  const [staffId, setStaffId] = useState('WAEC-ASH-0105')
  const [phone, setPhone] = useState('')
  const [pin, setPin] = useState('2324')
  const [region, setRegion] = useState('Ashanti Region')
  const [group, setGroup] = useState('Group 1')
  const [centerCode, setCenterCode] = useState(examCenters[0]?.code || '050102')
  const [centerName, setCenterName] = useState(examCenters[0]?.name || 'Prempeh College Center A')
  const [isGroupLeader, setIsGroupLeader] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-generate random ID and PIN if empty
  useEffect(() => {
    if (isOpen) {
      const randNum = Math.floor(1000 + Math.random() * 9000)
      const randId = `WAEC-ASH-${Math.floor(100 + Math.random() * 900)}`
      setPin(randNum.toString())
      setStaffId(randId)
      if (examCenters.length > 0 && !centerName) {
        setCenterName(examCenters[0].name)
        setCenterCode(examCenters[0].code)
      }
    }
  }, [isOpen, examCenters])

  if (!isOpen || !mounted) return null

  const handleCenterChange = (nameSelected: string) => {
    setCenterName(nameSelected)
    const matched = examCenters.find((c) => c.name === nameSelected)
    if (matched) {
      setCenterCode(matched.code)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !phone.trim() || !pin.trim()) {
      alert('Please fill in Officer Name, Phone Number, and 4-Digit PIN.')
      return
    }

    onSubmit({
      name: name.trim(),
      staffId: staffId.trim(),
      phone: phone.trim(),
      pin: pin.trim(),
      region,
      group,
      centerCode,
      centerName,
      isGroupLeader,
    })

    // Reset and close
    setName('')
    setPhone('')
    setIsGroupLeader(false)
    onClose()
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-[#22263C] bg-[#0E111D] text-slate-100 shadow-[0_25px_80px_rgba(0,0,0,0.95)] select-none font-sans"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Top Header with Title and Close Button */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-[#1E2B7B] border border-[#F6D300]/30 flex items-center justify-center text-[#F6D300] shadow-sm">
              <UserPlus className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">
                Register Field Officer
              </h2>
              <p className="text-xs text-slate-400">
                Create official officer account with secure 4-digit PIN access
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

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="max-h-[82vh] overflow-y-auto px-6 pb-6 space-y-4">
          <div className="rounded-2xl border border-[#22263C] bg-[#121626] p-4 sm:p-5 space-y-4">
            {/* Officer Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Officer Full Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Kwabena Asante"
                className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-sky-400 transition-colors"
              />
            </div>

            {/* Row 2: Staff ID & Phone (Login ID) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Staff ID <span className="text-slate-500 font-normal">(Auto-Generated)</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    placeholder="WAEC-ASH-0105"
                    className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3.5 py-2.5 text-xs font-sans font-bold text-[#F6D300] placeholder:text-slate-500 focus:outline-hidden focus:border-sky-400 transition-colors"
                  />
                  <Hash className="size-3.5 absolute right-3 top-3 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Phone (Login ID) <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+233 24 000 0000"
                    className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3.5 py-2.5 text-xs font-sans text-white placeholder:text-slate-500 focus:outline-hidden focus:border-sky-400 transition-colors"
                  />
                  <Phone className="size-3.5 absolute right-3 top-3 text-slate-500 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Row 3: Secret 4-Digit PIN & Region */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-300">
                    Secret 4-Digit PIN <span className="text-red-400">*</span>
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
                    required
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    placeholder="••••"
                    className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] pl-3.5 pr-10 py-2.5 text-xs font-sans font-bold text-[#F6D300] tracking-widest focus:outline-hidden focus:border-sky-400 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    aria-label={showPin ? 'Hide PIN' : 'Show PIN'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {showPin ? <EyeOff className="size-4 text-sky-400" /> : <Eye className="size-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Region
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-sky-400 transition-colors cursor-pointer"
                >
                  <option value="Ashanti Region">Ashanti Region</option>
                  <option value="Greater Accra">Greater Accra</option>
                  <option value="Western Region">Western Region</option>
                  <option value="Central Region">Central Region</option>
                  <option value="Eastern Region">Eastern Region</option>
                </select>
              </div>
            </div>

            {/* Row 4: Assigned Group & Center Code */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Assigned Group
                </label>
                <select
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                  className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-sky-400 transition-colors cursor-pointer"
                >
                  {Array.from({ length: 10 }, (_, i) => `Group ${i + 1}`).map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Center Code
                </label>
                <input
                  type="text"
                  required
                  value={centerCode}
                  onChange={(e) => setCenterCode(e.target.value)}
                  placeholder="050102"
                  className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3.5 py-2.5 text-xs font-sans text-white focus:outline-hidden focus:border-sky-400 transition-colors"
                />
              </div>
            </div>

            {/* Row 5: Group Leader Toggle Badge */}
            <div
              onClick={() => setIsGroupLeader(!isGroupLeader)}
              className={`flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer ${
                isGroupLeader
                  ? 'bg-[#1E2B7B]/30 border-[#F6D300]/40 text-white'
                  : 'bg-[#0A0D17] border-[#22263C] text-slate-300 hover:border-slate-500'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`size-5 rounded-md flex items-center justify-center border transition-colors ${
                    isGroupLeader
                      ? 'bg-[#F6D300] border-[#F6D300] text-black'
                      : 'border-slate-500 bg-transparent'
                  }`}
                >
                  {isGroupLeader && <Star className="size-3.5 fill-black" />}
                </div>
                <div>
                  <span className="text-xs font-semibold flex items-center gap-1.5">
                    Designate as Group Leader
                  </span>
                  <span className="text-[11px] text-slate-400 block">
                    Grants supervisory dispatch and group escort coordinator status
                  </span>
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  isGroupLeader
                    ? 'bg-[#F6D300]/15 text-[#F6D300] border border-[#F6D300]/30'
                    : 'bg-[#1E2538] text-slate-400'
                }`}
              >
                {isGroupLeader ? 'ACTIVE LEADER' : 'REGULAR'}
              </span>
            </div>

            {/* Row 6: Assigned Examination Center Dropdown */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Assigned Examination Center
              </label>
              <select
                value={centerName}
                onChange={(e) => handleCenterChange(e.target.value)}
                className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-sky-400 transition-colors cursor-pointer"
              >
                {examCenters.map((c) => (
                  <option key={c.code} value={c.name}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Action Buttons: Cancel & Submit */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-500 hidden sm:inline">
              Instant WAEC database sync
            </span>

            <div className="flex items-center gap-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-[#22263C] bg-[#121626] hover:bg-[#181D2E] text-xs font-semibold text-slate-300 hover:text-white transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] active:bg-[#152062] border border-[#F6D300]/40 text-xs font-bold text-white shadow-lg shadow-blue-950/40 transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="size-3.5 text-[#F6D300]" />
                <span>Save & Register Officer</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
