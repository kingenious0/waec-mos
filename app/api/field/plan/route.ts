import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { getServerUser, roleKind } from '@/lib/auth/guard'
import { recordAuditLog } from '@/lib/db/audit'
import { canActOnOfficer } from '@/lib/field/team-access'
import { loadOfficerGroup } from '@/lib/field/groups'
import { desc, eq, and, sql } from 'drizzle-orm'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const todayGmt = () => new Date().toISOString().slice(0, 10)

const planSchema = z.object({
  centerId: z.string().min(1),
  officerId: z.string().min(1).optional(),
})

async function resolveOfficerId(caller: any, requested?: string | null): Promise<string | null> {
  // Strict: an officer can never inspect anybody else's plan.
  if (roleKind(caller.role) === 'officer') return caller.id
  return requested || caller.id
}

/**
 * GET /api/field/plan — today's chosen school (or leader's plan) for one officer.
 * HQ/leaders may pass officerId to inspect anyone; officers always get their own.
 */
export async function GET(request: Request) {
  try {
    const caller = await getServerUser(request as any)
    if (!caller) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    const officerId = await resolveOfficerId(caller, searchParams.get('officerId'))
    if (!officerId) return NextResponse.json({ success: true, plan: null })

    if (!isLiveDatabase || !db) return NextResponse.json({ success: true, plan: null })

    const today = todayGmt()
    const rows = await db
      .select({
        id: schema.dailySchoolAssignments.id,
        centerId: schema.dailySchoolAssignments.centerId,
        assignedBy: schema.dailySchoolAssignments.assignedBy,
        source: schema.dailySchoolAssignments.source,
        date: schema.dailySchoolAssignments.date,
        centerName: schema.examinationCenters.centerName,
        centerCode: schema.examinationCenters.centerCode,
        lat: schema.examinationCenters.latitude,
        lng: schema.examinationCenters.longitude,
        radiusMeters: schema.examinationCenters.geofenceRadiusMeters,
        districtName: schema.districts.name,
        regionName: schema.regions.name,
      })
      .from(schema.dailySchoolAssignments)
      .innerJoin(schema.examinationCenters, eq(schema.examinationCenters.id, schema.dailySchoolAssignments.centerId))
      .leftJoin(schema.districts, eq(schema.examinationCenters.districtId, schema.districts.id))
      .leftJoin(schema.regions, eq(schema.districts.regionId, schema.regions.id))
      .where(and(eq(schema.dailySchoolAssignments.officerId, officerId), eq(schema.dailySchoolAssignments.date, today)))
      .orderBy(desc(schema.dailySchoolAssignments.updatedAt))
      .limit(1)

    const p = rows[0]
    return NextResponse.json({
      success: true,
      plan: p
        ? {
            id: p.id,
            centerId: p.centerId,
            centerName: p.centerName,
            centerCode: p.centerCode,
            assignedBy: p.assignedBy,
            source: p.source,
            date: p.date,
            lat: Number(p.lat),
            lng: Number(p.lng),
            radiusMeters: Number(p.radiusMeters) || 150,
            zone: p.districtName ? `${p.districtName} Examination Zone` : undefined,
            region: p.regionName || undefined,
          }
        : null,
    })
  } catch (err) {
    console.error('plan GET failed:', err)
    return NextResponse.json({ error: 'Could not load today’s plan.' }, { status: 500 })
  }
}

/** POST /api/field/plan — set today's school. Officers set their own; leaders may set theirs or a teammate's. */
export async function POST(request: Request) {
  try {
    const caller = await getServerUser(request as any)
    if (!caller) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
    if (!isLiveDatabase || !db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 503 })
    }

    const parsed = planSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'centerId is required' }, { status: 400 })
    }
    const { centerId } = parsed.data
    const requestedId = parsed.data.officerId || caller.id

    // Who is being moved. An officer moves themselves — unless they are a
    // group leader setting a teammate's school for today.
    if (!(await canActOnOfficer(caller, requestedId))) {
      return NextResponse.json(
        { error: 'Only a group leader can set a teammate’s school.' },
        { status: 403 }
      )
    }
    const officerId = requestedId

    // Validate centre exists
    const centreRows = await db
      .select({ id: schema.examinationCenters.id })
      .from(schema.examinationCenters)
      .where(eq(schema.examinationCenters.id, centerId))
      .limit(1)
    if (centreRows.length === 0) {
      return NextResponse.json({ error: 'Unknown centre.' }, { status: 404 })
    }

    const today = todayGmt()
    const source = roleKind(caller.role) === 'officer' ? 'officer' : (parsed.data.officerId && parsed.data.officerId !== caller.id ? 'leader' : 'officer')

    // One plan row per officer per day — replace it.
    await db
      .delete(schema.dailySchoolAssignments)
      .where(and(eq(schema.dailySchoolAssignments.officerId, officerId), eq(schema.dailySchoolAssignments.date, today)))

    // A leader assigning a teammate writes a group plan, tagged with the real
    // field_groups.id. An officer choosing their own school stays individual.
    let groupId: string | null = null
    if (parsed.data.officerId && parsed.data.officerId !== caller.id) {
      const officerGroup = await loadOfficerGroup(officerId)
      groupId = officerGroup?.id || null
    }
    const inserted = await db
      .insert(schema.dailySchoolAssignments)
      .values({
        id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        groupId,
        officerId,
        centerId,
        date: today,
        assignedBy: caller.id,
        source,
      })
      .returning()

    // Duty changes must be traceable — who moved whom, and to which school.
    if (parsed.data.officerId && parsed.data.officerId !== caller.id) {
      const target = await db
        .select({ name: schema.user.name })
        .from(schema.user)
        .where(eq(schema.user.id, officerId))
        .limit(1)
      const centre = await db
        .select({ name: schema.examinationCenters.centerName })
        .from(schema.examinationCenters)
        .where(eq(schema.examinationCenters.id, centerId))
        .limit(1)
      await recordAuditLog({
        actorId: caller.id,
        actorName: caller.name,
        actorRole: caller.role,
        action: 'DUTY_SCHOOL_CHANGED',
        entityType: 'daily_school_assignments',
        entityId: inserted[0].id,
        details: {
          message: `${caller.name} moved ${target[0]?.name || 'officer'} to ${centre[0]?.name || 'centre'} for ${today}`,
          officerId,
          centerId,
          date: today,
        },
      })
    }

    return NextResponse.json({ success: true, plan: inserted[0] })
  } catch (err) {
    console.error('plan POST failed:', err)
    return NextResponse.json({ error: 'Could not set today’s school.' }, { status: 500 })
  }
}
