import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { parseOfflineTimeoutMs, parseGeofenceRadiusMeters } from '@/lib/settings-utils'
import { and, desc, eq, ne } from 'drizzle-orm'

export async function GET() {
  try {
    if (!isLiveDatabase || !db) {
      return NextResponse.json({ officers: [] })
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

    // Fetch recent audit logs for live per-officer checkpoints
    const recentLogs = await db
      .select()
      .from(schema.auditLogs)
      .orderBy(desc(schema.auditLogs.createdAt))
      .limit(100)

    const nowMs = Date.now()
    const seen = new Set<string>()
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

      const centerLat = Number(r.centerLat) || 6.7028
      const centerLng = Number(r.centerLng) || -1.6369
      const effectiveRadius = r.centerRadius || defaultRadius

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

      officers.push({
        id: r.userId,
        name: r.userName,
        phone: r.userPhone || '',
        staffId: r.userStaffId || 'WAEC-GH-0000',
        accountStatus: r.userStatus || 'ACTIVE',
        group: r.userGroupName || 'Group 1',
        isLeader: Boolean(r.userIsGroupLeader),
        assignedCenter: r.centerName || 'Unassigned',
        centerCode: r.centerCode || '',
        centerRadius: effectiveRadius,
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
      })
    }

    return NextResponse.json({ officers })
  } catch (error) {
    console.error('Failed to fetch fleet officers:', error)
    return NextResponse.json({ error: 'Failed to fetch fleet officers' }, { status: 500 })
  }
}
