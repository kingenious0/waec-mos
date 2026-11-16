import { NextResponse } from 'next/server'
import { db, isLiveDatabase, store } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { parseGeofenceRadiusMeters } from '@/lib/settings-utils'
import { recordAuditLog } from '@/lib/db/audit'
import { checkinSchema } from '@/lib/validation-schemas'
import { getServerUser, roleKind } from '@/lib/auth/guard'
import { desc, eq, asc, sql, or } from 'drizzle-orm'

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
        } else {
          // No shift row yet — create one on demand from the officer's deployment
          // so check-in works on deployed days with no pre-seeded assignment.
          const todayStr = now.toISOString().slice(0, 10)
          const deps = await db
            .select()
            .from(schema.officerDeployments)
            .where(eq(schema.officerDeployments.officerId, officerId))
          const perDay = deps.find((d) => d.deploymentDate === todayStr)
          const series = deps.filter((d) => !d.deploymentDate)
          const activeDep = perDay || series[0]
          if (activeDep) {
            const opIds = Array.from(
              new Set((perDay ? [perDay] : series).map((d) => d.operationId))
            )
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
            message: `${row.name} checked in at ${row.centerName || 'the assigned centre'} (${Math.round(numericDist)} m)`,
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

