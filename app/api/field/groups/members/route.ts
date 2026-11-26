import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { requireAdmin } from '@/lib/auth/guard'
import { recordAuditLog } from '@/lib/db/audit'
import { filterGroupOfficers } from '@/lib/field/group-assignment'
import { eq, inArray } from 'drizzle-orm'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const memberSchema = z.object({
  groupId: z.string().min(1),
  officerId: z.string().min(1),
  action: z.enum(['add', 'remove', 'make-leader']),
})

/** POST /api/field/groups/members — add, remove or promote an officer in a group. */
export async function POST(request: Request) {
  try {
    const gate = await requireAdmin(request as any)
    if (gate.error) return gate.error
    if (!isLiveDatabase || !db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 503 })
    }

    const parsed = memberSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid group member request.' }, { status: 400 })
    }
    const d = parsed.data

    const groupRows = await db
      .select()
      .from(schema.fieldGroups)
      .where(eq(schema.fieldGroups.id, d.groupId))
      .limit(1)
    const group = groupRows[0]
    if (!group) return NextResponse.json({ error: 'Group not found.' }, { status: 404 })

    const officerRows = await db
      .select({ id: schema.user.id, name: schema.user.name, role: schema.user.role, isGroupLeader: schema.user.isGroupLeader })
      .from(schema.user)
      .where(eq(schema.user.id, d.officerId))
      .limit(1)
    const officer = officerRows[0]
    if (!officer || officer.role !== 'FIELD_OFFICER') {
      return NextResponse.json({ error: 'Choose a field officer.' }, { status: 400 })
    }

    if (d.action === 'remove') {
      if (group.leaderOfficerId === officer.id) {
        await db
          .update(schema.fieldGroups)
          .set({ leaderOfficerId: null, updatedAt: new Date() })
          .where(eq(schema.fieldGroups.id, group.id))
      }
      await db
        .update(schema.user)
        .set({ groupName: null, isGroupLeader: false, updatedAt: new Date() })
        .where(eq(schema.user.id, officer.id))

      await recordAuditLog({
        actorId: gate.user.id,
        actorName: gate.user.name || 'Unknown',
        actorRole: gate.user.role,
        action: 'FIELD_GROUP_MEMBER_REMOVED',
        entityType: 'field_groups',
        entityId: group.id,
        details: { officer: officer.name, group: group.name },
      })
      return NextResponse.json({ success: true })
    }

    // add / make-leader both put the officer in the group and its region.
    await db
      .update(schema.user)
      .set({
        groupName: group.name,
        regionId: group.regionId,
        isGroupLeader: d.action === 'make-leader' ? true : officer.isGroupLeader,
        updatedAt: new Date(),
      })
      .where(eq(schema.user.id, officer.id))

    if (d.action === 'make-leader') {
      const allOfficers = await db
        .select({
          id: schema.user.id,
          groupName: schema.user.groupName,
          regionId: schema.user.regionId,
        })
        .from(schema.user)
        .where(eq(schema.user.role, 'FIELD_OFFICER'))
      const demoteIds = filterGroupOfficers(allOfficers, group, officer.id).map((m) => m.id)
      if (demoteIds.length > 0) {
        await db
          .update(schema.user)
          .set({ isGroupLeader: false, updatedAt: new Date() })
          .where(inArray(schema.user.id, demoteIds))
      }
      await db
        .update(schema.fieldGroups)
        .set({ leaderOfficerId: officer.id, updatedAt: new Date() })
        .where(eq(schema.fieldGroups.id, group.id))
    }

    await recordAuditLog({
      actorId: gate.user.id,
      actorName: gate.user.name || 'Unknown',
      actorRole: gate.user.role,
      action: d.action === 'make-leader' ? 'FIELD_GROUP_LEADER_SET' : 'FIELD_GROUP_MEMBER_ADDED',
      entityType: 'field_groups',
      entityId: group.id,
      details: { officer: officer.name, group: group.name, regionId: group.regionId },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('field group member change failed:', err)
    return NextResponse.json({ error: 'Could not update group members.' }, { status: 500 })
  }
}
