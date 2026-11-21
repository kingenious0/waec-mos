/**
 * Exception-only rules for HQ.
 *
 * The console shows the whole fleet; these rules decide which officers deserve
 * a line of text in the "Needs attention" list. Everything here is pure —
 * given the same day it always produces the same list, so it can be unit
 * tested without a database.
 *
 * Plain language only: a controller reads this at 07:00 with no training.
 */

export type FieldExceptionKind =
  | 'unconfirmed_arrival'
  | 'planned_vs_actual'
  | 'departure_missing'
  | 'impossible_movement'

export interface FieldException {
  kind: FieldExceptionKind
  message: string
  tone: 'warning' | 'critical'
}

export interface OfficerDayInput {
  officerName: string
  /** Server time of today's arrival, ms since epoch. null = never arrived. */
  arrivalAtMs: number | null
  /** Whether the officer pressed "I'm here" on top of the auto-detection. */
  arrivalConfirmed: boolean
  departureAtMs: number | null
  /** Where the officer was supposed to go today (plan, else deployment). */
  plannedSchool: string | null
  /** Only a real day plan makes a planned-vs-actual difference an exception. */
  hasPlan?: boolean
  /** Where the arrival event was actually recorded. */
  arrivalSchool: string | null
  nowMs: number
  /** End of today's last monitored paper, in GMT minutes past midnight. */
  lastPaperEndMinutes: number | null
  /** Speed implied by the officer's latest location jump, if flagged. */
  impossibleSpeedKmh: number | null
}

/** An arrival nobody confirmed for 10 minutes is worth a nudge. */
export const UNCONFIRMED_GRACE_MS = 10 * 60 * 1000

/** Papers are over; give the officer 15 minutes to record the departure. */
export const DEPARTURE_GRACE_MINUTES = 15

/** "07:58" from a ms timestamp, in GMT (Ghana keeps GMT year-round). */
export function formatGmtTime(ms: number): string {
  return new Date(ms).toISOString().slice(11, 16)
}

/** "08:30" clock text → minutes past midnight. null when unparseable. */
export function clockToMinutes(raw?: string | null): number | null {
  if (!raw) return null
  const m = String(raw).match(/(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (Number.isNaN(h) || Number.isNaN(min) || h > 23 || min > 59) return null
  return h * 60 + min
}

/** Minutes past midnight GMT for a moment in time. */
export function minutesOfDay(ms: number): number {
  const iso = new Date(ms).toISOString()
  return Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16))
}

export function evaluateOfficerDay(input: OfficerDayInput): FieldException[] {
  const out: FieldException[] = []

  if (input.impossibleSpeedKmh !== null && input.impossibleSpeedKmh > 0) {
    out.push({
      kind: 'impossible_movement',
      message: `${input.officerName} location jumped ${input.impossibleSpeedKmh} km/h — position treated as unreliable`,
      tone: 'critical',
    })
  }

  if (
    input.arrivalAtMs !== null &&
    !input.arrivalConfirmed &&
    input.nowMs - input.arrivalAtMs >= UNCONFIRMED_GRACE_MS
  ) {
    out.push({
      kind: 'unconfirmed_arrival',
      message: `${input.officerName} arrived ${formatGmtTime(input.arrivalAtMs)} — still not confirmed`,
      tone: 'warning',
    })
  }

  if (
    input.hasPlan &&
    input.plannedSchool &&
    input.arrivalSchool &&
    input.plannedSchool.trim().toLowerCase() !== input.arrivalSchool.trim().toLowerCase()
  ) {
    out.push({
      kind: 'planned_vs_actual',
      message: `${input.officerName}: planned ${input.plannedSchool} · arrived at ${input.arrivalSchool}`,
      tone: 'warning',
    })
  }

  if (
    input.arrivalAtMs !== null &&
    input.departureAtMs === null &&
    input.lastPaperEndMinutes !== null &&
    minutesOfDay(input.nowMs) >= input.lastPaperEndMinutes + DEPARTURE_GRACE_MINUTES
  ) {
    out.push({
      kind: 'departure_missing',
      message: `${input.officerName} finished ${String(
        Math.floor(input.lastPaperEndMinutes / 60)
      ).padStart(2, '0')}:${String(input.lastPaperEndMinutes % 60).padStart(2, '0')} — departure not recorded`,
      tone: 'warning',
    })
  }

  return out
}

/** One day's fleet totals — the "8 of 14 arrived" line. */
export interface ArrivalsSummary {
  assigned: number
  arrived: number
  confirmed: number
  unconfirmed: number
  enRoute: number
}

export function summarizeArrivals(input: {
  assigned: number
  arrived: number
  confirmed: number
}): ArrivalsSummary {
  const arrived = Math.max(0, Math.min(input.arrived, input.assigned))
  const confirmed = Math.max(0, Math.min(input.confirmed, arrived))
  return {
    assigned: input.assigned,
    arrived,
    confirmed,
    unconfirmed: arrived - confirmed,
    enRoute: Math.max(0, input.assigned - arrived),
  }
}
