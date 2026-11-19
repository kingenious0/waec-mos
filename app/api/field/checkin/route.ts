import { NextResponse } from 'next/server'
import { db, isLiveDatabase, store } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { parseGeofenceRadiusMeters } from '@/lib/settings-utils'
import { recordAuditLog } from '@/lib/db/audit'
import { checkinSchema } from '@/lib/validation-schemas'
import { getServerUser, roleKind } from '@/lib/auth/guard'
import { desc, eq, asc, sql, or, and } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const raw = await request.json()
    const parsed = checkinSchema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      )
    }
    const {
      officerId,
      action,
      lat,
      lng,
      distanceMeters,
      battery,
      accuracyMeters,
      isTestMode,
    } = parsed.data

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

      // Venue resolution must match /api/field/duty exactly — the centre used
      // for the geofence is: today's day-plan → today's deployment override →
      // newest series anchor → legacy assignment row → system default.
      // (Previously only the legacy assignments join was consulted, so a
      // deployed-but-never-checked-in officer was measured against the 150m
      // system default instead of their centre's configured radius.)
      const todayStr = now.toISOString().slice(0, 10)
      const [planRows, deploymentRows] = await Promise.all([
        db
          .select({ centerId: schema.dailySchoolAssignments.centerId })
          .from(schema.dailySchoolAssignments)
          .where(
            and(
              eq(schema.dailySchoolAssignments.officerId, officerId),
              eq(schema.dailySchoolAssignments.date, todayStr)
            )
          )
          .limit(1),
        db
          .select()
          .from(schema.officerDeployments)
          .where(eq(schema.officerDeployments.officerId, officerId))
          .orderBy(desc(schema.officerDeployments.updatedAt)),
      ])
      const todayOverrides = deploymentRows.filter((d) => d.deploymentDate === todayStr)
      const seriesAnchors = deploymentRows.filter((d) => !d.deploymentDate)
      const deployment = todayOverrides[0] || seriesAnchors[0] || null
      const venueCenterId = planRows[0]?.centerId || deployment?.centerId || null

      let venueName: string | null = null
      let venueRadius: number | null = null
      let venueLat: number | null = null
      let venueLng: number | null = null
      if (venueCenterId) {
        const venueRows = await db
          .select({
            name: schema.examinationCenters.centerName,
            radius: schema.examinationCenters.geofenceRadiusMeters,
            lat: schema.examinationCenters.latitude,
            lng: schema.examinationCenters.longitude,
          })
          .from(schema.examinationCenters)
          .where(eq(schema.examinationCenters.id, venueCenterId))
          .limit(1)
        const v = venueRows[0]
        if (v) {
          venueName = v.name
          venueRadius = Number(v.radius) || null
          venueLat = Number(v.lat)
          venueLng = Number(v.lng)
        }
      }
      const effectiveRadius =
        venueRadius || row.centerRadius || parseGeofenceRadiusMeters(settingsRows[0]?.geofenceRadius)
      const effectiveVenueName = venueName || row.centerName || 'the assigned centre'

      if (action === 'CHECK_IN') {
        // Geofence distance is computed server-side from the reported GPS fix —
        // never trusted from the client. Falls back to the client-reported
        // distance only when coordinates are missing.
        const haversineMeters = (aLat: number, aLng: number, bLat: number, bLng: number): number => {
          const R = 6371000
          const toRad = (d: number) => (d * Math.PI) / 180
          const dLat = toRad(bLat - aLat)
          const dLng = toRad(bLng - aLng)
          const s =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2
          return 2 * R * Math.asin(Math.sqrt(s))
        }
        const serverDistance =
          venueLat !== null &&
          venueLng !== null &&
          typeof lat === 'number' &&
          !Number.isNaN(lat) &&
          typeof lng === 'number' &&
          !Number.isNaN(lng)
            ? Math.round(haversineMeters(lat, lng, venueLat, venueLng))
            : null
        const numericDist =
          serverDistance ??
          (typeof distanceMeters === 'number' ? Math.round(distanceMeters) : 0)
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
        } else {
          // No shift row yet — create one on demand from the officer's deployment
          // so check-in works on deployed days with no pre-seeded assignment.
          const activeDep = deployment
          if (activeDep) {
            const opIds = Array.from(new Set([activeDep.operationId]))
            let paper: {
              paperName: string
              startTime: string | null
              endTime: string | null
            } | null = null
            try {
              const papers = await db
                .select({
                  paperName: schema.examTimetable.paperName,
                  startTime: schema.examTimetable.startTime,
                  endTime: schema.examTimetable.endTime,
                  sortOrder: schema.examTimetable.sortOrder,
                })
                .from(schema.examTimetable)
                .where(
                  sql`${schema.examTimetable.operationId} IN (${sql.join(
                    opIds.map((id) => sql`${id}`),
                    sql`, `
                  )}) AND ${schema.examTimetable.examDate} = ${todayStr}`
                )
                .orderBy(asc(schema.examTimetable.sortOrder))
                .limit(1)
              paper = papers[0] || null
            } catch {
              paper = null
            }
            await db
              .insert(schema.assignments)
              .values({
                id: `asg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                operationId: activeDep.operationId,
                centerId: activeDep.centerId,
                officerId,
                date: todayStr,
                paperName: paper?.paperName || 'Duty shift',
                startTime: paper?.startTime || '',
                endTime: paper?.endTime || '',
                status: 'ON_SITE',
                checkInTime: now,
                checkInLatitude: safeLat || null,
                checkInLongitude: safeLng || null,
                checkInDistanceMeters: numericDist,
                createdAt: now,
                updatedAt: now,
              })
          }
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
            message: `${row.name} checked in at ${effectiveVenueName} (${Math.round(numericDist)} m)`,
            centerName: effectiveVenueName,
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
          message: `${row.name} concluded duty shift at ${effectiveVenueName}`,
          centerName: effectiveVenueName,
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

