import { NextResponse } from 'next/server'
import { db, isLiveDatabase, store } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { parseGeofenceRadiusMeters } from '@/lib/settings-utils'
import { recordAuditLog } from '@/lib/db/audit'
import { getServerUser, roleKind } from '@/lib/auth/guard'
import { desc, eq } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      officerId,
      action,
      lat,
      lng,
      distanceMeters,
      battery,
      accuracyMeters,
      isTestMode,
    } = body

    const caller = await getServerUser(request as any)
    if (!caller) {
      return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
    }
    if (roleKind(caller.role) === 'officer' && officerId !== caller.id) {
      return NextResponse.json({ error: 'You can only check in for yourself.' }, { status: 403 })
    }

    if (!officerId || !['CHECK_IN', 'CHECK_OUT'].includes(action)) {
      return NextResponse.json({ error: 'officerId and valid action (CHECK_IN | CHECK_OUT) required' }, { status: 400 })
    }

    const now = new Date()
    const timeFormatted = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' GMT'

    if (isLiveDatabase && db) {
      const officerRows = await db
        .select({
          id: schema.user.id,
          name: schema.user.name,
          role: schema.user.role,
          assignmentId: schema.assignments.id,
          centerName: schema.examinationCenters.centerName,
          centerRadius: schema.examinationCenters.geofenceRadiusMeters,
          centerLat: schema.examinationCenters.latitude,
          centerLng: schema.examinationCenters.longitude,
        })
        .from(schema.user)
        .leftJoin(schema.assignments, eq(schema.user.id, schema.assignments.officerId))
        .leftJoin(schema.examinationCenters, eq(schema.assignments.centerId, schema.examinationCenters.id))
        .where(eq(schema.user.id, officerId))
        .orderBy(desc(schema.assignments.updatedAt))
        .limit(1)

      if (officerRows.length === 0) {
        return NextResponse.json({ error: 'Officer not found' }, { status: 404 })
      }

      const row = officerRows[0]
      const settingsRows = await db
        .select({ geofenceRadius: schema.systemSettings.geofenceRadius })
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.id, 'default-ashanti'))
        .limit(1)
      const effectiveRadius = row.centerRadius || parseGeofenceRadiusMeters(settingsRows[0]?.geofenceRadius)

      if (action === 'CHECK_IN') {
        const numericDist = typeof distanceMeters === 'number' ? Math.round(distanceMeters) : 0
        if (!isTestMode && numericDist > effectiveRadius) {
          return NextResponse.json(
            {
              error: `Check-in denied: officer is ${numericDist}m from center (must be within ${effectiveRadius}m perimeter).`,
            },
            { status: 403 }
          )
        }

        const safeLat = typeof lat === 'number' && !Number.isNaN(lat) ? lat.toFixed(8) : row.centerLat
        const safeLng = typeof lng === 'number' && !Number.isNaN(lng) ? lng.toFixed(8) : row.centerLng

        if (row.assignmentId) {
          await db
            .update(schema.assignments)
            .set({
              status: 'ON_SITE',
              checkInTime: now,
              checkOutTime: null,
              checkInLatitude: safeLat || null,
              checkInLongitude: safeLng || null,
              checkInDistanceMeters: numericDist,
              updatedAt: now,
            })
            .where(eq(schema.assignments.id, row.assignmentId))
        }

        const userTel: Record<string, unknown> = {
          lastDistanceMeters: numericDist,
          lastSpeedKmh: 0,
          lastPingAt: now,
          updatedAt: now,
        }
        if (safeLat) userTel.lastLatitude = safeLat
        if (safeLng) userTel.lastLongitude = safeLng
        if (typeof battery === 'number') userTel.lastBattery = Math.round(battery)
        if (typeof accuracyMeters === 'number') userTel.lastAccuracyMeters = Math.round(accuracyMeters)

        await db.update(schema.user).set(userTel).where(eq(schema.user.id, officerId))

        await recordAuditLog({
          actorId: officerId,
          actorName: row.name,
          actorRole: row.role,
          action: 'CHECK_IN_LOGGED',
          entityType: 'assignments',
          entityId: row.assignmentId || officerId,
          details: {
            message: `${row.name} verified on-site at ${row.centerName || 'Assigned Center'} (${numericDist}m)`,
            centerName: row.centerName || 'Assigned Center',
            distanceMeters: numericDist,
            battery: typeof battery === 'number' ? Math.round(battery) : null,
          },
        })

        return NextResponse.json({
          success: true,
          assignmentStatus: 'ON_SITE',
          isCheckedIn: true,
          checkInTimeIso: now.toISOString(),
          checkInTimeFormatted: timeFormatted,
        })
      }

      // CHECK_OUT
      if (row.assignmentId) {
        await db
          .update(schema.assignments)
          .set({
            status: 'COMPLETED',
            checkOutTime: now,
            updatedAt: now,
          })
          .where(eq(schema.assignments.id, row.assignmentId))
      }

      await db
        .update(schema.user)
        .set({ lastPingAt: now, updatedAt: now })
        .where(eq(schema.user.id, officerId))

      await recordAuditLog({
        actorId: officerId,
        actorName: row.name,
        actorRole: row.role,
        action: 'CHECK_OUT_LOGGED',
        entityType: 'assignments',
        entityId: row.assignmentId || officerId,
        details: {
          message: `${row.name} concluded duty shift at ${row.centerName || 'Assigned Center'}`,
          centerName: row.centerName || 'Assigned Center',
        },
      })

      return NextResponse.json({
        success: true,
        assignmentStatus: 'COMPLETED',
        isCheckedIn: false,
        checkOutTimeIso: now.toISOString(),
        checkOutTimeFormatted: timeFormatted,
      })
    }

    // Store fallback when no live DB
    store.toggleDutyStatus(officerId, action === 'CHECK_IN' ? 'ON_DUTY' : 'OFF_DUTY')
    return NextResponse.json({
      success: true,
      assignmentStatus: action === 'CHECK_IN' ? 'ON_SITE' : 'COMPLETED',
      isCheckedIn: action === 'CHECK_IN',
      checkInTimeIso: action === 'CHECK_IN' ? now.toISOString() : null,
      checkInTimeFormatted: timeFormatted,
    })
  } catch (error) {
    console.error('Failed to process check-in/out:', error)
    return NextResponse.json({ error: 'Failed to update duty attendance' }, { status: 500 })
  }
}

