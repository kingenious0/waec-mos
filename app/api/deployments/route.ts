import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { recordAuditLog } from '@/lib/db/audit'
import { requireCommand } from '@/lib/auth/guard'
import { desc, eq, and } from 'drizzle-orm'
import { z } from 'zod'

/**
 * GET /api/deployments?operationId=<id>
 * Who is deployed where for a series: series anchors plus dated overrides.
 */
export async function GET(request: Request) {
  try {
    const gate = await requireCommand(request as any)
    if (gate.error) return gate.error
    if (!isLiveDatabase || !db) return NextResponse.json({ error: 'Database not connected', status: 503 }, { status: 503 })

    const { searchParams } = new URL(request.url)
    const operationId = searchParams.get('operationId')
    if (!operationId) return NextResponse.json({ error: 'operationId is required', status: 400 }, { status: 400 })

    const rows = await db
      .select({
        id: schema.officerDeployments.id,
        operationId: schema.officerDeployments.operationId,
        officerId: schema.officerDeployments.officerId,
        officerName: schema.user.name,
        staffId: schema.user.staffId,
        centerId: schema.officerDeployments.centerId,
        centerName: schema.examinationCenters.centerName,
        centerCode: schema.examinationCenters.centerCode,
        deploymentDate: schema.officerDeployments.deploymentDate,
        shiftRole: schema.officerDeployments.shiftRole,
        notes: schema.officerDeployments.notes,
        updatedAt: schema.officerDeployments.updatedAt,
      })
      .from(schema.officerDeployments)
      .innerJoin(schema.user, eq(schema.user.id, schema.officerDeployments.officerId))
      .innerJoin(schema.examinationCenters, eq(schema.examinationCenters.id, schema.officerDeployments.centerId))
      .where(eq(schema.officerDeployments.operationId, operationId))
      .orderBy(desc(schema.officerDeployments.updatedAt))

    return NextResponse.json({ deployments: rows })
  } catch (err) {
    console.error('deployments list failed:', err)
    return NextResponse.json({ error: 'Could not load deployments.', status: 500 }, { status: 500 })
  }
}

const deploySchema = z.object({
  operationId: z.string().min(1),
  officerId: z.string().min(1),
  centerId: z.string().min(1),
  deploymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal('')).default(''),
  shiftRole: z.enum(['MONITOR', 'GROUP_LEADER', 'RELIEF']).default('MONITOR'),
  notes: z.string().trim().max(240).optional(),
})

/**
 * POST /api/deployments
 * Anchor an officer to a centre for the whole series (deploymentDate: '')
 * or assign a one-day override/relief (deploymentDate: YYYY-MM-DD).
 * Same key (operation + officer + date) replaces the existing row.
 */
export async function POST(request: Request) {
  try {
    const gate = await requireCommand(request as any)
    if (gate.error) return gate.error
    if (!isLiveDatabase || !db) return NextResponse.json({ error: 'Database not connected', status: 503 }, { status: 503 })

    const parsed = deploySchema.safeParse(await request.json())
    if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid deployment', status: 400 }, { status: 400 })
    const d = parsed.data

    // Replace any existing anchor/override for the same (operation, officer, date)
    await db
      .delete(schema.officerDeployments)
      .where(
        and(
          eq(schema.officerDeployments.operationId, d.operationId),
          eq(schema.officerDeployments.officerId, d.officerId),
          eq(schema.officerDeployments.deploymentDate, d.deploymentDate)
        )
      )

    const inserted = await db
      .insert(schema.officerDeployments)
      .values({
        id: `dep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        operationId: d.operationId,
        officerId: d.officerId,
        centerId: d.centerId,
        deploymentDate: d.deploymentDate,
        shiftRole: d.shiftRole,
        notes: d.notes?.trim() || null,
        updatedAt: new Date(),
      })
      .returning()

    await recordAuditLog({
      actorId: gate.user.id,
      actorName: gate.user.name || 'Unknown',
      actorRole: gate.user.role,
      action: 'OFFICER_DEPLOYED',
      entityType: 'officer_deployments',
      entityId: inserted[0].id,
      details: {
        operationId: d.operationId,
        officerId: d.officerId,
        centerId: d.centerId,
        deploymentDate: d.deploymentDate || 'SERIES_ANCHOR',
        shiftRole: d.shiftRole,
      },
    })
    return NextResponse.json({ deployment: inserted[0] })
  } catch (err) {
    console.error('deployment save failed:', err)
    return NextResponse.json({ error: 'Could not save the deployment.', status: 500 }, { status: 500 })
  }
}

/** DELETE /api/deployments?id=<id> — lift an officer from a series (Command staff). */
export async function DELETE(request: Request) {
  try {
    const gate = await requireCommand(request as any)
    if (gate.error) return gate.error
    if (!isLiveDatabase || !db) return NextResponse.json({ error: 'Database not connected', status: 503 }, { status: 503 })

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id is required', status: 400 }, { status: 400 })

    const removed = await db.delete(schema.officerDeployments).where(eq(schema.officerDeployments.id, id)).returning()
    if (removed.length === 0) return NextResponse.json({ error: 'Deployment not found', status: 404 }, { status: 404 })

    await recordAuditLog({
      actorId: gate.user.id,
      actorName: gate.user.name || 'Unknown',
      actorRole: gate.user.role,
      action: 'OFFICER_UNDEPLOYED',
      entityType: 'officer_deployments',
      entityId: id,
      details: {
        officerId: removed[0].officerId,
        operationId: removed[0].operationId,
        deploymentDate: removed[0].deploymentDate || 'SERIES_ANCHOR',
      },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('deployment delete failed:', err)
    return NextResponse.json({ error: 'Could not remove the deployment.', status: 500 }, { status: 500 })
  }
}
