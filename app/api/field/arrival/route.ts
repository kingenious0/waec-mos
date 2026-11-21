import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { recordAuditLog } from '@/lib/db/audit'
import { canActOnOfficer } from '@/lib/field/team-access'
import { isPresentReason } from '@/lib/field/present-reasons'
import { getServerUser, roleKind } from '@/lib/auth/guard'
import { desc, eq, and, sql } from 'drizzle-orm'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const actionSchema = z.object({
  action: z.enum(['detect_arrival', 'detect_departure', 'confirm', 'done', 'mark_present']),
  lat: z.number().finite().optional(),
  lng: z.number().finite().optional(),
  accuracyM: z.number().finite().nonnegative().optional(),
  distanceMeters: z.number().finite().nonnegative().nullable().optional(),
  /** Leader marking a teammate present — only reachable with officerId. */
  officerId: z.string().min(1).optional(),
  reason: z.string().trim().max(80).optional(),
  /** Device clock when an offline event actually happened; serverTime is official. */
  phoneTime: z.string().datetime().optional(),
})

/** Fixed reasons a leader can record instead of GPS proof. */

const ARRIVAL_DWELL_MINUTES = 2
const ACCURACY_SOLID_M = 30
const ACCURACY_WEAK_M = 100

function todayGmt() {
  return new Date().toISOString().slice(0, 10)
}

function parseMinutes(raw?: string | null): number | null {
  if (!raw) return null
  const m = String(raw).match(/(\d{1,2}):(\d{2})/)
  if (!m) return null
  const h = parseInt(m[1], 10)
  const min = parseInt(m[2], 10)
  if (Number.isNaN(h) || Number.isNaN(min) || h > 23 || min > 59) return null
  return h * 60 + min
}

/** Earliest/latest monitored paper bounds for an officer today (for left-early rules). */
async function monitoredWindow(officerId: string) {
  if (!db) return null
  const today = todayGmt()
  const deployments = await db
    .select()
    .from(schema.officerDeployments)
    .where(eq(schema.officerDeployments.officerId, officerId))
  const ops = Array.from(new Set(deployments.map((d) => d.operationId).filter(Boolean)))
  if (ops.length === 0) return null

  const monitored = await db
    .select({ paperId: schema.monitoredPapers.paperId })
    .from(schema.monitoredPapers)
    .where(
      sql`${schema.monitoredPapers.operationId} IN (${sql.join(
        ops.map((id) => sql`${id}`),
        sql`, `
      )})`
    )
  const monitoredIds = new Set(monitored.map((m) => m.paperId))

  const papers = await db
    .select({
      id: schema.examTimetable.id,
      paperName: schema.examTimetable.paperName,
      startTime: schema.examTimetable.startTime,
      endTime: schema.examTimetable.endTime,
    })
    .from(schema.examTimetable)
    .where(
      sql`${schema.examTimetable.operationId} IN (${sql.join(
        ops.map((id) => sql`${id}`),
        sql`, `
      )}) AND ${schema.examTimetable.examDate} = ${today}`
    )

  const enforced = monitoredIds.size > 0 ? papers.filter((p) => monitoredIds.has(p.id)) : papers
  const starts = enforced.map((p) => parseMinutes(p.startTime)).filter((n): n is number => n !== null)
  const ends = enforced.map((p) => parseMinutes(p.endTime)).filter((n): n is number => n !== null)
  if (starts.length === 0) return null
  return {
    firstStart: Math.min(...starts),
    lastEnd: Math.max(...(ends.length ? ends : starts)),
    inSessionNow: (() => {
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes()
      return enforced.some((p) => {
        const s = parseMinutes(p.startTime)
        const e = parseMinutes(p.endTime)
        return s !== null && e !== null && nowMin >= s && nowMin <= e
      })
    })(),
  }
}

/**
 * The school an officer was supposed to be at today — the day plan wins,
 * otherwise the latest deployment. Recorded on every arrival so HQ can compare
 * where an officer was meant to be with where they actually turned up.
 */
async function resolveTodayCenterId(officerId: string): Promise<string | null> {
  if (!db) return null
  const today = todayGmt()

  const plan = await db
    .select({ centerId: schema.dailySchoolAssignments.centerId })
    .from(schema.dailySchoolAssignments)
    .where(
      and(
        eq(schema.dailySchoolAssignments.officerId, officerId),
        eq(schema.dailySchoolAssignments.date, today)
      )
    )
    .limit(1)
  if (plan[0]?.centerId) return plan[0].centerId

  const deployment = await db
    .select({ centerId: schema.officerDeployments.centerId })
    .from(schema.officerDeployments)
    .where(eq(schema.officerDeployments.officerId, officerId))
    .orderBy(desc(schema.officerDeployments.updatedAt))
    .limit(1)
  return deployment[0]?.centerId || null
}

export async function GET(request: Request) {
  try {
    const caller = await getServerUser(request as any)
    if (!caller) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
    const { searchParams } = new URL(request.url)
    let officerId = searchParams.get('officerId') || caller.id
    if (roleKind(caller.role) === 'officer') officerId = caller.id

    if (!isLiveDatabase || !db) {
      return NextResponse.json({ success: true, today: null })
    }

    const today = todayGmt()
    const events = await db
      .select()
      .from(schema.arrivalEvents)
      .where(
        sql`${schema.arrivalEvents.officerId} = ${officerId} AND date_trunc('day', ${schema.arrivalEvents.serverTime}) = ${today}::date`
      )
      .orderBy(desc(schema.arrivalEvents.serverTime))

    const arrival = events.find((e) => e.kind === 'ARRIVAL')
    const departure = events.find((e) => e.kind === 'DEPARTURE')
    const window = await monitoredWindow(officerId)

    return NextResponse.json({
      success: true,
      today: {
        arrival: arrival
          ? {
              at: arrival.serverTime,
              phoneTime: arrival.phoneTime,
              accuracyTier: arrival.accuracyTier,
              confirmed: Boolean(arrival.confirmedAt),
              distanceM: arrival.accuracyM,
            }
          : null,
        departure: departure
          ? {
              at: departure.serverTime,
              phoneTime: departure.phoneTime,
              duringPaper: Boolean(departure.note === 'during-paper'),
            }
          : null,
        paperWindow: window,
      },
    })
  } catch (err) {
    console.error('arrival GET failed:', err)
    return NextResponse.json({ error: 'Could not load arrival state.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const caller = await getServerUser(request as any)
    if (!caller) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
    if (!isLiveDatabase || !db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 503 })
    }

    const parsed = actionSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 })
    }
    const {
      action,
      lat,
      lng,
      accuracyM,
      distanceMeters,
      officerId: requestedOfficerId,
      reason,
      phoneTime,
    } = parsed.data

    const today = todayGmt()
    const now = new Date()
    // Phone time is evidence of when the device saw the event; never trust it
    // for ordering or duration without the server's receive time alongside it.
    const phoneAt = (() => {
      if (!phoneTime) return now
      const ts = new Date(phoneTime)
      if (Number.isNaN(ts.getTime()) || ts.getTime() > now.getTime() + 5 * 60_000) return now
      return ts
    })()

    // ---------- A group leader records a teammate as present ----------
    // Used when GPS proof is impossible (dead battery, no signal). The reason
    // is mandatory so HQ always knows this arrival was not device-confirmed.
    if (action === 'mark_present') {
      if (!requestedOfficerId) {
        return NextResponse.json({ error: 'officerId is required' }, { status: 400 })
      }
      if (!(await canActOnOfficer(caller, requestedOfficerId))) {
        return NextResponse.json(
          { error: 'Only a group leader can mark a teammate present.' },
          { status: 403 }
        )
      }
      if (roleKind(caller.role) === 'officer' && (!reason || !isPresentReason(reason))) {
        return NextResponse.json(
          { error: 'Choose a reason — HQ needs to know why there is no GPS proof.' },
          { status: 422 }
        )
      }

      const latest = await db
        .select({ id: schema.arrivalEvents.id, confirmedAt: schema.arrivalEvents.confirmedAt })
        .from(schema.arrivalEvents)
        .where(
          and(
            eq(schema.arrivalEvents.officerId, requestedOfficerId),
            eq(schema.arrivalEvents.kind, 'ARRIVAL')
          )
        )
        .orderBy(desc(schema.arrivalEvents.serverTime))
        .limit(1)

      const note = `leader-marked:${reason || 'command'}`
      if (latest[0]?.confirmedAt) {
        return NextResponse.json({ ok: true, alreadyPresent: true })
      }

      if (latest[0]) {
        await db
          .update(schema.arrivalEvents)
          .set({ confirmedAt: now, source: 'leader', note })
          .where(eq(schema.arrivalEvents.id, latest[0].id))
      } else {
        await db.insert(schema.arrivalEvents).values({
          id: `evt-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`,
          officerId: requestedOfficerId,
          centerId: await resolveTodayCenterId(requestedOfficerId),
          kind: 'ARRIVAL',
          phoneTime: now,
          serverTime: now,
          source: 'leader',
          accuracyTier: null,
          note,
          confirmedAt: now,
        })
      }

      await recordAuditLog({
        actorId: caller.id,
        actorName: caller.name || 'Group leader',
        actorRole: caller.role,
        action: 'ARRIVAL_MARKED_PRESENT',
        entityType: 'arrival_events',
        entityId: requestedOfficerId,
        details: {
          message: `${caller.name} marked ${requestedOfficerId} present (${reason || 'command decision'})`,
          reason: reason || null,
        },
      })
      return NextResponse.json({ ok: true, markedPresent: true })
    }

    const window = await monitoredWindow(caller.id)

    // ---------- Detect an arrival (dwell already satisfied client-side) ----------
    if (action === 'detect_arrival') {
      if (lat == null || lng == null) {
        return NextResponse.json({ error: 'lat/lng required' }, { status: 400 })
      }
      const accuracy = typeof accuracyM === 'number' ? accuracyM : 100
      if (accuracy > ACCURACY_WEAK_M) {
        return NextResponse.json({ error: 'GPS too weak to arrive anyone — wait for a better fix.' }, { status: 422 })
      }
      const tier = accuracy <= ACCURACY_SOLID_M ? 'solid' : 'weak'
      const id = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      await db.insert(schema.arrivalEvents).values({
        id,
        officerId: caller.id,
        centerId: await resolveTodayCenterId(caller.id),
        assignmentId: null,
        kind: 'ARRIVAL',
        phoneTime: phoneAt,
        serverTime: now,
        lat: lat.toFixed(7),
        lng: lng.toFixed(7),
        accuracyM: Math.round(accuracy),
        source: 'auto',
        accuracyTier: tier,
        note: accuracy > ACCURACY_SOLID_M ? 'weak-accuracy' : null,
      })
      return NextResponse.json({ ok: true, arrival: { id, tier } })
    }

    // ---------- Confirm "I'm here" — the single human tap ----------
    if (action === 'confirm') {
      const latest = await db
        .select()
        .from(schema.arrivalEvents)
        .where(and(eq(schema.arrivalEvents.officerId, caller.id), eq(schema.arrivalEvents.kind, 'ARRIVAL')))
        .orderBy(desc(schema.arrivalEvents.serverTime))
        .limit(1)
      if (latest[0]) {
        await db
          .update(schema.arrivalEvents)
          .set({ confirmedAt: now })
          .where(eq(schema.arrivalEvents.id, latest[0].id))
      } else {
        // No auto-detection arrived — treat the tap itself as the arrival.
        const id = `evt-${now.getTime()}-${Math.random().toString(36).slice(2, 6)}`
        await db.insert(schema.arrivalEvents).values({
          id,
          officerId: caller.id,
          centerId: await resolveTodayCenterId(caller.id),
          kind: 'ARRIVAL',
          phoneTime: phoneAt,
          serverTime: now,
          accuracyM: accuracyM != null ? Math.round(accuracyM) : null,
          source: 'officer',
          accuracyTier: 'solid',
          confirmedAt: now,
          note: 'tap-only-confirm',
        })
      }
      await recordAuditLog({
        actorId: caller.id,
        actorName: caller.name || 'Field officer',
        actorRole: caller.role,
        action: 'ARRIVAL_CONFIRMED',
        entityType: 'arrival_events',
        entityId: caller.id,
        details: { message: `${caller.name} confirmed on site` },
      })
      return NextResponse.json({ ok: true, confirmed: true })
    }

    // ---------- Detect departure / "I'm done" ----------
    if (action === 'done' || action === 'detect_departure') {
      const duringPaper = window?.inSessionNow === true
      const id = `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      await db.insert(schema.arrivalEvents).values({
        id,
        officerId: caller.id,
        kind: 'DEPARTURE',
        phoneTime: phoneAt,
        serverTime: now,
        lat: lat != null ? lat.toFixed(7) : null,
        lng: lng != null ? lng.toFixed(7) : null,
        accuracyM: accuracyM != null ? Math.round(accuracyM) : null,
        source: action === 'done' ? 'officer' : 'auto',
        accuracyTier: null,
        note: duringPaper ? 'during-paper' : null,
      })
      // Close any active assignment shift for today so stale "on duty" clears.
      const active = await db
        .select()
        .from(schema.assignments)
        .where(and(eq(schema.assignments.officerId, caller.id), eq(schema.assignments.status, 'ON_SITE')))
        .orderBy(desc(schema.assignments.updatedAt))
        .limit(1)
      if (active[0]) {
        await db
          .update(schema.assignments)
          .set({ status: 'COMPLETED', checkOutTime: now, updatedAt: now })
          .where(eq(schema.assignments.id, active[0].id))
      }
      await recordAuditLog({
        actorId: caller.id,
        actorName: caller.name || 'Field officer',
        actorRole: caller.role,
        action: 'DEPARTURE_RECORDED',
        entityType: 'arrival_events',
        entityId: caller.id,
        details: { duringPaper },
      })
      return NextResponse.json({ ok: true, duringPaper })
    }

    return NextResponse.json({ error: 'Unknown action.' }, { status: 400 })
  } catch (err) {
    console.error('arrival POST failed:', err)
    return NextResponse.json({ error: 'Could not record that.' }, { status: 500 })
  }
}
