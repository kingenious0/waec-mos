import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { recordAuditLog } from '@/lib/db/audit'
import { requireAdmin, requireCommand } from '@/lib/auth/guard'
import { z } from 'zod'

const slug = (name: string) =>
  String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)

/**
 * POST /api/operations
 * Create a new examination series (e.g. "2026 WASSCE PC First Series", "2027 WASSCE SC").
 * HQ supplies the real name, year and window — nothing is invented here.
 */
export async function POST(request: Request) {
  try {
    const gate = await requireAdmin(request as any)
    if (gate.error) return gate.error
    if (!isLiveDatabase || !db) return NextResponse.json({ error: 'Database not connected', status: 503 }, { status: 503 })

    const schemaIn = z.object({
      name: z.string().trim().min(4).max(120),
      seriesYear: z.number().int().min(2020).max(2100),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be YYYY-MM-DD'),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'End date must be YYYY-MM-DD'),
      status: z.enum(['PLANNING', 'ACTIVE', 'COMPLETED', 'ARCHIVED']).default('PLANNING'),
    })
    const parsed = schemaIn.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid series', status: 400 }, { status: 400 })
    const input = parsed.data
    if (input.endDate < input.startDate) {
      return NextResponse.json({ error: 'End date cannot be before start date.', status: 400 }, { status: 400 })
    }

    const id = `op-${slug(input.name)}-${Date.now().toString(36)}`
    const inserted = await db
      .insert(schema.operations)
      .values({
        id,
        name: input.name,
        seriesYear: input.seriesYear,
        startDate: new Date(`${input.startDate}T00:00:00.000Z`),
        endDate: new Date(`${input.endDate}T23:59:59.000Z`),
        status: input.status,
      })
      .returning()

    await recordAuditLog({
      actorId: gate.user.id,
      actorName: gate.user.name || 'Unknown',
      actorRole: gate.user.role,
      action: 'OPERATION_CREATED',
      entityType: 'operations',
      entityId: id,
      details: { name: input.name, seriesYear: input.seriesYear, startDate: input.startDate, endDate: input.endDate },
    })
    return NextResponse.json({ operation: inserted[0] })
  } catch (err) {
    console.error('operation create failed:', err)
    return NextResponse.json({ error: 'Could not create the series.', status: 500 }, { status: 500 })
  }
}

/** GET /api/operations — light list of series (name, window, status) for pickers. */
export async function GET(request: Request) {
  try {
    const gate = await requireCommand(request as any)
    if (gate.error) return gate.error
    if (!isLiveDatabase || !db) return NextResponse.json({ error: 'Database not connected', status: 503 }, { status: 503 })
    const ops = await db.select().from(schema.operations).orderBy(schema.operations.seriesYear, schema.operations.startDate)
    return NextResponse.json({ operations: ops })
  } catch (err) {
    console.error('operations list failed:', err)
    return NextResponse.json({ error: 'Could not load series.', status: 500 }, { status: 500 })
  }
}
