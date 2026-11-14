import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { recordAuditLog } from '@/lib/db/audit'
import { requireCommand, requireAdmin } from '@/lib/auth/guard'
import { recordSecurityEvent } from '@/lib/db/audit'
import { desc, eq } from 'drizzle-orm'
import { z } from 'zod'

/** GET /api/timetable?operationId=<id> — every paper for one series, in exam order. */
export async function GET(request: Request) {
  try {
    const gate = await requireCommand(request as any)
    if (gate.error) return gate.error
    if (!isLiveDatabase || !db) return NextResponse.json({ error: 'Database not connected', status: 503 }, { status: 503 })

    const { searchParams } = new URL(request.url)
    const operationId = searchParams.get('operationId')
    if (!operationId) return NextResponse.json({ error: 'operationId is required', status: 400 }, { status: 400 })

    const rows = await db
      .select()
      .from(schema.examTimetable)
      .where(eq(schema.examTimetable.operationId, operationId))
      .orderBy(schema.examTimetable.examDate, schema.examTimetable.sortOrder)
    return NextResponse.json({ rows })
  } catch (err) {
    console.error('timetable list failed:', err)
    return NextResponse.json({ error: 'Could not load the timetable.', status: 500 }, { status: 500 })
  }
}

const timetableRowSchema = z.object({
  id: z.string().min(1),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD'),
  sessionSlot: z.enum(['MORNING', 'AFTERNOON', 'FULL_DAY']),
  paperCode: z.string().trim().max(40).nullable().optional(),
  paperName: z.string().trim().min(2).max(240),
  durationText: z.string().trim().max(80).nullable().optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
  needsCouncilTime: z.boolean(),
  isNewCurriculum: z.boolean(),
})

/** PUT /api/timetable — correct one paper after review (Command staff). */
export async function PUT(request: Request) {
  try {
    const gate = await requireCommand(request as any)
    if (gate.error) return gate.error
    if (!isLiveDatabase || !db) return NextResponse.json({ error: 'Database not connected', status: 503 }, { status: 503 })

    const parsed = timetableRowSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid paper', status: 400 }, { status: 400 })
    }
    const row = parsed.data
    const updated = await db
      .update(schema.examTimetable)
      .set({
        examDate: row.examDate,
        sessionSlot: row.sessionSlot,
        paperCode: row.paperCode?.trim() || null,
        paperName: row.paperName,
        durationText: row.durationText?.trim() || null,
        startTime: row.startTime || null,
        endTime: row.endTime || null,
        needsCouncilTime: row.needsCouncilTime,
        isNewCurriculum: row.isNewCurriculum,
        updatedAt: new Date(),
      })
      .where(eq(schema.examTimetable.id, row.id))
      .returning()
    if (updated.length === 0) return NextResponse.json({ error: 'Paper not found', status: 404 }, { status: 404 })

    await recordAuditLog({
      actorId: gate.user.id,
      actorName: gate.user.name || 'Unknown',
      actorRole: gate.user.role,
      action: 'TIMETABLE_PAPER_EDITED',
      entityType: 'exam_timetable',
      entityId: row.id,
      details: { paperName: row.paperName, examDate: row.examDate },
    })
    return NextResponse.json({ row: updated[0] })
  } catch (err) {
    console.error('timetable update failed:', err)
    return NextResponse.json({ error: 'Could not update the paper.', status: 500 }, { status: 500 })
  }
}

const addRowSchema = timetableRowSchema.omit({ id: true }).extend({
  operationId: z.string().min(1),
})

/** POST /api/timetable — add one paper by hand (Command staff). */
export async function POST(request: Request) {
  try {
    const gate = await requireCommand(request as any)
    if (gate.error) return gate.error
    if (!isLiveDatabase || !db) return NextResponse.json({ error: 'Database not connected', status: 503 }, { status: 503 })

    const parsed = addRowSchema.safeParse(await request.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid paper', status: 400 }, { status: 400 })
    }
    const row = parsed.data
    const inserted = await db
      .insert(schema.examTimetable)
      .values({
        id: `tt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        operationId: row.operationId,
        examDate: row.examDate,
        sessionSlot: row.sessionSlot,
        paperCode: row.paperCode?.trim() || null,
        paperName: row.paperName,
        durationText: row.durationText?.trim() || null,
        startTime: row.startTime || null,
        endTime: row.endTime || null,
        needsCouncilTime: row.needsCouncilTime,
        isNewCurriculum: row.isNewCurriculum,
        sortOrder: 9999,
      })
      .returning()

    await recordAuditLog({
      actorId: gate.user.id,
      actorName: gate.user.name || 'Unknown',
      actorRole: gate.user.role,
      action: 'TIMETABLE_PAPER_ADDED',
      entityType: 'exam_timetable',
      entityId: inserted[0].id,
      details: { paperName: row.paperName, examDate: row.examDate },
    })
    return NextResponse.json({ row: inserted[0] })
  } catch (err) {
    console.error('timetable insert failed:', err)
    return NextResponse.json({ error: 'Could not add the paper.', status: 500 }, { status: 500 })
  }
}

/**
 * DELETE /api/timetable?id=<rowId> — remove one paper (Command staff).
 * DELETE /api/timetable?operationId=<id>&scope=papers — wipe a series' timetable (Admins only).
 *   The series shell, officer deployments and check-in history are kept.
 */
export async function DELETE(request: Request) {
  try {
    if (!isLiveDatabase || !db) return NextResponse.json({ error: 'Database not connected', status: 503 }, { status: 503 })

    const { searchParams } = new URL(request.url)
    const operationId = searchParams.get('operationId')
    const scope = searchParams.get('scope')

    if (operationId && scope === 'papers') {
      // Admin-only, destructive: remove every paper in the series
      const adminGate = await requireAdmin(request as any)
      if (adminGate.error) return adminGate.error

      const removed = await db
        .delete(schema.examTimetable)
        .where(eq(schema.examTimetable.operationId, operationId))
        .returning({ id: schema.examTimetable.id })

      await recordAuditLog({
        actorId: adminGate.user.id,
        actorName: adminGate.user.name || 'Unknown',
        actorRole: adminGate.user.role,
        action: 'TIMETABLE_CLEARED',
        entityType: 'exam_timetable',
        entityId: operationId,
        details: { removedCount: removed.length },
      })
      await recordSecurityEvent({
        action: 'TIMETABLE_CLEARED',
        actorId: adminGate.user.id,
        actorName: adminGate.user.name || 'Unknown',
        actorRole: adminGate.user.role,
        details: { operationId, removedCount: removed.length },
      })
      return NextResponse.json({ ok: true, removed: removed.length })
    }

    const gate = await requireCommand(request as any)
    if (gate.error) return gate.error

    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id or operationId+scope=papers is required', status: 400 }, { status: 400 })

    const removed = await db.delete(schema.examTimetable).where(eq(schema.examTimetable.id, id)).returning()
    if (removed.length === 0) return NextResponse.json({ error: 'Paper not found', status: 404 }, { status: 404 })

    await recordAuditLog({
      actorId: gate.user.id,
      actorName: gate.user.name || 'Unknown',
      actorRole: gate.user.role,
      action: 'TIMETABLE_PAPER_DELETED',
      entityType: 'exam_timetable',
      entityId: id,
      details: { paperName: removed[0].paperName, examDate: removed[0].examDate },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('timetable delete failed:', err)
    return NextResponse.json({ error: 'Could not delete the timetable.', status: 500 }, { status: 500 })
  }
}
