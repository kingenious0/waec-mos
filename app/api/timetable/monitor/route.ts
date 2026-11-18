import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { recordAuditLog } from '@/lib/db/audit'
import { requireCommand } from '@/lib/auth/guard'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

const toggleSchema = z.object({
  operationId: z.string().min(1),
  paperId: z.string().min(1),
  monitored: z.boolean(),
})

/** POST /api/timetable/monitor — flag/unflag a paper as part of the monitored set. */
export async function POST(request: Request) {
  try {
    const gate = await requireCommand(request as any)
    if (gate.error) return gate.error
    if (!isLiveDatabase || !db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 503 })
    }

    const parsed = toggleSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'operationId, paperId and monitored are required' }, { status: 400 })
    }
    const { operationId, paperId, monitored } = parsed.data

    // Paper must belong to that series — never toggle cross-series.
    const paperRows = await db
      .select({ id: schema.examTimetable.id })
      .from(schema.examTimetable)
      .where(and(eq(schema.examTimetable.id, paperId), eq(schema.examTimetable.operationId, operationId)))
      .limit(1)
    if (paperRows.length === 0) {
      return NextResponse.json({ error: 'Paper not found in that series.' }, { status: 404 })
    }

    if (monitored) {
      await db
        .insert(schema.monitoredPapers)
        .values({
          id: `mon-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          operationId,
          paperId,
        })
        .onConflictDoNothing()
    } else {
      await db
        .delete(schema.monitoredPapers)
        .where(and(eq(schema.monitoredPapers.operationId, operationId), eq(schema.monitoredPapers.paperId, paperId)))
    }

    await recordAuditLog({
      actorId: gate.user.id,
      actorName: gate.user.name || 'Unknown',
      actorRole: gate.user.role,
      action: monitored ? 'PAPER_MONITORED' : 'PAPER_UNMONITORED',
      entityType: 'exam_timetable',
      entityId: paperId,
      details: { operationId, monitored },
    })

    return NextResponse.json({ ok: true, monitored })
  } catch (err) {
    console.error('monitor toggle failed:', err)
    return NextResponse.json({ error: 'Could not update the paper.' }, { status: 500 })
  }
}
