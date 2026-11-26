import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { parseOfflineTimeoutMs, parseGeofenceRadiusMeters } from '@/lib/settings-utils'
import { requireCommand } from '@/lib/auth/guard'
import {
  clockToMinutes,
  confirmedArrivalMs,
  evaluateOfficerDay,
  isTodayCheckIn,
  summarizeArrivals,
} from '@/lib/field/exceptions'
import { resolveEventMs } from '@/lib/field/event-time'
import { haversineMeters } from '@/lib/field/geo'
import { and, desc, eq, ne, gte, inArray, sql } from 'drizzle-orm'

export async function GET(request: Request) {
  try {
    const gate = await requireCommand(request as any)
    if (gate.error) return gate.error
    if (!isLiveDatabase || !db) {
      return NextResponse.json({
        officers: [],
        summary: summarizeArrivals({ assigned: 0, arrived: 0, confirmed: 0 }),
        exceptions: [],
      })
    }

    const settingsRows = await db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.id, 'default-ashanti'))
      .limit(1)
    const settings = settingsRows[0]
    const offlineTimeoutMs = parseOfflineTimeoutMs(settings?.officerOfflineTimeout)
    const defaultRadius = parseGeofenceRadiusMeters(settings?.geofenceRadius)

    const rows = await db
      .select({
        userId: schema.user.id,
        userName: schema.user.name,
        userPhone: schema.user.phone,
        userStaffId: schema.user.staffId,
        userStatus: schema.user.status,
        userGroupName: schema.user.groupName,
        userIsGroupLeader: schema.user.isGroupLeader,
        lastLatitude: schema.user.lastLatitude,
        lastLongitude: schema.user.lastLongitude,
        lastBattery: schema.user.lastBattery,
        lastSpeedKmh: schema.user.lastSpeedKmh,
        lastAccuracyMeters: schema.user.lastAccuracyMeters,
        lastDistanceMeters: schema.user.lastDistanceMeters,
        lastPingAt: schema.user.lastPingAt,
        isSosActive: schema.user.isSosActive,
        assignmentId: schema.assignments.id,
        assignmentStatus: schema.assignments.status,
        assignmentDate: schema.assignments.date,
        checkInTime: schema.assignments.checkInTime,
        checkInDistance: schema.assignments.checkInDistanceMeters,
        checkInLat: schema.assignments.checkInLatitude,
        checkInLng: schema.assignments.checkInLongitude,
        centerId: schema.examinationCenters.id,
        centerName: schema.examinationCenters.centerName,
        centerCode: schema.examinationCenters.centerCode,
        centerLat: schema.examinationCenters.latitude,
        centerLng: schema.examinationCenters.longitude,
        centerRadius: schema.examinationCenters.geofenceRadiusMeters,
      })
      .from(schema.user)
      .leftJoin(schema.assignments, eq(schema.user.id, schema.assignments.officerId))
      .leftJoin(schema.examinationCenters, eq(schema.assignments.centerId, schema.examinationCenters.id))
      .where(eq(schema.user.role, 'FIELD_OFFICER'))
      .orderBy(desc(schema.assignments.updatedAt))

    // Fetch open SOS/Critical incidents so map & drawer show real incident details
    const openIncidents = await db
      .select()
      .from(schema.incidents)
      .where(
        and(
          ne(schema.incidents.status, 'RESOLVED'),
          ne(schema.incidents.status, 'CLOSED')
        )
      )
      .orderBy(desc(schema.incidents.reportedAt))

    // Centre truth: prefer the officer's latest deployment for venue display —
    // assignments only exist after a check-in, deployments exist before one.
    const deploymentRows = await db
      .select({
        officerId: schema.officerDeployments.officerId,
        centerId: schema.officerDeployments.centerId,
        updatedAt: schema.officerDeployments.updatedAt,
      })
      .from(schema.officerDeployments)
      .orderBy(desc(schema.officerDeployments.updatedAt))

    const depCenterByOfficer = new Map<string, string>()
    for (const d of deploymentRows) {
      if (!depCenterByOfficer.has(d.officerId)) depCenterByOfficer.set(d.officerId, d.centerId)
    }
    const depCenterIds = Array.from(new Set(depCenterByOfficer.values()))
    const depCenters =
      depCenterIds.length > 0
        ? await db
            .select({
              id: schema.examinationCenters.id,
              centerName: schema.examinationCenters.centerName,
              centerCode: schema.examinationCenters.centerCode,
              latitude: schema.examinationCenters.latitude,
              longitude: schema.examinationCenters.longitude,
              geofenceRadiusMeters: schema.examinationCenters.geofenceRadiusMeters,
            })
            .from(schema.examinationCenters)
            .where(inArray(schema.examinationCenters.id, depCenterIds))
        : []
    const depCenterMap = new Map(depCenters.map((c) => [c.id, c]))

    // Fetch recent audit logs for live per-officer checkpoints
    const recentLogs = await db
      .select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(100)

    // Today's arrival/departure events per officer (the arrival engine)
    const todayStr = new Date().toISOString().slice(0, 10)
    const todayEvents = await db
      .select({
        officerId: schema.arrivalEvents.officerId,
        kind: schema.arrivalEvents.kind,
        serverTime: schema.arrivalEvents.serverTime,
        phoneTime: schema.arrivalEvents.phoneTime,
        confirmedAt: schema.arrivalEvents.confirmedAt,
        accuracyTier: schema.arrivalEvents.accuracyTier,
        note: schema.arrivalEvents.note,
        centerId: schema.arrivalEvents.centerId,
      })
      .from(schema.arrivalEvents)
      .where(
        sql`date_trunc('day', ${schema.arrivalEvents.serverTime}) = ${todayStr}::date`
      )
      .orderBy(desc(schema.arrivalEvents.serverTime))

    const todayByOfficer = new Map<string, {
      arrival?: (typeof todayEvents)[number]
      departure?: (typeof todayEvents)[number]
    }>()
    for (const e of todayEvents) {
      const slot = todayByOfficer.get(e.officerId) || {}
      if (e.kind === 'ARRIVAL' && !slot.arrival) slot.arrival = e
      if (e.kind === 'DEPARTURE' && !slot.departure) slot.departure = e
      todayByOfficer.set(e.officerId, slot)
    }

    const nowMs = Date.now()

    // --- Day plan: where each officer was supposed to go today -------------
    const planRows = await db
      .select({
        officerId: schema.dailySchoolAssignments.officerId,
        centerId: schema.dailySchoolAssignments.centerId,
        centerName: schema.examinationCenters.centerName,
      })
      .from(schema.dailySchoolAssignments)
      .leftJoin(
        schema.examinationCenters,
        eq(schema.dailySchoolAssignments.centerId, schema.examinationCenters.id)
      )
      .where(eq(schema.dailySchoolAssignments.date, todayStr))
    const plannedByOfficer = new Map(
      planRows.map((p) => [p.officerId, { id: p.centerId, name: p.centerName || null }])
    )

    // --- Where arrivals were actually recorded ------------------------------
    const arrivalCenterIds = Array.from(
      new Set(
        todayEvents
          .filter((e) => e.kind === 'ARRIVAL' && e.centerId)
          .map((e) => e.centerId as string)
      )
    )
    const arrivalCenters =
      arrivalCenterIds.length > 0
        ? await db
            .select({
              id: schema.examinationCenters.id,
              name: schema.examinationCenters.centerName,
            })
            .from(schema.examinationCenters)
            .where(inArray(schema.examinationCenters.id, arrivalCenterIds))
        : []
    const arrivalCenterById = new Map(arrivalCenters.map((c) => [c.id, c.name]))

    // --- End of today's last paper (drives the "departure not recorded" flag)
    const paperRows = await db
      .select({ endTime: schema.examTimetable.endTime })
      .from(schema.examTimetable)
      .where(eq(schema.examTimetable.examDate, todayStr))
      .limit(500)
    const lastPaperEndMinutes =
      paperRows
        .map((p) => clockToMinutes(p.endTime))
        .filter((n): n is number => n !== null)
        .sort((a, b) => b - a)[0] ?? null

    // --- Location jumps flagged in the last 30 minutes ---------------------
    const jumpCutoff = new Date(nowMs - 30 * 60 * 1000)
    const jumpRows = await db
      .select({
        actorId: schema.auditLogs.actorId,
        details: schema.auditLogs.details,
      })
      .from(schema.auditLogs)
      .where(and(eq(schema.auditLogs.action, 'IMPOSSIBLE_MOVEMENT'), gte(schema.auditLogs.createdAt, jumpCutoff)))
      .limit(50)
    const jumpByOfficer = new Map<string, number>()
    for (const j of jumpRows) {
      const speed = Number((j.details as Record<string, any> | null)?.speedKmh)
      if (Number.isFinite(speed) && speed > 0) jumpByOfficer.set(j.actorId, speed)
    }

    const exceptions: Array<{
      officerId: string
      officerName: string
      kind: string
      message: string
      tone: 'warning' | 'critical'
    }> = []
    let arrivedCount = 0
    let confirmedCount = 0

    const seen = new Set<string>()
    // Without region polygons, 50 km from the assigned centre is the honest
    // signal that an officer has left their operating area.
    const OUT_OF_REGION_METERS = 50_000
    const officers = []

    for (const r of rows) {
      if (seen.has(r.userId)) continue
      seen.add(r.userId)

      const activeSos = openIncidents.find(
        (inc) => inc.reportedBy === r.userId && (inc.severity === 'CRITICAL' || inc.category === 'SOS')
      )

      let status: 'ON_SITE' | 'PENDING' | 'SOS' = 'PENDING'
      if (r.isSosActive || activeSos) {
        status = 'SOS'
      } else if (r.assignmentStatus === 'ON_SITE') {
        status = 'ON_SITE'
      }

      // Venue for the trail/marker: live check-in assignment wins; otherwise the
      // officer's deployment centre (deployments exist before a check-in does).
      const depCenter = r.centerLat ? null : depCenterMap.get(depCenterByOfficer.get(r.userId) || '')
      const venueName = r.centerName || depCenter?.centerName || 'Unassigned'
      const venueCode = r.centerCode || depCenter?.centerCode || ''
      const centerLat = Number(r.centerLat ?? depCenter?.latitude) || 6.7028
      const centerLng = Number(r.centerLng ?? depCenter?.longitude) || -1.6369
      const effectiveRadius = Number(r.centerRadius ?? depCenter?.geofenceRadiusMeters) || defaultRadius

      const lat = r.lastLatitude
        ? Number(r.lastLatitude)
        : r.checkInLat
        ? Number(r.checkInLat)
        : centerLat
      const lng = r.lastLongitude
        ? Number(r.lastLongitude)
        : r.checkInLng
        ? Number(r.checkInLng)
        : centerLng

      const hasLiveTelemetry = Boolean(r.lastPingAt)
      const isOnline = r.lastPingAt
        ? nowMs - new Date(r.lastPingAt).getTime() <= offlineTimeoutMs
        : false

      const verifiedTime = r.checkInTime
        ? new Date(r.checkInTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' GMT'
        : undefined

      const distanceFromDatum =
        r.lastDistanceMeters !== null && r.lastDistanceMeters !== undefined
          ? r.lastDistanceMeters
          : r.checkInDistance !== null && r.checkInDistance !== undefined
          ? r.checkInDistance
          : null

      const officerLogs = recentLogs
        .filter((l) => l.actorId === r.userId || l.entityId === r.userId)
        .filter(
          (l) =>
            // Password-change / recovery events don't belong on the duty activity feed
            l.action !== 'PASSWORD_ROTATED' && l.action !== 'PIN_RESET_REQUESTED'
        )
        .slice(0, 5)
        .map((l) => {
          const details = (l.details as Record<string, any>) || {}
          return {
            id: l.id,
            action: l.action,
            label: details.message || l.action.replace(/_/g, ' '),
            time: l.createdAt
              ? new Date(l.createdAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' GMT'
              : '',
            iso: l.createdAt ? new Date(l.createdAt).toISOString() : null,
            tone:
              l.action === 'SOS_TRIGGERED' || l.action === 'GEOFENCE_BREACH' || l.action === 'USER_REVOKED'
                ? ('critical' as const)
                : l.action === 'CHECK_IN_LOGGED' || l.action === 'SOS_STAND_DOWN'
                ? ('ok' as const)
                : ('info' as const),
          }
        })

      const slot = todayByOfficer.get(r.userId)
      const dayArrival = slot?.arrival
      const dayDeparture = slot?.departure
      const checkInToday = isTodayCheckIn(
        r.assignmentStatus,
        r.assignmentDate,
        r.checkInTime,
        todayStr
      )
      const checkInTodayAtMs = checkInToday
        ? r.checkInTime
          ? new Date(r.checkInTime).getTime()
          : nowMs
        : null
      const arrivalConfirmedAtMs = confirmedArrivalMs(dayArrival?.confirmedAt, checkInTodayAtMs)
      const arrivalConfirmed = arrivalConfirmedAtMs !== null
      const deploymentCenterId = depCenterByOfficer.get(r.userId) || null
      const deploymentName = deploymentCenterId
        ? depCenterMap.get(deploymentCenterId)?.centerName || null
        : null
      const plan = plannedByOfficer.get(r.userId)
      const plannedSchool = plan?.name || deploymentName
      const plannedCenterId = plan?.id || deploymentCenterId
      const arrivalSchool = dayArrival?.centerId
        ? arrivalCenterById.get(dayArrival.centerId) || null
        : null

      if (dayArrival) {
        arrivedCount += 1
        if (arrivalConfirmed) confirmedCount += 1
      }

      for (const ex of evaluateOfficerDay({
        officerName: r.userName,
        arrivalAtMs: resolveEventMs(dayArrival?.serverTime, dayArrival?.phoneTime),
        arrivalConfirmed,
        departureAtMs: resolveEventMs(dayDeparture?.serverTime, dayDeparture?.phoneTime),
        plannedSchool,
        hasPlan: Boolean(plan),
        arrivalSchool,
        nowMs,
        lastPaperEndMinutes,
        impossibleSpeedKmh: jumpByOfficer.get(r.userId) ?? null,
      })) {
        exceptions.push({ officerId: r.userId, officerName: r.userName, ...ex })
      }

      if (status === 'SOS') {
        exceptions.push({
          officerId: r.userId,
          officerName: r.userName,
          kind: 'sos',
          message: `${r.userName} pressed SOS — call them now`,
          tone: 'critical',
        })
      }

      // The last known position is enough to flag a real region exit; web can
      // only see it while the page is open, so never claim more than we know.
      const lastKnownDistance =
        distanceFromDatum ?? haversineMeters(lat, lng, centerLat, centerLng)
      if (hasLiveTelemetry && lastKnownDistance > OUT_OF_REGION_METERS) {
        exceptions.push({
          officerId: r.userId,
          officerName: r.userName,
          kind: 'out-of-region',
          message: `${r.userName} is about ${Math.round(lastKnownDistance / 1000)} km from their centre — outside the operating area`,
          tone: 'warning',
        })
      }

      officers.push({
        id: r.userId,
        name: r.userName,
        phone: r.userPhone || '',
        staffId: r.userStaffId || 'WAEC-GH-0000',
        accountStatus: r.userStatus || 'ACTIVE',
        group: r.userGroupName || 'Group 1',
        isLeader: Boolean(r.userIsGroupLeader),
        assignedCenter: venueName,
        centerCode: venueCode,
        centerRadius: effectiveRadius,
        plannedSchool,
        plannedCenterId,
        arrivalSchool,
        status,
        assignmentStatus: r.assignmentStatus || 'UNASSIGNED',
        verifiedTime,
        distanceFromDatum,
        battery: r.lastBattery !== null && r.lastBattery !== undefined ? r.lastBattery : null,
        speedKmh: r.lastSpeedKmh !== null && r.lastSpeedKmh !== undefined ? r.lastSpeedKmh : null,
        accuracyMeters:
          r.lastAccuracyMeters !== null && r.lastAccuracyMeters !== undefined ? r.lastAccuracyMeters : null,
        lastPingAt: r.lastPingAt ? new Date(r.lastPingAt).toISOString() : null,
        hasLiveTelemetry,
        isOnline,
        lat,
        lng,
        sosDetails: activeSos?.description || undefined,
        sosIncidentId: activeSos?.id || undefined,
        sosIncidentNumber: activeSos?.incidentNumber || undefined,
        sosStatus: activeSos?.status || undefined,
        checkpoints: officerLogs,
        // The arrival engine's view of today for this officer
        todayArrival: (() => {
          const a = todayByOfficer.get(r.userId)?.arrival
          if (!a) return null as null
          return {
            at: a.serverTime ? new Date(a.serverTime).toISOString() : null,
            phoneTime: a.phoneTime ? new Date(a.phoneTime).toISOString() : null,
            confirmedAt: arrivalConfirmedAtMs ? new Date(arrivalConfirmedAtMs).toISOString() : null,
            accuracyTier: a.accuracyTier || null,
          }
        })(),
        todayDeparture: (() => {
          const d = todayByOfficer.get(r.userId)?.departure
          if (!d) return null as null
          return {
            at: d.serverTime ? new Date(d.serverTime).toISOString() : null,
            phoneTime: d.phoneTime ? new Date(d.phoneTime).toISOString() : null,
            duringPaper: d.note === 'during-paper',
          }
        })(),
      })
    }

    return NextResponse.json({
      officers,
      summary: summarizeArrivals({
        assigned: officers.length,
        arrived: arrivedCount,
        confirmed: confirmedCount,
      }),
      exceptions,
    })
  } catch (error) {
    console.error('Failed to fetch fleet officers:', error)
    return NextResponse.json({ error: 'Failed to fetch fleet officers' }, { status: 500 })
  }
}
