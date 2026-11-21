import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { getServerUser, roleKind } from '@/lib/auth/guard'
import { and, eq, sql } from 'drizzle-orm'

export const dynamic = 'force-dynamic'

const todayGmt = () => new Date().toISOString().slice(0, 10)

/**
 * GET /api/field/team — a group leader's board for today.
 *
 * The leader sees every officer in their group and, for each one, which school
 * they are supposed to be at and whether they have actually arrived. This is
 * the field-side view of the same data HQ sees on the map.
 */
export async function GET(request: Request) {
  try {
    const caller = await getServerUser(request as any)
    if (!caller) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })

    // Anyone signed in may look at their own group; only a leader may steer it.
    if (roleKind(caller.role) !== 'officer') {
      return NextResponse.json({ success: true, isLeader: false, members: [], groupName: null })
    }

    if (!isLiveDatabase || !db) {
      return NextResponse.json({ success: true, isLeader: false, members: [], groupName: null })
    }

    const me = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        groupName: schema.user.groupName,
        isGroupLeader: schema.user.isGroupLeader,
      })
      .from(schema.user)
      .where(eq(schema.user.id, caller.id))
      .limit(1)

    const profile = me[0]
    const isLeader = Boolean(profile?.isGroupLeader)
    const groupName = profile?.groupName || null

    const scope = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        phone: schema.user.phone,
        staffId: schema.user.staffId,
        groupName: schema.user.groupName,
        isGroupLeader: schema.user.isGroupLeader,
      })
      .from(schema.user)
      .where(
        groupName
          ? and(eq(schema.user.role, 'FIELD_OFFICER'), eq(schema.user.groupName, groupName))
          : and(eq(schema.user.role, 'FIELD_OFFICER'), eq(schema.user.id, caller.id))
      )
      .orderBy(schema.user.name)

    const memberIds = scope.map((m) => m.id)
    const today = todayGmt()

    const plans =
      memberIds.length === 0
        ? []
        : await db
            .select({
              officerId: schema.dailySchoolAssignments.officerId,
              centerId: schema.dailySchoolAssignments.centerId,
              source: schema.dailySchoolAssignments.source,
              centerName: schema.examinationCenters.centerName,
            })
            .from(schema.dailySchoolAssignments)
            .leftJoin(
              schema.examinationCenters,
              eq(schema.examinationCenters.id, schema.dailySchoolAssignments.centerId)
            )
            .where(
              and(
                sql`${schema.dailySchoolAssignments.officerId} IN (${sql.join(
                  memberIds.map((id) => sql`${id}`),
                  sql`, `
                )})`,
                eq(schema.dailySchoolAssignments.date, today)
              )
            )
            .orderBy(schema.dailySchoolAssignments.updatedAt)

    const planByOfficer = new Map<string, { centerId: string; centerName: string | null; source: string }>()
    for (const p of plans) {
      if (!planByOfficer.has(p.officerId)) {
        planByOfficer.set(p.officerId, {
          centerId: p.centerId,
          centerName: p.centerName || null,
          source: p.source,
        })
      }
    }

    const events =
      memberIds.length === 0
        ? []
        : await db
            .select({
              officerId: schema.arrivalEvents.officerId,
              kind: schema.arrivalEvents.kind,
              serverTime: schema.arrivalEvents.serverTime,
              confirmedAt: schema.arrivalEvents.confirmedAt,
              accuracyTier: schema.arrivalEvents.accuracyTier,
              note: schema.arrivalEvents.note,
            })
            .from(schema.arrivalEvents)
            .where(
              sql`${schema.arrivalEvents.officerId} IN (${sql.join(
                memberIds.map((id) => sql`${id}`),
                sql`, `
              )}) AND date_trunc('day', ${schema.arrivalEvents.serverTime}) = ${today}::date`
            )
            .orderBy(schema.arrivalEvents.serverTime)

    const dayByOfficer = new Map<
      string,
      { arrival?: (typeof events)[number]; departure?: (typeof events)[number] }
    >()
    for (const e of events) {
      const slot = dayByOfficer.get(e.officerId) || {}
      if (e.kind === 'ARRIVAL' && !slot.arrival) slot.arrival = e
      if (e.kind === 'DEPARTURE' && !slot.departure) slot.departure = e
      dayByOfficer.set(e.officerId, slot)
    }

    return NextResponse.json({
      success: true,
      isLeader,
      groupName,
      members: scope.map((m) => {
        const plan = planByOfficer.get(m.id)
        const slot = dayByOfficer.get(m.id)
        return {
          id: m.id,
          name: m.name,
          phone: m.phone || '',
          staffId: m.staffId || '',
          isLeader: Boolean(m.isGroupLeader),
          isSelf: m.id === caller.id,
          planned: plan
            ? { centerId: plan.centerId, centerName: plan.centerName, source: plan.source }
            : null,
          arrival: slot?.arrival
            ? {
                at: slot.arrival.serverTime ? new Date(slot.arrival.serverTime).toISOString() : null,
                confirmedAt: slot.arrival.confirmedAt
                  ? new Date(slot.arrival.confirmedAt).toISOString()
                  : null,
                accuracyTier: slot.arrival.accuracyTier || null,
              }
            : null,
          departure: slot?.departure
            ? {
                at: slot.departure.serverTime ? new Date(slot.departure.serverTime).toISOString() : null,
                duringPaper: slot.departure.note === 'during-paper',
              }
            : null,
        }
      }),
    })
  } catch (err) {
    console.error('team GET failed:', err)
    return NextResponse.json({ error: 'Could not load your group.' }, { status: 500 })
  }
}
