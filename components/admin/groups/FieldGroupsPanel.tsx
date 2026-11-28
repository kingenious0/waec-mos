'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  Check,
  Crown,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  School,
  Trash2,
  UserRoundCheck,
  UsersRound,
  X,
} from 'lucide-react'
import { todayGmt } from '@/lib/field/group-assignment'

interface Member {
  id: string
  name: string
  phone: string
  staffId: string
  groupName: string | null
  regionId: string | null
  regionName: string | null
  isGroupLeader: boolean
  status: string
}

interface Assignment {
  id: string
  groupId: string | null
  officerId: string
  centerId: string
  centerName: string
  centerCode: string
  source: string
}

interface FieldGroup {
  id: string
  name: string
  regionId: string
  regionName: string | null
  leaderOfficerId: string | null
  leaderName: string | null
  members: Member[]
  assignments: Assignment[]
}

interface RegionOption {
  id: string
  name: string
  code: string
}

interface CenterOption {
  id: string
  name: string
  code: string
  regionId: string
  regionName: string
}

interface GroupsPayload {
  success?: boolean
  isLiveDb?: boolean
  date: string
  groups: FieldGroup[]
  regions: RegionOption[]
  officers: Member[]
  centers: CenterOption[]
}

interface FieldGroupsPanelProps {
  onFeedback?: (message: string) => void
}

const emptyPayload = (date: string): GroupsPayload => ({
  date,
  groups: [],
  regions: [],
  officers: [],
  centers: [],
})

const inputClass =
  'w-full h-11 rounded-xl border border-[#2A3048] bg-[#0A0D17] px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-400 disabled:opacity-50'

const buttonClass =
  'inline-flex items-center justify-center gap-1.5 min-h-[44px] rounded-xl px-3.5 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'

/**
 * Admin's single screen for the real WAEC workflow:
 * group → region → officers → each officer's school for a chosen day.
 */
export function FieldGroupsPanel({ onFeedback }: FieldGroupsPanelProps) {
  const notify = useCallback(
    (message: string) => {
      if (onFeedback) onFeedback(message)
    },
    [onFeedback],
  )

  const [date, setDate] = useState(() => todayGmt())
  const [data, setData] = useState<GroupsPayload>(() => emptyPayload(todayGmt()))
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [draft, setDraft] = useState({ name: '', regionId: '', leaderOfficerId: '' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState({ name: '', regionId: '', leaderOfficerId: '' })

  const [addByGroup, setAddByGroup] = useState<Record<string, string>>({})
  const [bulkCenterByGroup, setBulkCenterByGroup] = useState<Record<string, string>>({})
  const [centerByRow, setCenterByRow] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/field/groups?date=${encodeURIComponent(date)}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || 'Could not load groups.')
      setData({ ...emptyPayload(date), ...json, date })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load groups.'
      setError(message)
      notify(message)
    } finally {
      setLoading(false)
    }
  }, [date, notify])

  useEffect(() => {
    void load()
  }, [load])

  const regions = useMemo(() => data.regions || [], [data.regions])
  const groups = useMemo(() => data.groups || [], [data.groups])
  const officers = useMemo(() => data.officers || [], [data.officers])
  const centers = useMemo(() => data.centers || [], [data.centers])

  const regionName = (id: string | null) =>
    regions.find((r) => r.id === id)?.name || 'Region not set'

  const centersForGroup = (group: FieldGroup) =>
    centers.filter((c) => c.regionId === group.regionId)

  const runMutation = async (
    key: string,
    url: string,
    init: RequestInit,
    successMessage: string,
  ) => {
    setBusy(key)
    setError('')
    try {
      const res = await fetch(url, { ...init, cache: 'no-store' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json?.error || 'That change could not be saved.')
      notify(successMessage)
      await load()
      return true
    } catch (err) {
      const message = err instanceof Error ? err.message : 'That change could not be saved.'
      setError(message)
      notify(message)
      return false
    } finally {
      setBusy(null)
    }
  }

  const createGroup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.name.trim() || !draft.regionId) {
      notify('Enter a group name and choose its region.')
      return
    }
    const ok = await runMutation(
      'create',
      '/api/field/groups',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: draft.name.trim(),
          regionId: draft.regionId,
          leaderOfficerId: draft.leaderOfficerId || null,
        }),
      },
      `${draft.name.trim()} created.`,
    )
    if (ok) {
      setDraft({ name: '', regionId: '', leaderOfficerId: '' })
      setShowCreate(false)
    }
  }

  const saveGroup = async (group: FieldGroup) => {
    if (!editDraft.name.trim() || !editDraft.regionId) {
      notify('Enter a group name and choose its region.')
      return
    }
    const ok = await runMutation(
      `edit-${group.id}`,
      '/api/field/groups',
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: group.id,
          name: editDraft.name.trim(),
          regionId: editDraft.regionId,
          leaderOfficerId: editDraft.leaderOfficerId || null,
        }),
      },
      `${group.name} updated.`,
    )
    if (ok) setEditingId(null)
  }

  const deleteGroup = async (group: FieldGroup) => {
    if (
      !window.confirm(
        `Remove ${group.name}? Its officers will be released and this group's school plan will be cleared.`,
      )
    ) {
      return
    }
    await runMutation(
      `delete-${group.id}`,
      `/api/field/groups?id=${encodeURIComponent(group.id)}`,
      { method: 'DELETE' },
      `${group.name} removed.`,
    )
  }

  const changeMember = async (
    group: FieldGroup,
    officerId: string,
    action: 'add' | 'remove' | 'make-leader',
  ) => {
    await runMutation(
      `member-${officerId}`,
      '/api/field/groups/members',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: group.id, officerId, action }),
      },
      action === 'make-leader'
        ? 'Group leader updated.'
        : action === 'remove'
        ? 'Officer removed from the group.'
        : 'Officer added to the group.',
    )
    if (action === 'add') {
      setAddByGroup((prev) => ({ ...prev, [group.id]: '' }))
    }
  }

  const assignSchool = async (group: FieldGroup, officerId?: string, centerId?: string) => {
    if (!centerId) {
      notify('Choose a school first.')
      return
    }
    await runMutation(
      `assign-${group.id}-${officerId || 'all'}`,
      '/api/field/groups/assignments',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId: group.id,
          ...(officerId ? { officerId } : {}),
          centerId,
          date,
        }),
      },
      officerId
        ? 'School saved for this officer.'
        : `All ${group.members.length} officers assigned.`,
    )
  }

  const clearSchool = async (group: FieldGroup, officerId: string) => {
    await runMutation(
      `clear-${officerId}`,
      `/api/field/groups/assignments?groupId=${encodeURIComponent(
        group.id,
      )}&officerId=${encodeURIComponent(officerId)}&date=${encodeURIComponent(date)}`,
      { method: 'DELETE' },
      'School cleared for this day.',
    )
  }

  const renderGroupForm = (mode: 'create' | 'edit', group?: FieldGroup) => {
    const value = mode === 'create' ? draft : editDraft
    const setValue = mode === 'create' ? setDraft : setEditDraft
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (mode === 'create') void createGroup(e)
          else if (group) void saveGroup(group)
        }}
        className="rounded-xl border border-[#2A3048] bg-[#0D1019] p-3 space-y-3"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-400">Group name</span>
            <input
              required
              value={value.name}
              onChange={(e) => setValue({ ...value, name: e.target.value })}
              placeholder="e.g. Group 1"
              maxLength={60}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-semibold text-slate-400">Region</span>
            <select
              required
              value={value.regionId}
              onChange={(e) => setValue({ ...value, regionId: e.target.value })}
              className={inputClass}
            >
              <option value="">Choose a region</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-400">
            Group leader <span className="font-normal text-slate-500">(optional)</span>
          </span>
          <select
            value={value.leaderOfficerId}
            onChange={(e) => setValue({ ...value, leaderOfficerId: e.target.value })}
            className={inputClass}
          >
            <option value="">No leader yet</option>
            {officers
              .filter((o) => !o.regionId || o.regionId === value.regionId)
              .map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                  {o.staffId ? ` · ${o.staffId}` : ''}
                </option>
              ))}
          </select>
        </label>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={busy !== null}
            className={`${buttonClass} bg-[#3b57f0] text-white hover:bg-[#4b65ff]`}
          >
            {busy !== null ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {mode === 'create' ? 'Create group' : 'Save changes'}
          </button>
          <button
            type="button"
            onClick={() => {
              if (mode === 'create') setShowCreate(false)
              else setEditingId(null)
            }}
            className={`${buttonClass} border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10`}
          >
            <X className="size-4" />
            Cancel
          </button>
        </div>
      </form>
    )
  }

  return (
    <div className="flex-1 min-w-0 overflow-y-auto bg-[#090A0F] font-sans">
      <div className="mx-auto w-full max-w-7xl p-4 lg:p-6 pb-28 lg:pb-8 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">Field groups</h2>
            <p className="mt-1 text-xs leading-relaxed text-slate-400 max-w-2xl">
              Set up the way teams work in the field: one group covers one region, a leader looks
              after the group, and each officer gets their own school for the day.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Refresh groups"
              className={`${buttonClass} border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10`}
            >
              <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowCreate((v) => !v)}
              className={`${buttonClass} bg-[#3b57f0] text-white hover:bg-[#4b65ff]`}
            >
              {showCreate ? <X className="size-4" /> : <Plus className="size-4" />}
              {showCreate ? 'Close' : 'New group'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            ['1', 'Create the group', 'Give it a name and choose its region.'],
            ['2', 'Add the officers', 'Choose who is in the group and who leads it.'],
            ['3', 'Pick the schools', 'Choose the date, then assign each officer in that region.'],
          ].map(([step, title, detail]) => (
            <div
              key={step}
              className="rounded-xl border border-[#22263C] bg-[#11131F] p-3 flex gap-3"
            >
              <span className="size-6 shrink-0 rounded-full bg-[#1E2B7B]/60 text-indigo-200 text-xs font-semibold flex items-center justify-center">
                {step}
              </span>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200">{title}</p>
                <p className="mt-0.5 text-xs leading-snug text-slate-500">{detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#22263C] bg-[#11131F] px-3.5 py-3">
          <CalendarDays className="size-4 text-indigo-400 shrink-0" />
          <label className="flex items-center gap-2 min-h-[44px]">
            <span className="text-xs font-semibold text-slate-400">Showing schools for</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value || todayGmt())}
              className="h-11 rounded-xl border border-[#2A3048] bg-[#0A0D17] px-3 text-sm text-slate-100 focus:outline-hidden focus:border-indigo-400"
            />
          </label>
          <span className="text-xs text-slate-500">
            Ghana uses GMT. Changes save straight away.
          </span>
        </div>

        {showCreate && renderGroupForm('create')}

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/40 bg-rose-500/10 px-3.5 py-3 text-xs text-rose-200">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading && groups.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-[#22263C] bg-[#0E111D]/60 p-10 text-xs text-slate-400">
            <Loader2 className="size-4 animate-spin" />
            Loading groups…
          </div>
        ) : groups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#22263C] bg-[#0E111D]/60 p-10 text-center space-y-2">
            <UsersRound className="size-7 text-slate-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-300">No field groups yet</p>
            <p className="text-xs text-slate-500">
              Create the first group and link it to a region to start assigning schools.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {groups.map((group) => {
              const groupCenters = centersForGroup(group)
              const availableOfficers = officers.filter(
                (o) =>
                  !group.members.some((m) => m.id === o.id) &&
                  (!o.regionId || o.regionId === group.regionId),
              )
              return (
                <section
                  key={group.id}
                  className="rounded-2xl border border-[#22263C] bg-[#11131F] p-4 space-y-4 min-w-0"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-white truncate">{group.name}</h3>
                        <span className="inline-flex items-center gap-1 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-200">
                          <MapPin className="size-3" />
                          {group.regionName || regionName(group.regionId)}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-400">
                        <span className="font-semibold text-slate-200">{group.members.length}</span>{' '}
                        {group.members.length === 1 ? 'officer' : 'officers'} · Leader:{' '}
                        <span className="font-semibold text-slate-200">
                          {group.leaderName || 'Not chosen'}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingId(editingId === group.id ? null : group.id)
                          setEditDraft({
                            name: group.name,
                            regionId: group.regionId,
                            leaderOfficerId: group.leaderOfficerId || '',
                          })
                        }}
                        aria-label={`Edit ${group.name}`}
                        className="size-11 rounded-xl border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 flex items-center justify-center cursor-pointer"
                      >
                        <Pencil className="size-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteGroup(group)}
                        aria-label={`Remove ${group.name}`}
                        className="size-11 rounded-xl border border-rose-500/25 bg-rose-500/5 text-rose-300 hover:bg-rose-500/15 flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  {editingId === group.id && renderGroupForm('edit', group)}

                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-slate-500">Officers in this group</p>
                    {group.members.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-[#22263C] px-3 py-3 text-xs text-slate-500">
                        No officers added yet.
                      </p>
                    ) : (
                      <ul className="space-y-1.5">
                        {group.members.map((member) => (
                          <li
                            key={member.id}
                            className="flex flex-wrap items-center gap-2 rounded-xl border border-[#1E2438] bg-[#0D1019] px-3 py-2"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-semibold text-slate-200 truncate">
                                {member.name}
                                {member.id === group.leaderOfficerId && (
                                  <Crown className="inline size-3 ml-1 text-amber-300" />
                                )}
                              </span>
                              <span className="block text-xs text-slate-500 truncate">
                                {member.phone || member.staffId || 'No contact on file'}
                              </span>
                            </span>
                            {member.id !== group.leaderOfficerId && (
                              <button
                                type="button"
                                disabled={busy !== null}
                                onClick={() => void changeMember(group, member.id, 'make-leader')}
                                className="min-h-[36px] rounded-lg border border-amber-500/25 bg-amber-500/5 px-2 text-xs font-semibold text-amber-200 hover:bg-amber-500/15 disabled:opacity-50 cursor-pointer"
                              >
                                Make leader
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={busy !== null}
                              onClick={() => void changeMember(group, member.id, 'remove')}
                              aria-label={`Remove ${member.name}`}
                              className="size-9 rounded-lg border border-white/10 bg-white/5 text-slate-400 hover:bg-white/10 disabled:opacity-50 flex items-center justify-center cursor-pointer"
                            >
                              <X className="size-3.5" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <select
                        value={addByGroup[group.id] || ''}
                        onChange={(e) =>
                          setAddByGroup((prev) => ({ ...prev, [group.id]: e.target.value }))
                        }
                        aria-label={`Choose an officer to add to ${group.name}`}
                        className={`${inputClass} sm:flex-1`}
                      >
                        <option value="">Choose an officer to add</option>
                        {availableOfficers.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                            {o.groupName ? ` · ${o.groupName}` : ''}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busy !== null || !addByGroup[group.id]}
                        onClick={() => void changeMember(group, addByGroup[group.id], 'add')}
                        className={`${buttonClass} border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10`}
                      >
                        <UserRoundCheck className="size-4" />
                        Add officer
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-[#1E2438] pt-3">
                    <p className="text-xs font-semibold text-slate-500">Schools for {date}</p>
                    {groupCenters.length === 0 ? (
                      <p className="rounded-xl border border-dashed border-[#22263C] px-3 py-3 text-xs text-amber-300/90">
                        No centres in this region yet. Register a centre in{' '}
                        {group.regionName || regionName(group.regionId)} first.
                      </p>
                    ) : (
                      <>
                        <div className="flex flex-col sm:flex-row gap-2 rounded-xl border border-[#2A3048] bg-[#0A0D17] p-2.5">
                          <select
                            value={bulkCenterByGroup[group.id] || ''}
                            onChange={(e) =>
                              setBulkCenterByGroup((prev) => ({
                                ...prev,
                                [group.id]: e.target.value,
                              }))
                            }
                            aria-label={`Choose one school for the whole ${group.name}`}
                            className={`${inputClass} sm:flex-1`}
                          >
                            <option value="">Assign the whole group to one school</option>
                            {groupCenters.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                          <button
                            type="button"
                            disabled={busy !== null || !bulkCenterByGroup[group.id]}
                            onClick={() =>
                              void assignSchool(group, undefined, bulkCenterByGroup[group.id])
                            }
                            className={`${buttonClass} bg-[#1E2B7B] text-white hover:bg-[#263699]`}
                          >
                            Assign all
                          </button>
                        </div>

                        {group.members.length === 0 ? (
                          <p className="px-1 text-xs text-slate-500">
                            Add officers above before assigning schools.
                          </p>
                        ) : (
                          <ul className="space-y-2">
                            {group.members.map((member) => {
                              const assigned = group.assignments.find(
                                (a) => a.officerId === member.id,
                              )
                              const key = `${group.id}:${member.id}`
                              const selected = centerByRow[key] ?? assigned?.centerId ?? ''
                              return (
                                <li
                                  key={member.id}
                                  className="rounded-xl border border-[#1E2438] bg-[#0D1019] p-2.5 space-y-1.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-semibold text-slate-300 truncate">
                                      {member.name}
                                    </p>
                                    {assigned && (
                                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-400">
                                        <Check className="size-3" />
                                        Saved
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex flex-col sm:flex-row gap-2">
                                    <select
                                      value={selected}
                                      onChange={(e) =>
                                        setCenterByRow((prev) => ({
                                          ...prev,
                                          [key]: e.target.value,
                                        }))
                                      }
                                      aria-label={`School for ${member.name}`}
                                      className={`${inputClass} sm:flex-1`}
                                    >
                                      <option value="">Choose this officer’s school</option>
                                      {groupCenters.map((c) => (
                                        <option key={c.id} value={c.id}>
                                          {c.name}
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      type="button"
                                      disabled={busy !== null || !selected}
                                      onClick={() => void assignSchool(group, member.id, selected)}
                                      className={`${buttonClass} bg-[#3b57f0] text-white hover:bg-[#4b65ff]`}
                                    >
                                      <School className="size-4" />
                                      Save
                                    </button>
                                    {assigned && (
                                      <button
                                        type="button"
                                        disabled={busy !== null}
                                        onClick={() => void clearSchool(group, member.id)}
                                        aria-label={`Clear school for ${member.name}`}
                                        className={`${buttonClass} border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10`}
                                      >
                                        Clear
                                      </button>
                                    )}
                                  </div>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </>
                    )}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
