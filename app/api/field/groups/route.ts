import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { requireAdmin, requireCommand } from '@/lib/auth/guard'
import { recordAuditLog } from '@/lib/db/audit'
import { findGroupByNameAndRegion } from '@/lib/field/groups'
import {
  filterGroupOfficers,
  isValidAssignmentDate,
  todayGmt,
} from '@/lib/field/group-assignment'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const groupCreateSchema = z.object({
  name: z.string().trim().min(2).max(60),
  regionId: z.string().min(1),
  leaderOfficerId: z.string().min(1).optional().nullable(),
})

const groupUpdateSchema = groupCreateSchema.partial().extend({
  id: z.string().min(1),
})

/**
 * GET /api/field/groups?date=YYYY-MM-DD
 * Everything the admin group screen needs in one read: groups, their region,
 * members, leaders, available officers/centres and that day's schools.
 */
export async function GET(request: Request) {
  try {
    const gate = await requireCommand(request as any)
    if (gate.error) return gate.error

    const { searchParams } = new URL(request.url)
    const requestedDate = searchParams.get('date')
    const date = isValidAssignmentDate(requestedDate) ? requestedDate : todayGmt()

    if (!isLiveDatabase || !db) {
      return NextResponse.json({
        success: true,
        isLiveDb: false,
        date,
        groups: [],
        regions: [],
        officers: [],
        centers: [],
      })
    }

    const [groupRows, regionRows, officerRows, centerRows, assignmentRows] = await Promise.all([
      db
        .select({
          id: schema.fieldGroups.id,
          name: schema.fieldGroups.name,
          regionId: schema.fieldGroups.regionId,
          regionName: schema.regions.name,
          leaderOfficerId: schema.fieldGroups.leaderOfficerId,
          leaderName: schema.user.name,
          createdAt: schema.fieldGroups.createdAt,
          updatedAt: schema.fieldGroups.updatedAt,
        })
        .from(schema.fieldGroups)
        .leftJoin(schema.regions, eq(schema.regions.id, schema.fieldGroups.regionId))
        .leftJoin(schema.user, eq(schema.user.id, schema.fieldGroups.leaderOfficerId))
        .orderBy(asc(schema.regions.name), asc(schema.fieldGroups.name)),

      db
        .select({ id: schema.regions.id, name: schema.regions.name, code: schema.regions.code })
        .from(schema.regions)
        .orderBy(asc(schema.regions.name)),

      db
        .select({
          id: schema.user.id,
          name: schema.user.name,
          phone: schema.user.phone,
          staffId: schema.user.staffId,
          groupName: schema.user.groupName,
          regionId: schema.user.regionId,
          regionName: schema.regions.name,
          isGroupLeader: schema.user.isGroupLeader,
          status: schema.user.status,
        })
        .from(schema.user)
        .leftJoin(schema.regions, eq(schema.regions.id, schema.user.regionId))
        .where(eq(schema.user.role, 'FIELD_OFFICER'))
        .orderBy(asc(schema.user.name)),

      db
        .select({
          id: schema.examinationCenters.id,
          name: schema.examinationCenters.centerName,
          code: schema.examinationCenters.centerCode,
          regionId: schema.regions.id,
          regionName: schema.regions.name,
        })
        .from(schema.examinationCenters)
        .innerJoin(schema.districts, eq(schema.districts.id, schema.examinationCenters.districtId))
        .innerJoin(schema.regions, eq(schema.regions.id, schema.districts.regionId))
        .orderBy(asc(schema.regions.name), asc(schema.examinationCenters.centerName)),

      db
        .select({
          id: schema.dailySchoolAssignments.id,
          groupId: schema.dailySchoolAssignments.groupId,
          officerId: schema.dailySchoolAssignments.officerId,
          centerId: schema.dailySchoolAssignments.centerId,
          centerName: schema.examinationCenters.centerName,
          centerCode: schema.examinationCenters.centerCode,
          date: schema.dailySchoolAssignments.date,
          source: schema.dailySchoolAssignments.source,
        })
        .from(schema.dailySchoolAssignments)
        .innerJoin(
          schema.examinationCenters,
          eq(schema.examinationCenters.id, schema.dailySchoolAssignments.centerId)
        )
        .where(eq(schema.dailySchoolAssignments.date, date)),
    ])

    const officers = officerRows.map((o) => ({
      id: o.id,
      name: o.name,
      phone: o.phone || '',
      staffId: o.staffId || '',
      groupName: o.groupName || null,
      regionId: o.regionId || null,
      regionName: o.regionName || null,
      isGroupLeader: Boolean(o.isGroupLeader),
      status: o.status,
    }))

    const centers = centerRows.map((c) => ({
      id: c.id,
      name: c.name,
      code: c.code,
      regionId: c.regionId,
      regionName: c.regionName,
    }))

    const groups = groupRows.map((g) => {
      const members = filterGroupOfficers(officers, g)
      // Old rows have no group id; only let those borrow this group's officers.
      const assignments = assignmentRows
        .filter(
          (a) =>
            a.groupId === g.id || (!a.groupId && members.some((m) => m.id === a.officerId))
        )
        .map((a) => ({
          id: a.id,
          groupId: a.groupId,
          officerId: a.officerId,
          centerId: a.centerId,
          centerName: a.centerName,
          centerCode: a.centerCode,
          source: a.source,
        }))

      return {
        id: g.id,
        name: g.name,
        regionId: g.regionId,
        regionName: g.regionName || null,
        leaderOfficerId: g.leaderOfficerId || null,
        leaderName: g.leaderName || null,
        members,
        assignments,
      }
    })

    return NextResponse.json({
      success: true,
      isLiveDb: true,
      date,
      groups,
      regions: regionRows,
      officers,
      centers,
    })
  } catch (err) {
    console.error('field groups GET failed:', err)
    return NextResponse.json({ error: 'Could not load field groups.' }, { status: 500 })
  }
}

async function validateLeader(leaderOfficerId: string) {
  if (!db) return null
  const rows = await db
    .select({ id: schema.user.id, name: schema.user.name, role: schema.user.role })
    .from(schema.user)
    .where(eq(schema.user.id, leaderOfficerId))
    .limit(1)
  const officer = rows[0]
  return officer && officer.role === 'FIELD_OFFICER'
    ? { id: officer.id, name: officer.name }
    : null
}

/** POST /api/field/groups — create a group and anchor it to a region. */
export async function POST(request: Request) {
  try {
    const gate = await requireAdmin(request as any)
    if (gate.error) return gate.error
    if (!isLiveDatabase || !db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 503 })
    }

    const parsed = groupCreateSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Group name and region are required.' },
        { status: 400 }
      )
    }
    const d = parsed.data

    const regionRows = await db
      .select({ id: schema.regions.id, name: schema.regions.name })
      .from(schema.regions)
      .where(eq(schema.regions.id, d.regionId))
      .limit(1)
    if (regionRows.length === 0) {
      return NextResponse.json({ error: 'Choose a valid region.' }, { status: 400 })
    }

    const duplicateId = await findGroupByNameAndRegion(d.name, d.regionId)
    if (duplicateId) {
      return NextResponse.json(
        { error: 'That group name is already used in this region. Choose another name.' },
        { status: 409 }
      )
    }

    const leader = d.leaderOfficerId ? await validateLeader(d.leaderOfficerId) : null
    if (d.leaderOfficerId && !leader) {
      return NextResponse.json({ error: 'Choose a valid group leader.' }, { status: 400 })
    }

    const id = `grp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
    const inserted = await db
      .insert(schema.fieldGroups)
      .values({
        id,
        name: d.name,
        regionId: d.regionId,
        leaderOfficerId: leader?.id || null,
        updatedAt: new Date(),
      })
      .returning()

    if (leader) {
      await db
        .update(schema.user)
        .set({ groupName: d.name, regionId: d.regionId, isGroupLeader: true, updatedAt: new Date() })
        .where(eq(schema.user.id, leader.id))
    }

    await recordAuditLog({
      actorId: gate.user.id,
      actorName: gate.user.name || 'Unknown',
      actorRole: gate.user.role,
      action: 'FIELD_GROUP_CREATED',
      entityType: 'field_groups',
      entityId: id,
      details: { name: d.name, region: regionRows[0].name, leader: leader?.name || null },
    })

    return NextResponse.json({ success: true, group: inserted[0] })
  } catch (err) {
    console.error('field group create failed:', err)
    return NextResponse.json({ error: 'Could not create the group.' }, { status: 500 })
  }
}

/** PATCH /api/field/groups — rename, move to another region, or change leader. */
export async function PATCH(request: Request) {
  try {
    const gate = await requireAdmin(request as any)
    if (gate.error) return gate.error
    if (!isLiveDatabase || !db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 503 })
    }

    const parsed = groupUpdateSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid group details.' },
        { status: 400 }
      )
    }
    const d = parsed.data

    const currentRows = await db
      .select()
      .from(schema.fieldGroups)
      .where(eq(schema.fieldGroups.id, d.id))
      .limit(1)
    const current = currentRows[0]
    if (!current) return NextResponse.json({ error: 'Group not found.' }, { status: 404 })

    const nextName = d.name ?? current.name
    const nextRegionId = d.regionId ?? current.regionId

    if (d.regionId) {
      const regionRows = await db
        .select({ id: schema.regions.id })
        .from(schema.regions)
        .where(eq(schema.regions.id, d.regionId))
        .limit(1)
      if (regionRows.length === 0) {
        return NextResponse.json({ error: 'Choose a valid region.' }, { status: 400 })
      }
    }

    if (d.name || d.regionId) {
      const duplicateId = await findGroupByNameAndRegion(nextName, nextRegionId)
      if (duplicateId && duplicateId !== d.id) {
        return NextResponse.json(
          { error: 'That group name is already used in this region. Choose another name.' },
          { status: 409 }
        )
      }
    }

    // Members are identified before the group row changes. Region decides when
    // two regions both use a familiar name like "Group 1".
    const officerRowsForGroup = await db
      .select({
        id: schema.user.id,
        groupName: schema.user.groupName,
        regionId: schema.user.regionId,
      })
      .from(schema.user)
      .where(eq(schema.user.role, 'FIELD_OFFICER'))
    const memberIds = filterGroupOfficers(officerRowsForGroup, {
      id: current.id,
      name: current.name,
      regionId: current.regionId,
    }).map((m) => m.id)

    // New leader is validated before any write happens.
    const leader =
      d.leaderOfficerId === null
        ? null
        : d.leaderOfficerId
        ? await validateLeader(d.leaderOfficerId)
        : undefined
    if (d.leaderOfficerId && !leader) {
      return NextResponse.json({ error: 'Choose a valid group leader.' }, { status: 400 })
    }

    const updated = await db
      .update(schema.fieldGroups)
      .set({
        name: nextName,
        regionId: nextRegionId,
        leaderOfficerId: d.leaderOfficerId === null ? null : leader?.id ?? current.leaderOfficerId,
        updatedAt: new Date(),
      })
      .where(eq(schema.fieldGroups.id, d.id))
      .returning()

    // Keep officer records in step with the group's name and region.
    const idsToSync = Array.from(new Set([...memberIds, ...(leader ? [leader.id] : [])]))
    if (idsToSync.length > 0) {
      await db
        .update(schema.user)
        .set({ groupName: nextName, regionId: nextRegionId, updatedAt: new Date() })
        .where(inArray(schema.user.id, idsToSync))
    }

    if (leader && leader.id !== current.leaderOfficerId) {
      const demoteIds = idsToSync.filter((id) => id !== leader.id)
      if (demoteIds.length > 0) {
        await db
          .update(schema.user)
          .set({ isGroupLeader: false, updatedAt: new Date() })
          .where(inArray(schema.user.id, demoteIds))
      }
      await db
        .update(schema.user)
        .set({ isGroupLeader: true, updatedAt: new Date() })
        .where(eq(schema.user.id, leader.id))
    } else if (d.leaderOfficerId === null && current.leaderOfficerId) {
      await db
        .update(schema.user)
        .set({ isGroupLeader: false, updatedAt: new Date() })
        .where(eq(schema.user.id, current.leaderOfficerId))
    }

    await recordAuditLog({
      actorId: gate.user.id,
      actorName: gate.user.name || 'Unknown',
      actorRole: gate.user.role,
      action: 'FIELD_GROUP_UPDATED',
      entityType: 'field_groups',
      entityId: d.id,
      details: { from: current.name, to: nextName, leader: leader?.name || null },
    })

    return NextResponse.json({ success: true, group: updated[0] })
  } catch (err) {
    console.error('field group update failed:', err)
    return NextResponse.json({ error: 'Could not update the group.' }, { status: 500 })
  }
}

/** DELETE /api/field/groups?id=<id> — release members and clear that group's plan. */
export async function DELETE(request: Request) {
  try {
    const gate = await requireAdmin(request as any)
    if (gate.error) return gate.error
    if (!isLiveDatabase || !db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 503 })
    }

    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'Group id is required.' }, { status: 400 })

    const rows = await db
      .select()
      .from(schema.fieldGroups)
      .where(eq(schema.fieldGroups.id, id))
      .limit(1)
    const group = rows[0]
    if (!group) return NextResponse.json({ error: 'Group not found.' }, { status: 404 })

    const officerRowsForGroup = await db
      .select({
        id: schema.user.id,
        groupName: schema.user.groupName,
        regionId: schema.user.regionId,
      })
      .from(schema.user)
      .where(eq(schema.user.role, 'FIELD_OFFICER'))
    const memberIds = filterGroupOfficers(officerRowsForGroup, group).map((m) => m.id)

    if (memberIds.length > 0) {
      await db
        .update(schema.user)
        .set({ groupName: null, isGroupLeader: false, updatedAt: new Date() })
        .where(inArray(schema.user.id, memberIds))
    }

    await db
      .delete(schema.dailySchoolAssignments)
      .where(eq(schema.dailySchoolAssignments.groupId, id))
    await db.delete(schema.fieldGroups).where(eq(schema.fieldGroups.id, id))

    await recordAuditLog({
      actorId: gate.user.id,
      actorName: gate.user.name || 'Unknown',
      actorRole: gate.user.role,
      action: 'FIELD_GROUP_DELETED',
      entityType: 'field_groups',
      entityId: id,
      details: { name: group.name, releasedOfficers: memberIds.length },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('field group delete failed:', err)
    return NextResponse.json({ error: 'Could not delete the group.' }, { status: 500 })
  }
}
