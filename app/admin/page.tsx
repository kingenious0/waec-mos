'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCurrentClientSession, SessionData } from '@/lib/auth/session'
import { V1Navbar } from '@/components/shared/V1Navbar'
import { ProfileModal } from '@/components/profile/ProfileModal'
import {
  Users,
  ShieldCheck,
  UserPlus,
  Search,
  CheckCircle2,
  Key,
  X,
  Building2,
  ShieldAlert,
  User,
  Star,
  MapPin,
  Lock,
  Phone,
} from 'lucide-react'
import { UserAccount } from '@/lib/db'

export default function AdminPage() {
  const router = useRouter()
  const [session, setSession] = useState<SessionData | null>(null)

  // Data states
  const [officers, setOfficers] = useState<UserAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState('')

  // Filter states
  const [officerSearch, setOfficerSearch] = useState('')
  const [officerStatusFilter, setOfficerStatusFilter] = useState('ALL')
  const [dutyStatusFilter, setDutyStatusFilter] = useState('ALL')
  const [groupFilter, setGroupFilter] = useState('ALL')

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showResetPinModal, setShowResetPinModal] = useState<UserAccount | null>(null)
  const [showAdminProfile, setShowAdminProfile] = useState(false)
  const [inspectedOfficer, setInspectedOfficer] = useState<UserAccount | null>(null)

  // Provisioning form states
  const [newName, setNewName] = useState('')
  const [newStaffId, setNewStaffId] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newPin, setNewPin] = useState(Math.floor(1000 + Math.random() * 9000).toString())
  const [newRegion, setNewRegion] = useState('Ashanti Region')
  const [newGroup, setNewGroup] = useState('Group 1')
  const [newIsGroupLeader, setNewIsGroupLeader] = useState(false)
  const [newCenter, setNewCenter] = useState('Prempeh College Center A')
  const [newCenterCode, setNewCenterCode] = useState('050102')

  // Reset PIN state
  const [newResetPin, setNewResetPin] = useState(Math.floor(1000 + Math.random() * 9000).toString())

  // Session check
  useEffect(() => {
    const s = getCurrentClientSession()
    if (!s) {
      router.push('/login')
      return
    }
    if (s.role !== 'ADMIN') {
      router.push('/field')
      return
    }
    setSession(s)
    loadOfficers()
  }, [router])

  const loadOfficers = async () => {
    try {
      const res = await fetch('/api/officers')
      const data = await res.json()
      setOfficers(data.officers || [])
    } finally {
      setLoading(false)
    }
  }

  // --- Officer Actions ---

  const handleCreateOfficer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName || !newPhone || !newCenter) return

    try {
      const res = await fetch('/api/officers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName,
          staffId: newStaffId,
          phone: newPhone,
          pin: newPin,
          region: newRegion,
          group: newGroup,
          isGroupLeader: newIsGroupLeader,
          assignedCenter: newCenter,
          assignedCenterCode: newCenterCode,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setFeedback(data.error || 'Failed to provision officer')
        return
      }

      setOfficers((prev) => [data.officer, ...prev])
      setShowCreateModal(false)
      setFeedback(`Officer ${data.officer.name} provisioned! Login Phone: ${newPhone} · 4-Digit PIN: ${newPin}`)

      // Reset form
      setNewName('')
      setNewStaffId('')
      setNewPhone('')
      setNewPin(Math.floor(1000 + Math.random() * 9000).toString())
      setNewIsGroupLeader(false)
    } catch {
      setFeedback('Failed to provision officer.')
    }
  }

  const handleToggleStatus = async (officer: UserAccount) => {
    const targetStatus = officer.status === 'ACTIVE' ? 'REVOKED' : 'ACTIVE'
    try {
      const res = await fetch('/api/officers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: officer.id,
          action: 'TOGGLE_STATUS',
          status: targetStatus,
        }),
      })

      if (res.ok) {
        setOfficers((prev) =>
          prev.map((o) => (o.id === officer.id ? { ...o, status: targetStatus } : o))
        )
        setFeedback(
          targetStatus === 'REVOKED'
            ? `Access REVOKED for ${officer.name}. Field login locked immediately.`
            : `Access ACTIVATED for ${officer.name}. Field login restored.`
        )
      }
    } catch {
      setFeedback('Status update failed.')
    }
  }

  const handleResetPin = async () => {
    if (!showResetPinModal) return
    try {
      const res = await fetch('/api/officers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: showResetPinModal.id,
          action: 'RESET_PIN',
          newPin: newResetPin,
        }),
      })

      if (res.ok) {
        setOfficers((prev) =>
          prev.map((o) => (o.id === showResetPinModal.id ? { ...o, pin: newResetPin } : o))
        )
        setFeedback(`4-Digit PIN reset for ${showResetPinModal.name}! New PIN: ${newResetPin}`)
        setShowResetPinModal(null)
        setNewResetPin(Math.floor(1000 + Math.random() * 9000).toString())
      }
    } catch {
      setFeedback('PIN reset failed.')
    }
  }

  // Metrics
  const totalOfficers = officers.length
  const officersOnDuty = officers.filter((o) => o.dutyStatus === 'ON_DUTY').length
  const revokedAccess = officers.filter((o) => o.status === 'REVOKED').length
  const uniqueCenters = new Set(officers.map((o) => o.assignedCenter)).size

  // Filtered List
  const filteredOfficers = officers.filter((o) => {
    const q = officerSearch.toLowerCase()
    const matchSearch =
      o.name.toLowerCase().includes(q) ||
      o.staffId.toLowerCase().includes(q) ||
      o.phone.toLowerCase().includes(q) ||
      o.assignedCenter.toLowerCase().includes(q)
    const matchStatus = officerStatusFilter === 'ALL' || o.status === officerStatusFilter
    const matchDuty = dutyStatusFilter === 'ALL' || o.dutyStatus === dutyStatusFilter
    const matchGroup = groupFilter === 'ALL' || o.group === groupFilter
    return matchSearch && matchStatus && matchDuty && matchGroup
  })

  return (
    <div className="flex min-h-screen flex-col bg-[#090a0f] text-white">
      {/* Official V1 Navbar */}
      <V1Navbar session={session} />

      <main className="flex-1 p-3 sm:p-5 lg:p-6">
        <div className="mx-auto max-w-7xl space-y-5">
          {/* Top Page Header */}
          <div className="flex flex-col gap-3 rounded-2xl border border-[#22263c] bg-[#11131f] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 shadow-sm">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold tracking-widest text-[#8290ff] uppercase">
                  National HQ Operations Command
                </span>
                <span className="size-1 rounded-full bg-slate-500" />
                <span className="font-mono text-[10px] text-[#f6d300]">PILLAR 1 AUTH & PROVISIONING</span>
              </div>
              <h1 className="mt-0.5 text-lg sm:text-xl font-black text-white">
                Field Personnel Provisioning Directory
              </h1>
              <p className="text-xs text-slate-400">
                Pre-provision verified phone numbers, 4-digit PINs, assigned groups (1–10), and exam center posts.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <button
                onClick={() => setShowAdminProfile(true)}
                className="flex items-center gap-1.5 rounded-xl border border-[#303654] bg-[#15192b] px-3.5 py-2 text-xs font-bold text-slate-200 transition hover:border-[#8290ff] hover:bg-[#1e2b7b] hover:text-white"
              >
                <User size={14} className="text-[#8290ff]" />
                <span>My Profile</span>
              </button>

              <button
                onClick={() => setShowCreateModal(true)}
                className="flex items-center gap-2 rounded-xl bg-[#1e2b7b] px-4 py-2 text-xs font-black text-white shadow-[0_0_20px_rgba(46,65,182,.4)] transition hover:bg-[#2b3cb8]"
              >
                <UserPlus size={15} />
                <span>PRE-PROVISION OFFICER</span>
              </button>
            </div>
          </div>

          {/* V1 Operational Metrics Strip */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-[#22263c] bg-[#11131f] p-4">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-bold tracking-wider uppercase">Field Officers</span>
                <Users size={16} className="text-[#8290ff]" />
              </div>
              <div className="mt-2 text-2xl font-black text-white">{totalOfficers}</div>
              <div className="mt-1 text-[10px] text-slate-500">Pre-provisioned personnel</div>
            </div>

            <div className="rounded-xl border border-[#22263c] bg-[#11131f] p-4">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-bold tracking-wider uppercase">On Duty Presence</span>
                <ShieldCheck size={16} className="text-emerald-400" />
              </div>
              <div className="mt-2 text-2xl font-black text-emerald-400">{officersOnDuty}</div>
              <div className="mt-1 text-[10px] text-slate-500">Checked into exam centers</div>
            </div>

            <div className="rounded-xl border border-[#22263c] bg-[#11131f] p-4">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-bold tracking-wider uppercase">Covered Centers</span>
                <Building2 size={16} className="text-[#f6d300]" />
              </div>
              <div className="mt-2 text-2xl font-black text-white">{uniqueCenters}</div>
              <div className="mt-1 text-[10px] text-slate-500">Assigned 150m geofence posts</div>
            </div>

            <div className="rounded-xl border border-[#22263c] bg-[#11131f] p-4">
              <div className="flex items-center justify-between text-slate-400">
                <span className="text-[10px] font-bold tracking-wider uppercase">Revoked Accounts</span>
                <ShieldAlert size={16} className="text-red-400" />
              </div>
              <div className="mt-2 text-2xl font-black text-red-400">{revokedAccess}</div>
              <div className="mt-1 text-[10px] text-slate-500">Locked from PIN auth</div>
            </div>
          </div>

          {/* Feedback Banner */}
          {feedback && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5 text-xs font-bold text-emerald-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="shrink-0" />
                <span>{feedback}</span>
              </div>
              <button onClick={() => setFeedback('')} className="text-emerald-400 hover:text-white">
                <X size={15} />
              </button>
            </div>
          )}

          {/* Search, Filter, and Directory Table */}
          <div className="rounded-2xl border border-[#22263c] bg-[#11131f] p-4 sm:p-5 shadow-sm">
            {/* Filter Bar */}
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3.5 top-3 text-slate-500" />
                <input
                  type="text"
                  value={officerSearch}
                  onChange={(e) => setOfficerSearch(e.target.value)}
                  placeholder="Filter by name, verified phone, Staff ID, or center..."
                  className="w-full rounded-xl border border-[#303654] bg-[#15192b] py-2 pl-9 pr-3 text-xs text-white placeholder-slate-500 focus:border-[#8290ff] focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {/* Group Filter */}
                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="rounded-xl border border-[#303654] bg-[#15192b] px-3 py-2 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="ALL">All Groups (1–10)</option>
                  <option value="Group 1">Group 1</option>
                  <option value="Group 2">Group 2</option>
                  <option value="Group 3">Group 3</option>
                  <option value="Group 4">Group 4</option>
                  <option value="Group 5">Group 5</option>
                </select>

                <select
                  value={officerStatusFilter}
                  onChange={(e) => setOfficerStatusFilter(e.target.value)}
                  className="rounded-xl border border-[#303654] bg-[#15192b] px-3 py-2 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="ALL">All Account States</option>
                  <option value="ACTIVE">Active Access Only</option>
                  <option value="REVOKED">Revoked Access Only</option>
                </select>

                <select
                  value={dutyStatusFilter}
                  onChange={(e) => setDutyStatusFilter(e.target.value)}
                  className="rounded-xl border border-[#303654] bg-[#15192b] px-3 py-2 text-xs text-slate-300 focus:outline-none"
                >
                  <option value="ALL">All Duty Statuses</option>
                  <option value="ON_DUTY">Currently On Duty</option>
                  <option value="OFF_DUTY">Currently Off Duty</option>
                </select>
              </div>
            </div>

            {/* Officer Records Table */}
            <div className="overflow-x-auto rounded-xl border border-[#22263c]">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="border-b border-[#22263c] bg-[#0d0f18] text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Field Officer & Phone Auth</th>
                    <th className="px-4 py-3">Hierarchy & Group</th>
                    <th className="px-4 py-3">Assigned Exam Center</th>
                    <th className="px-4 py-3">4-Digit PIN</th>
                    <th className="px-4 py-3">Duty Shift</th>
                    <th className="px-4 py-3">Access</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#22263c]">
                  {filteredOfficers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-xs text-slate-500">
                        No field personnel match your search criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredOfficers.map((officer) => (
                      <tr key={officer.id} className="transition hover:bg-[#15192b]/50">
                        {/* Identity */}
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#1e2b7b] text-xs font-black text-[#f6d300]">
                              {officer.name
                                .split(' ')
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)}
                              {officer.isGroupLeader && (
                                <div className="absolute -top-1 -right-1 flex size-3.5 items-center justify-center rounded-full bg-[#f6d300] text-black">
                                  <Star size={8} className="fill-black" />
                                </div>
                              )}
                            </div>
                            <div>
                              <button
                                onClick={() => setInspectedOfficer(officer)}
                                className="font-bold text-white hover:text-[#8290ff] text-left flex items-center gap-1"
                              >
                                <span>{officer.name}</span>
                                {officer.isGroupLeader && (
                                  <span className="rounded bg-[#f6d300]/20 px-1 py-0.2 text-[8px] font-bold text-[#f6d300]">
                                    LEADER
                                  </span>
                                )}
                              </button>
                              <div className="font-mono text-[10px] text-[#f6d300]">
                                {officer.phone}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Hierarchy & Group */}
                        <td className="px-4 py-3.5">
                          <div className="inline-flex items-center gap-1 font-bold text-[#8290ff]">
                            <span>{officer.group || 'Group 1'}</span>
                          </div>
                          <div className="text-[10px] text-slate-400">{officer.region || 'Ashanti Region'}</div>
                        </td>

                        {/* Venue */}
                        <td className="px-4 py-3.5 text-slate-300">
                          <div className="font-semibold text-white">{officer.assignedCenter}</div>
                          <div className="font-mono text-[10px] text-[#f6d300]">
                            CODE: {officer.assignedCenterCode}
                          </div>
                        </td>

                        {/* 4-Digit PIN */}
                        <td className="px-4 py-3.5">
                          <span className="rounded bg-[#0d0f18] px-2 py-1 font-mono text-[11px] font-black text-[#f6d300] border border-[#303654]">
                            {officer.pin || '0412'}
                          </span>
                        </td>

                        {/* Duty */}
                        <td className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[10px] font-bold ${
                              officer.dutyStatus === 'ON_DUTY'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                officer.dutyStatus === 'ON_DUTY' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                              }`}
                            />
                            {officer.dutyStatus === 'ON_DUTY' ? 'ON DUTY' : 'OFF DUTY'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3.5">
                          <span
                            className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${
                              officer.status === 'ACTIVE'
                                ? 'bg-emerald-500/15 text-emerald-400'
                                : 'bg-red-500/15 text-red-400'
                            }`}
                          >
                            {officer.status}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setInspectedOfficer(officer)}
                              title="View Officer Dossier"
                              className="rounded border border-[#303654] bg-[#15192b] px-2 py-1 text-[10px] font-bold text-slate-300 transition hover:border-[#8290ff] hover:text-white"
                            >
                              DOSSIER
                            </button>

                            <button
                              onClick={() => setShowResetPinModal(officer)}
                              className="rounded border border-[#303654] bg-[#15192b] px-2 py-1 text-[10px] font-bold text-slate-300 transition hover:border-[#f6d300] hover:text-[#f6d300]"
                            >
                              <Lock size={10} className="inline mr-1" />
                              RESET PIN
                            </button>

                            <button
                              onClick={() => handleToggleStatus(officer)}
                              className={`rounded px-2 py-1 text-[10px] font-bold transition ${
                                officer.status === 'ACTIVE'
                                  ? 'border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20'
                                  : 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                              }`}
                            >
                              {officer.status === 'ACTIVE' ? 'REVOKE' : 'ACTIVATE'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span>Showing {filteredOfficers.length} of {officers.length} provisioned officers</span>
              <span className="font-mono text-[10px]">WAEC V1 DIRECTORY</span>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL: PRE-PROVISION FIELD OFFICER */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-[#303654] bg-[#11131f] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-[#22263c] pb-3">
              <div>
                <h2 className="text-base font-bold text-white">Pre-Provision Field Officer</h2>
                <p className="text-[10px] text-slate-400">Strictly Admin-Created · PIN Auth</p>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateOfficer} className="space-y-3">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
                  Officer Full Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kwabena Asante"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-xl border border-[#303654] bg-[#15192b] px-3 py-2 text-xs text-white placeholder-slate-600 focus:border-[#8290ff] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
                    Phone Number (Login ID)
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+233 24 000 0000"
                    value={newPhone}
                    onChange={(e) => setNewPhone(e.target.value)}
                    className="w-full rounded-xl border border-[#303654] bg-[#15192b] px-3 py-2 font-mono text-xs text-white focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
                    Secret 4-Digit PIN
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={4}
                    placeholder="4-digit PIN"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                    className="w-full rounded-xl border border-[#303654] bg-[#15192b] px-3 py-2 font-mono text-xs font-bold text-[#f6d300] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
                    Region
                  </label>
                  <select
                    value={newRegion}
                    onChange={(e) => setNewRegion(e.target.value)}
                    className="w-full rounded-xl border border-[#303654] bg-[#15192b] px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="Ashanti Region">Ashanti Region</option>
                    <option value="Greater Accra">Greater Accra</option>
                    <option value="Western Region">Western Region</option>
                    <option value="Central Region">Central Region</option>
                    <option value="Eastern Region">Eastern Region</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
                    Assigned Group (1–10)
                  </label>
                  <select
                    value={newGroup}
                    onChange={(e) => setNewGroup(e.target.value)}
                    className="w-full rounded-xl border border-[#303654] bg-[#15192b] px-3 py-2 text-xs text-white focus:outline-none"
                  >
                    <option value="Group 1">Group 1</option>
                    <option value="Group 2">Group 2</option>
                    <option value="Group 3">Group 3</option>
                    <option value="Group 4">Group 4</option>
                    <option value="Group 5">Group 5</option>
                    <option value="Group 6">Group 6</option>
                    <option value="Group 7">Group 7</option>
                    <option value="Group 8">Group 8</option>
                    <option value="Group 9">Group 9</option>
                    <option value="Group 10">Group 10</option>
                  </select>
                </div>
              </div>

              {/* Group Leader Checkbox */}
              <div className="flex items-center gap-2 rounded-xl border border-[#303654] bg-[#15192b] p-2.5">
                <input
                  type="checkbox"
                  id="leader-toggle"
                  checked={newIsGroupLeader}
                  onChange={(e) => setNewIsGroupLeader(e.target.checked)}
                  className="size-4 accent-[#f6d300]"
                />
                <label htmlFor="leader-toggle" className="text-xs font-bold text-white cursor-pointer flex items-center gap-1">
                  <span>Designate as Group Leader</span>
                  <Star size={12} className="text-[#f6d300] fill-[#f6d300]" />
                </label>
              </div>

              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-slate-400">
                  Assigned Examination Center
                </label>
                <input
                  type="text"
                  required
                  placeholder="Kumasi Academy Center A"
                  value={newCenter}
                  onChange={(e) => setNewCenter(e.target.value)}
                  className="w-full rounded-xl border border-[#303654] bg-[#15192b] px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="mt-4 flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-[#303654] px-4 py-2 text-xs font-bold text-slate-300"
                >
                  CANCEL
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#1e2b7b] px-4 py-2 text-xs font-bold text-white hover:bg-[#2b3cb8]"
                >
                  CONFIRM & PROVISION
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESET PIN */}
      {showResetPinModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[#303654] bg-[#11131f] p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white">Reset Officer 4-Digit PIN</h3>
            <p className="mt-1 text-xs text-slate-400">
              Generate a new 4-digit security PIN for <strong>{showResetPinModal.name}</strong> ({showResetPinModal.phone}).
            </p>

            <div className="my-4 rounded-xl border border-[#303654] bg-[#15192b] p-3">
              <label className="text-[10px] font-bold text-slate-400">NEW 4-DIGIT PIN</label>
              <input
                type="text"
                maxLength={4}
                value={newResetPin}
                onChange={(e) => setNewResetPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                className="mt-1 w-full rounded border border-[#303654] bg-[#11131f] p-2 font-mono text-base text-[#f6d300] font-black tracking-widest text-center focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowResetPinModal(null)}
                className="rounded-lg border border-[#303654] px-3 py-1.5 text-xs font-bold text-slate-300"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPin}
                className="rounded-lg bg-[#1e2b7b] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#2b3cb8]"
              >
                Save New PIN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: OFFICER DOSSIER (Inspected by Admin) */}
      {inspectedOfficer && (
        <ProfileModal
          isOpen={Boolean(inspectedOfficer)}
          onClose={() => setInspectedOfficer(null)}
          session={{
            userId: inspectedOfficer.id,
            staffId: inspectedOfficer.staffId,
            email: inspectedOfficer.email,
            name: inspectedOfficer.name,
            phone: inspectedOfficer.phone,
            pin: inspectedOfficer.pin,
            role: inspectedOfficer.role,
            status: inspectedOfficer.status,
            region: inspectedOfficer.region,
            group: inspectedOfficer.group,
            isGroupLeader: inspectedOfficer.isGroupLeader,
            assignedCenter: inspectedOfficer.assignedCenter,
            assignedCenterCode: inspectedOfficer.assignedCenterCode,
            photo: inspectedOfficer.photo,
            mustChangePassword: inspectedOfficer.mustChangePassword,
          }}
          onDutyStatus={inspectedOfficer.dutyStatus === 'ON_DUTY' ? 'ON DUTY' : 'OFF DUTY'}
        />
      )}

      {/* MODAL: ADMIN'S OWN PROFILE */}
      <ProfileModal
        isOpen={showAdminProfile}
        onClose={() => setShowAdminProfile(false)}
        session={session}
        onDutyStatus="HQ ACTIVE"
      />
    </div>
  )
}
