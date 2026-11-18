import { NextResponse } from 'next/server'
import { db, isLiveDatabase, store } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { parseGeofenceRadiusMeters } from '@/lib/settings-utils'
import { getServerUser, roleKind } from '@/lib/auth/guard'
import { desc, eq, or, asc, sql, inArray, and } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

/** Today in GMT — Ghana keeps GMT year-round, and the timetable is stored as GMT text. */
const todayGmt = () => new Date().toISOString().slice(0, 10)

const parseMinutes = (raw?: string | null): number | null => {
  if (!raw) return null
  const m = String(raw).match(/(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (Number.isNaN(h) || Number.isNaN(min) || h > 23 || min > 59) return null
  return h * 60 + min
}
const fmtTime = (mins: number) =>
  `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`

interface TimetablePaper {
  paperName: string
  startTime: string | null
  endTime: string | null
  sessionSlot: string | null
  sortOrder: number | null
}

/** Build the day's timeline from the real timetable — nothing invented. */
function buildTimeline(papers: TimetablePaper[]) {
  const starts = papers.map((p) => parseMinutes(p.startTime)).filter((n): n is number => n !== null)
  const timeline: Array<{ time: string; label: string; isHighlight: boolean }> = []

  if (starts.length > 0) {
    const arrive = Math.max(0, Math.min(...starts) - 60)
    timeline.push({ time: fmtTime(arrive), label: 'Check-in opens', isHighlight: true })
  }

  for (const p of papers) {
    if (p.startTime) {
      timeline.push({ time: p.startTime, label: `${p.paperName} begins`, isHighlight: false })
    } else {
      timeline.push({ time: 'TBC', label: `${p.paperName} — time not confirmed by WAEC`, isHighlight: false })
    }
    if (p.endTime) {
      timeline.push({ time: p.endTime, label: `${p.paperName} ends`, isHighlight: false })
    }
  }
  return timeline
}

export async function GET(request: Request) {
  try {
    const caller = await getServerUser(request as any)
    if (!caller) {
      return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
    }
    const { searchParams } = new URL(request.url)
    let officerId = searchParams.get('officerId') || searchParams.get('userId')

    // Officers may only view their own duty; command staff may view anyone's.
    if (roleKind(caller.role) === 'officer') {
      officerId = caller.id
    }
    if (!officerId) {
      return NextResponse.json({ error: 'officerId is required' }, { status: 400 })
    }

    const todayStr = todayGmt()

    let refreshIntervalMs = 10_000
    if (isLiveDatabase && db) {
      const settingsRows = await db
        .select({
          refresh: schema.systemSettings.locationRefreshInterval,
        })
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.id, 'default-ashanti'))
        .limit(1)
      const m = String(settingsRows[0]?.refresh || '').match(/(\d+)/)
      if (m) refreshIntervalMs = Math.max(3000, Number(m[1]) * 1000)
    }

    if (!isLiveDatabase || !db) {
      return NextResponse.json({
        success: true,
        isLiveDb: false,
        isDeployed: false,
        seriesName: null,
        venue: null,
        papers: [],
        timeline: [],
        arriveBy: null,
        nextPaper: null,
        isCheckedIn: false,
        assignmentStatus: 'UNASSIGNED',
        checkInTimeIso: null,
        checkInTimeFormatted: null,
        isSosActive: false,
        refreshIntervalMs,
      })
    }

    // Deployments for this officer — series anchors ('') and per-day overrides win for that day.
    const deploymentRows = await db
      .select()
      .from(schema.officerDeployments)
      .where(eq(schema.officerDeployments.officerId, officerId))

    const todayOverrides = deploymentRows.filter((d) => d.deploymentDate === todayStr)
    const seriesAnchors = deploymentRows.filter((d) => !d.deploymentDate)
    // A per-day deployment replaces the series anchor for that day.
    const activeDeployments = todayOverrides.length > 0 ? todayOverrides : seriesAnchors

    const isDeployed = activeDeployments.length > 0
    const deployment = activeDeployments[0] || null

    // Today's plan (group rotation) — the leader or officer picks today's school.
    // A plan set for today overrides the deployment anchor for the day.
    const planRows = await db
      .select({
        centerId: schema.dailySchoolAssignments.centerId,
        source: schema.dailySchoolAssignments.source,
      })
      .from(schema.dailySchoolAssignments)
      .where(and(eq(schema.dailySchoolAssignments.officerId, officerId), eq(schema.dailySchoolAssignments.date, todayStr)))
      .limit(1)
    const planCenterId = planRows[0]?.centerId || null

    // Venue — today's plan wins, then the winning deployment's centre.
    let venue: any = null
    if (planCenterId || deployment?.centerId) {
      const venueCenterId = planCenterId || deployment?.centerId as string
      const centreRows = await db
        .select({
          id: schema.examinationCenters.id,
          name: schema.examinationCenters.centerName,
          code: schema.examinationCenters.centerCode,
          lat: schema.examinationCenters.latitude,
          lng: schema.examinationCenters.longitude,
          radius: schema.examinationCenters.geofenceRadiusMeters,
          districtName: schema.districts.name,
          regionName: schema.regions.name,
        })
        .from(schema.examinationCenters)
        .leftJoin(schema.districts, eq(schema.examinationCenters.districtId, schema.districts.id))
        .leftJoin(schema.regions, eq(schema.districts.regionId, schema.regions.id))
        .where(eq(schema.examinationCenters.id, venueCenterId))
        .limit(1)
      const c = centreRows[0]
      if (c) {
        venue = {
          name: c.name,
          code: c.code,
          zone: c.districtName ? `${c.districtName} Examination Zone` : 'Examination Zone',
          region: c.regionName || 'Ashanti Region',
          lat: Number(c.lat),
          lng: Number(c.lng),
          radiusMeters: Number(c.radius) || parseGeofenceRadiusMeters('150m'),
        }
      }
    }

    // Today's papers for the active deployment(s).
    const operationIds = Array.from(new Set(activeDeployments.map((d) => d.operationId).filter(Boolean)))

    // Curated monitoring: if any monitored papers exist for this series, only
    // those ride to the field app. Otherwise (fresh series) everything does.
    let filterToMonitored = false
    let monitoredIds = new Set<string>()
    if (operationIds.length > 0) {
      const monitored = await db
        .select({ paperId: schema.monitoredPapers.paperId })
        .from(schema.monitoredPapers)
        .where(inArray(schema.monitoredPapers.operationId, operationIds))
      monitoredIds = new Set(monitored.map((m) => m.paperId))
      filterToMonitored = monitoredIds.size > 0
    }

    // Today's papers for the active deployment(s).
    let papers: TimetablePaper[] = []
    if (operationIds.length > 0) {
      const rows = await db
        .select({
          id: schema.examTimetable.id,
          paperName: schema.examTimetable.paperName,
          startTime: schema.examTimetable.startTime,
          endTime: schema.examTimetable.endTime,
          sessionSlot: schema.examTimetable.sessionSlot,
          sortOrder: schema.examTimetable.sortOrder,
        })
        .from(schema.examTimetable)
        .where(
          sql`${schema.examTimetable.operationId} IN (${sql.join(
            operationIds.map((id) => sql`${id}`),
            sql`, `
          )}) AND ${schema.examTimetable.examDate} = ${todayStr}`
        )
      papers = rows
        .filter((r) => !filterToMonitored || monitoredIds.has(r.id))
        .map((r) => ({
          paperName: r.paperName,
          startTime: r.startTime,
          endTime: r.endTime,
          sessionSlot: r.sessionSlot,
          sortOrder: r.sortOrder,
        }))
      // Sort: parseable starts first, in order; un-timed papers after, by sort order.
      papers.sort((a, b) => {
        const aMin = parseMinutes(a.startTime)
        const bMin = parseMinutes(b.startTime)
        if (aMin !== null && bMin !== null) return aMin - bMin
        if (aMin !== null) return -1
        if (bMin !== null) return 1
        return (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999) || a.paperName.localeCompare(b.paperName)
      })
    }

    // Series name for display.
    let seriesName: string | null = null
    if (operationIds.length > 0) {
      const ops = await db
        .select({ name: schema.operations.name })
        .from(schema.operations)
        .where(inArray(schema.operations.id, operationIds))
        .limit(1)
      seriesName = ops[0]?.name || null
    }

    // Earliest upcoming paper for the active series — used for the empty state ("Next up").
    let nextPaper: { date: string; paperName: string; startTime: string | null } | null = null
    if (operationIds.length > 0) {
      const nextRows = await db
        .select({
          id: schema.examTimetable.id,
          examDate: schema.examTimetable.examDate,
          paperName: schema.examTimetable.paperName,
          startTime: schema.examTimetable.startTime,
          sortOrder: schema.examTimetable.sortOrder,
        })
        .from(schema.examTimetable)
        .where(
          sql`${schema.examTimetable.operationId} IN (${sql.join(
            operationIds.map((id) => sql`${id}`),
            sql`, `
          )}) AND ${schema.examTimetable.examDate} >= ${todayStr}`
        )
        .orderBy(asc(schema.examTimetable.examDate), asc(schema.examTimetable.sortOrder))
      const nextRow = filterToMonitored
        ? nextRows.find((r) => monitoredIds.has(r.id))
        : nextRows[0]
      if (nextRow) {
        nextPaper = {
          date: nextRow.examDate,
          paperName: nextRow.paperName,
          startTime: nextRow.startTime,
        }
      }
    }

    const starts = papers.map((p) => parseMinutes(p.startTime)).filter((n): n is number => n !== null)
    const arriveBy = starts.length > 0 ? fmtTime(Math.max(0, Math.min(...starts) - 60)) : null

    // Latest assignment row — carries the shift lifecycle (check-in / check-out).
    const latestAssignment = await db
      .select({
        status: schema.assignments.status,
        checkInTime: schema.assignments.checkInTime,
        date: schema.assignments.date,
      })
      .from(schema.assignments)
      .where(eq(schema.assignments.officerId, officerId))
      .orderBy(desc(schema.assignments.updatedAt))
      .limit(1)
    const isCheckedIn = latestAssignment[0]?.status === 'ON_SITE'
    const checkInDate = latestAssignment[0]?.checkInTime ? new Date(latestAssignment[0].checkInTime) : null

    // Today's arrival/departure state (for "I'm here" / auto-detection UI).
    const todayStr0 = todayStr
    const todayEvents = await db
      .select()
      .from(schema.arrivalEvents)
      .where(
        sql`${schema.arrivalEvents.officerId} = ${officerId} AND date_trunc('day', ${schema.arrivalEvents.serverTime}) = ${todayStr0}::date`
      )
      .orderBy(desc(schema.arrivalEvents.serverTime))
    const todayArrival = todayEvents.find((e) => e.kind === 'ARRIVAL') || null
    const todayDeparture = todayEvents.find((e) => e.kind === 'DEPARTURE') || null

    // SOS flag from the user row.
    const userRows = await db
      .select({ isSosActive: schema.user.isSosActive })
      .from(schema.user)
      .where(eq(schema.user.id, officerId))
      .limit(1)

    return NextResponse.json({
      success: true,
      isLiveDb: true,
      isDeployed,
      seriesName,
      venue,
      papers,
      timeline: buildTimeline(papers),
      arriveBy,
      nextPaper,
      isCheckedIn,
      assignmentStatus: latestAssignment[0]?.status || (isDeployed ? 'PENDING' : 'UNASSIGNED'),
      checkInTimeIso: isCheckedIn && checkInDate ? checkInDate.toISOString() : null,
      checkInTimeFormatted:
        isCheckedIn && checkInDate
          ? checkInDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' GMT'
          : null,
      isSosActive: Boolean(userRows[0]?.isSosActive),
      refreshIntervalMs,
      today: {
        arrival: todayArrival
          ? {
              at: todayArrival.serverTime,
              accuracyTier: todayArrival.accuracyTier,
              confirmed: Boolean(todayArrival.confirmedAt),
            }
          : null,
        departure: todayDeparture
          ? { at: todayDeparture.serverTime, duringPaper: todayDeparture.note === 'during-paper' }
          : null,
      },
    })
  } catch (error) {
    console.error('Failed to resolve field duty:', error)
    return NextResponse.json({ error: 'Failed to resolve field duty' }, { status: 500 })
  }
}
