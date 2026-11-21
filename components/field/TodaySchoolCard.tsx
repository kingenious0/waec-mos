'use client'

import React, { useState } from 'react'
import { CheckCircle2, Clock3, MapPin, School, TriangleAlert } from 'lucide-react'
import { PRESENT_REASONS } from '@/lib/field/present-reasons'
import { PROOF_REQUEST_REASONS } from '@/lib/field/proof-reasons'

export interface TeamMemberPlan {
  id: string
  name: string
  phone: string
  staffId: string
  isLeader: boolean
  isSelf: boolean
  planned: { centerId: string; centerName: string | null; source: string } | null
  arrival: { at: string | null; confirmedAt: string | null; accuracyTier: string | null } | null
  departure: { at: string | null; duringPaper: boolean } | null
}

export interface TodaySchoolCardProps {
  /** The signed-in officer's own plan for today (used when no team board). */
  selfOfficerId?: string | null
  selfName?: string
  selfPlan: { centerId: string; centerName: string | null; source: string } | null
  centerOptions: { id: string; name: string }[]
  /** Group board — present only when the caller may see their group. */
  members?: TeamMemberPlan[] | null
  onSetSchool: (officerId: string, centerId: string) => void
  onMarkPresent: (officerId: string, reason: string) => void
  /** Group leader only — ask one teammate for a single watermarked photo. */
  onRequestPhoto?: (officerId: string, reason: string) => void
  busy?: boolean
}

/** "07:58" in GMT — Ghana keeps GMT year-round. */
function timeOfDay(iso?: string | null): string {
  if (!iso) return '--:--'
  const ts = Date.parse(iso)
  if (Number.isNaN(ts)) return '--:--'
  return new Date(ts).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Accra',
  })
}

function StatusLine({ member }: { member: TeamMemberPlan }) {
  if (member.arrival?.confirmedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-emerald-400">
        <CheckCircle2 className="size-3.5 shrink-0" />
        Arrived {timeOfDay(member.arrival.at)} · confirmed
      </span>
    )
  }
  if (member.arrival) {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-300">
        <Clock3 className="size-3.5 shrink-0" />
        Arrived {timeOfDay(member.arrival.at)} (app opened)
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-slate-500">
      <Clock3 className="size-3.5 shrink-0" />
      Not arrived yet
    </span>
  )
}

/**
 * Today's school, for the officer and (for a group leader) the whole team.
 *
 * Whoever sets it, the record says who set it and whether the officer has
 * actually turned up — so a leader never has to guess from a phone call.
 */
export function TodaySchoolCard({
  selfOfficerId,
  selfName,
  selfPlan,
  centerOptions,
  members = null,
  onSetSchool,
  onMarkPresent,
  onRequestPhoto,
  busy = false,
}: TodaySchoolCardProps) {
  const [reasonByOfficer, setReasonByOfficer] = useState<Record<string, string>>({})
  const [proofReasonByOfficer, setProofReasonByOfficer] = useState<Record<string, string>>({})

  const rows: TeamMemberPlan[] =
    members && members.length > 0
      ? members
      : [
          {
            id: selfOfficerId || '',
            name: selfName || 'You',
            phone: '',
            staffId: '',
            isLeader: false,
            isSelf: true,
            planned: selfPlan,
            arrival: null,
            departure: null,
          },
        ]

  if (centerOptions.length === 0) return null

  return (
    <section
      aria-label="Today's schools"
      className="w-full rounded-2xl border border-[#22263C] bg-[#11131F] p-3.5 space-y-3"
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
          <School className="size-3.5 text-indigo-400" />
          {rows.length > 1 ? 'My group today' : 'My school today'}
        </h3>
        {busy && <span className="text-[10px] font-semibold text-slate-500">Saving…</span>}
      </div>

      <ul className="space-y-2.5">
        {rows.map((m) => {
          const currentCenter = m.planned?.centerId || ''
          const reason = reasonByOfficer[m.id] || PRESENT_REASONS[0]
          return (
            <li key={m.id} className="rounded-xl border border-[#1E2438] bg-[#0D1019] p-2.5 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-200 truncate">
                    {m.name}
                    {m.isSelf && <span className="text-slate-500 font-medium"> (you)</span>}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug">
                    <StatusLine member={m} />
                  </p>
                </div>
                <MapPin className="size-3.5 text-slate-600 shrink-0 mt-1" />
              </div>

              <label className="block">
                <span className="sr-only">School for {m.name}</span>
                <select
                  value={currentCenter}
                  disabled={busy}
                  onChange={(e) => onSetSchool(m.id, e.target.value)}
                  className="w-full h-10 rounded-lg border border-[#2A3048] bg-[#0A0D17] px-2.5 text-xs text-slate-200 focus:outline-hidden focus:border-indigo-400 disabled:opacity-50 cursor-pointer"
                >
                  <option value="">Choose today&apos;s school</option>
                  {centerOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              {!m.planned && (
                <p className="text-[10px] leading-snug text-amber-300/90">
                  No school picked yet — choose one so your check-in area works.
                </p>
              )}

              {m.isSelf === false && !m.arrival && (
                <div className="flex items-center gap-1.5 pt-0.5">
                  <select
                    value={reason}
                    onChange={(e) =>
                      setReasonByOfficer((prev) => ({ ...prev, [m.id]: e.target.value }))
                    }
                    aria-label={`Reason ${m.name} has no GPS proof`}
                    className="h-9 flex-1 min-w-0 rounded-lg border border-[#2A3048] bg-[#0A0D17] px-2 text-[11px] text-slate-300 focus:outline-hidden focus:border-indigo-400 cursor-pointer"
                  >
                    {PRESENT_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onMarkPresent(m.id, reason)}
                    className="h-9 shrink-0 rounded-lg border border-white/10 bg-white/5 px-2.5 text-[11px] font-bold text-slate-200 hover:bg-white/10 transition cursor-pointer disabled:opacity-50"
                  >
                    Mark present
                  </button>
                </div>
              )}

              {onRequestPhoto && rows.length > 1 && m.isSelf === false && (
                <div className="flex items-center gap-1.5 pt-0.5 border-t border-[#1E2438] mt-1">
                  <select
                    value={proofReasonByOfficer[m.id] || PROOF_REQUEST_REASONS[0]}
                    onChange={(e) =>
                      setProofReasonByOfficer((prev) => ({ ...prev, [m.id]: e.target.value }))
                    }
                    aria-label={`Why ${m.name} should send a photo`}
                    className="h-9 flex-1 min-w-0 rounded-lg border border-[#2A3048] bg-[#0A0D17] px-2 text-[11px] text-slate-300 focus:outline-hidden focus:border-sky-400 cursor-pointer"
                  >
                    {PROOF_REQUEST_REASONS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      onRequestPhoto(m.id, proofReasonByOfficer[m.id] || PROOF_REQUEST_REASONS[0])
                    }
                    className="h-9 shrink-0 rounded-lg border border-sky-500/40 bg-sky-500/10 px-2.5 text-[11px] font-bold text-sky-200 hover:bg-sky-500/20 transition cursor-pointer disabled:opacity-50"
                  >
                    Ask for photo
                  </button>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <p className="flex items-start gap-1.5 text-[10px] leading-snug text-slate-500">
        <TriangleAlert className="size-3 shrink-0 mt-px text-slate-600" />
        Marking someone present by hand records your name and the reason. HQ sees it as
        unconfirmed until the officer taps &ldquo;I&apos;m here&rdquo; or sends a photo.
      </p>
    </section>
  )
}
