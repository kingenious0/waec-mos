import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { requireAdmin } from '@/lib/auth/guard'
import { recordAuditLog } from '@/lib/db/audit'
import {
  filterGroupOfficers,
  isValidAssignmentDate,
  todayGmt,
} from '@/lib/field/group-assignment'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const assignSchema = z.object({
  groupId: z.string().min(1),
  officerId: z.string().min(1).optional(),
  centerId: z.string().min(1),
  date: z.string().optional(),
})

/**
 * POST /api/field/groups/assignments
 * Assign one officer — or the whole group — to a school on a chosen day.
 * The school must be in the group's region; that is the whole point of the
 * group → region → school workflow.
 */
export async function POST(request: Request) {
  try {
    const gate = await requireAdmin(request as any)
    if (gate.error) return gate.error
    if (!isLiveDatabase || !db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 503 })
    }

    const parsed = assignSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Choose a school for this group.' }, { status: 400 })
    }
    const d = parsed.data
    const date = d.date || todayGmt()
    if (!isValidAssignmentDate(date)) {
      return NextResponse.json({ error: 'Choose a valid date.' }, { status: 400 })
    }

    const groupRows = await db
      .select()
      .from(schema.fieldGroups)
      .where(eq(schema.fieldGroups.id, d.groupId))
      .limit(1)
    const group = groupRows[0]
    if (!group) return NextResponse.json({ error: 'Group not found.' }, { status: 404 })

    const centreRows = await db
      .select({
        id: schema.examinationCenters.id,
        name: schema.examinationCenters.centerName,
        regionId: schema.regions.id,
        regionName: schema.regions.name,
      })
      .from(schema.examinationCenters)
      .innerJoin(schema.districts, eq(schema.districts.id, schema.examinationCenters.districtId))
      .innerJoin(schema.regions, eq(schema.regions.id, schema.districts.regionId))
      .where(eq(schema.examinationCenters.id, d.centerId))
      .limit(1)
    const centre = centreRows[0]
    if (!centre) return NextResponse.json({ error: 'School not found.' }, { status: 404 })
    if (centre.regionId !== group.regionId) {
      return NextResponse.json(
        {
          error: `${centre.name} is in ${centre.regionName}. Choose a school in this group’s region.`,
        },
        { status: 400 }
      )
    }

    // Only officers actually in this group may receive a group assignment.
    const allOfficers = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        groupName: schema.user.groupName,
        regionId: schema.user.regionId,
      })
      .from(schema.user)
      .where(eq(schema.user.role, 'FIELD_OFFICER'))
    const officerRows = filterGroupOfficers(allOfficers, group, d.officerId)
    if (officerRows.length === 0) {
      return NextResponse.json(
        { error: d.officerId ? 'That officer is not in this group.' : 'Add officers to this group first.' },
        { status: 400 }
      )
    }
    const officerIds = officerRows.map((o) => o.id)

    // One school per officer per day — replace any earlier choice for that day.
    await db
      .delete(schema.dailySchoolAssignments)
      .where(
        and(
          eq(schema.dailySchoolAssignments.date, date),
          inArray(schema.dailySchoolAssignments.officerId, officerIds)
        )
      )

    const inserted = await db
      .insert(schema.dailySchoolAssignments)
      .values(
        officerIds.map((officerId) => ({
          id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${officerId.slice(-4)}`,
          groupId: group.id,
          officerId,
          centerId: centre.id,
          date,
          assignedBy: gate.user.id,
          source: 'leader',
          updatedAt: new Date(),
        }))
      )
      .returning()

    await recordAuditLog({
      actorId: gate.user.id,
      actorName: gate.user.name || 'Unknown',
      actorRole: gate.user.role,
      action: 'FIELD_GROUP_SCHOOL_ASSIGNED',
      entityType: 'daily_school_assignments',
      entityId: inserted[0]?.id || group.id,
      details: {
        group: group.name,
        school: centre.name,
        date,
        officers: officerRows.map((o) => o.name),
      },
    })

    return NextResponse.json({ success: true, assignments: inserted })
  } catch (err) {
    console.error('field group school assignment failed:', err)
    return NextResponse.json({ error: 'Could not save the school assignment.' }, { status: 500 })
  }
}

/** DELETE /api/field/groups/assignments?groupId=&officerId=&date= — clear one day. */
export async function DELETE(request: Request) {
  try {
    const gate = await requireAdmin(request as any)
    if (gate.error) return gate.error
    if (!isLiveDatabase || !db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 503 })
    }

    const params = new URL(request.url).searchParams
    const groupId = params.get('groupId')
    const officerId = params.get('officerId')
    const date = params.get('date') || todayGmt()
    if (!groupId || !officerId) {
      return NextResponse.json({ error: 'Group and officer are required.' }, { status: 400 })
    }
    if (!isValidAssignmentDate(date)) {
      return NextResponse.json({ error: 'Choose a valid date.' }, { status: 400 })
    }
    const groupRows = await db
      .select({ id: schema.fieldGroups.id, name: schema.fieldGroups.name })
      .from(schema.fieldGroups)
      .where(eq(schema.fieldGroups.id, groupId))
      .limit(1)
    if (groupRows.length === 0) {
      return NextResponse.json({ error: 'Group not found.' }, { status: 404 })
    }

    await db
      .delete(schema.dailySchoolAssignments)
      .where(
        and(
          eq(schema.dailySchoolAssignments.officerId, officerId),
          eq(schema.dailySchoolAssignments.date, date)
        )
      )

    await recordAuditLog({
      actorId: gate.user.id,
      actorName: gate.user.name || 'Unknown',
      actorRole: gate.user.role,
      action: 'FIELD_GROUP_SCHOOL_CLEARED',
      entityType: 'daily_school_assignments',
      entityId: `${groupId}:${officerId}:${date}`,
      details: { group: groupRows[0].name, officerId, date },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('field group school clear failed:', err)
    return NextResponse.json({ error: 'Could not clear the school assignment.' }, { status: 500 })
  }
}
