import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { parseBatteryThresholdPct, parseGeofenceRadiusMeters } from '@/lib/settings-utils'
import { recordAuditLog } from '@/lib/db/audit'
import { and, desc, eq, gte } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { officerId, lat, lng, battery, speedKmh, accuracyMeters, distanceMeters, isSimulated } = body

    if (!officerId) {
      return NextResponse.json({ error: 'officerId is required' }, { status: 400 })
    }

    if (!isLiveDatabase || !db) {
      return NextResponse.json({ success: true, pingAt: new Date().toISOString() })
    }

    const users = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        role: schema.user.role,
        assignmentStatus: schema.assignments.status,
        centerName: schema.examinationCenters.centerName,
        centerRadius: schema.examinationCenters.geofenceRadiusMeters,
      })
      .from(schema.user)
      .leftJoin(schema.assignments, eq(schema.user.id, schema.assignments.officerId))
      .leftJoin(schema.examinationCenters, eq(schema.assignments.centerId, schema.examinationCenters.id))
      .where(eq(schema.user.id, officerId))
      .orderBy(desc(schema.assignments.updatedAt))
      .limit(1)

    if (users.length === 0) {
      return NextResponse.json({ error: 'Officer not found' }, { status: 404 })
    }

    const officer = users[0]
    const now = new Date()

    const userUpdates: Record<string, unknown> = {
      lastPingAt: now,
      updatedAt: now,
    }
    if (typeof lat === 'number' && !Number.isNaN(lat)) userUpdates.lastLatitude = lat.toFixed(8)
    if (typeof lng === 'number' && !Number.isNaN(lng)) userUpdates.lastLongitude = lng.toFixed(8)
    if (typeof battery === 'number' && !Number.isNaN(battery)) userUpdates.lastBattery = Math.max(0, Math.min(100, Math.round(battery)))
    if (typeof speedKmh === 'number' && !Number.isNaN(speedKmh)) userUpdates.lastSpeedKmh = Math.max(0, Math.round(speedKmh))
    if (typeof accuracyMeters === 'number' && !Number.isNaN(accuracyMeters)) userUpdates.lastAccuracyMeters = Math.max(0, Math.round(accuracyMeters))
    if (typeof distanceMeters === 'number' && !Number.isNaN(distanceMeters)) userUpdates.lastDistanceMeters = Math.max(0, Math.round(distanceMeters))

    await db.update(schema.user).set(userUpdates).where(eq(schema.user.id, officerId))

    // Evaluate live alert thresholds (only log deduplicated alerts so table isn't flooded every 10s)
    const settingsRows = await db
      .select()
      .from(schema.systemSettings)
      .where(eq(schema.systemSettings.id, 'default-ashanti'))
      .limit(1)
    const settings = settingsRows[0]
    const lowBatteryPct = parseBatteryThresholdPct(settings?.lowBatteryThreshold)
    const defaultRadius = parseGeofenceRadiusMeters(settings?.geofenceRadius)
    const effectiveRadius = officer.centerRadius || defaultRadius

    const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000)

    if (typeof battery === 'number' && battery < lowBatteryPct) {
      const recentBatteryLogs = await db
        .select({ id: schema.auditLogs.id })
        .from(schema.auditLogs)
        .where(
          and(
            eq(schema.auditLogs.actorId, officerId),
            eq(schema.auditLogs.action, 'LOW_BATTERY_ALERT'),
            gte(schema.auditLogs.createdAt, tenMinsAgo)
          )
        )
        .limit(1)

      if (recentBatteryLogs.length === 0) {
        await recordAuditLog({
          actorId: officer.id,
          actorName: officer.name,
          actorRole: officer.role,
          action: 'LOW_BATTERY_ALERT',
          entityType: 'users',
          entityId: officer.id,
          details: {
            message: `${officer.name} device battery dropped to ${Math.round(battery)}%`,
            battery: Math.round(battery),
            centerName: officer.centerName || 'Unassigned',
          },
        })
      }
    }

    if (
      !isSimulated &&
      settings?.outsideGeofenceAlert !== false &&
      officer.assignmentStatus === 'ON_SITE' &&
      typeof distanceMeters === 'number' &&
      distanceMeters > effectiveRadius
    ) {
      const recentBreachLogs = await db
        .select({ id: schema.auditLogs.id })
        .from(schema.auditLogs)
        .where(
          and(
            eq(schema.auditLogs.actorId, officerId),
            eq(schema.auditLogs.action, 'GEOFENCE_BREACH'),
            gte(schema.auditLogs.createdAt, tenMinsAgo)
          )
        )
        .limit(1)

      if (recentBreachLogs.length === 0) {
        await recordAuditLog({
          actorId: officer.id,
          actorName: officer.name,
          actorRole: officer.role,
          action: 'GEOFENCE_BREACH',
          entityType: 'assignments',
          entityId: officer.id,
          details: {
            message: `${officer.name} moved ${Math.round(distanceMeters)}m outside ${officer.centerName || 'assigned center'} (${effectiveRadius}m limit)`,
            distanceMeters: Math.round(distanceMeters),
            centerName: officer.centerName || 'Unassigned',
          },
        })
      }
    }

    return NextResponse.json({ success: true, pingAt: now.toISOString() })
  } catch (error) {
    console.error('Failed to record field telemetry:', error)
    return NextResponse.json({ error: 'Failed to record telemetry' }, { status: 500 })
  }
}
