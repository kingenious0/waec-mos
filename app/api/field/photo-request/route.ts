import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { recordAuditLog } from '@/lib/db/audit'
import { getServerUser, roleKind } from '@/lib/auth/guard'
import { canActOnOfficer } from '@/lib/field/team-access'
import { isProofRequestReason } from '@/lib/field/proof-reasons'
import { and, desc, eq, gte, or } from 'drizzle-orm'
import { z } from 'zod'

export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  action: z.enum(['request', 'fulfill', 'cancel']).optional().default('request'),
  officerId: z.string().min(1).optional(),
  requestId: z.string().min(1).optional(),
  reason: z.string().trim().max(160).optional(),
})

function requestView(r: {
  id: string
  officerId: string
  requesterId: string
  requesterName: string
  reason: string
  status: string
  evidenceId: string | null
  createdAt: Date
  fulfilledAt: Date | null
}) {
  return {
    id: r.id,
    officerId: r.officerId,
    requesterId: r.requesterId,
    requesterName: r.requesterName,
    reason: r.reason,
    status: r.status,
    evidenceId: r.evidenceId,
    createdAt: r.createdAt.toISOString(),
    fulfilledAt: r.fulfilledAt ? r.fulfilledAt.toISOString() : null,
  }
}

/** GET — officers see requests for them; HQ/leaders see what they raised. */
export async function GET(request: Request) {
  try {
    const caller = await getServerUser(request as any)
    if (!caller) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
    if (!isLiveDatabase || !db) return NextResponse.json({ requests: [] })

    const kind = roleKind(caller.role)
    const selection = {
      id: schema.photoRequests.id,
      officerId: schema.photoRequests.officerId,
      requesterId: schema.photoRequests.requesterId,
      requesterName: schema.photoRequests.requesterName,
      reason: schema.photoRequests.reason,
      status: schema.photoRequests.status,
      evidenceId: schema.photoRequests.evidenceId,
      createdAt: schema.photoRequests.createdAt,
      fulfilledAt: schema.photoRequests.fulfilledAt,
    }
    const order = desc(schema.photoRequests.createdAt)

    const rows =
      kind === 'officer'
        ? await db
            .select(selection)
            .from(schema.photoRequests)
            .where(
              or(
                eq(schema.photoRequests.officerId, caller.id),
                eq(schema.photoRequests.requesterId, caller.id)
              )
            )
            .orderBy(order)
            .limit(10)
        : kind === 'admin'
        ? await db
            .select(selection)
            .from(schema.photoRequests)
            .orderBy(order)
            .limit(50)
        : await db
            .select(selection)
            .from(schema.photoRequests)
            .where(eq(schema.photoRequests.requesterId, caller.id))
            .orderBy(order)
            .limit(50)

    return NextResponse.json({ requests: rows.map(requestView) })
  } catch (err) {
    console.error('photo request GET failed:', err)
    return NextResponse.json({ error: 'Could not load photo requests.' }, { status: 500 })
  }
}

/** POST — ask for proof, upload confirmation, or cancel a pending ask. */
export async function POST(request: Request) {
  try {
    const caller = await getServerUser(request as any)
    if (!caller) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
    if (!isLiveDatabase || !db) {
      return NextResponse.json({ error: 'Database not connected' }, { status: 503 })
    }

    const parsed = bodySchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid photo request.' }, { status: 400 })
    }
    const { action, officerId, requestId, reason } = parsed.data
    const kind = roleKind(caller.role)

    // ---------- HQ / group leader asks an officer for one photo ----------
    if (action === 'request') {
      if (!officerId) {
        return NextResponse.json({ error: 'Choose the officer first.' }, { status: 400 })
      }
      // A group leader is still an officer account — team-access decides who
      // they may act on, so an ordinary officer cannot ask on anyone's behalf.
      if (!(await canActOnOfficer(caller, officerId)) || (kind === 'officer' && officerId === caller.id)) {
        return NextResponse.json(
          { error: 'Only Regional Command or your group leader can ask for proof.' },
          { status: 403 }
        )
      }
      if (reason && !isProofRequestReason(reason)) {
        return NextResponse.json({ error: 'Choose one of the listed reasons.' }, { status: 422 })
      }

      const pending = await db
        .select({ id: schema.photoRequests.id })
        .from(schema.photoRequests)
        .where(
          and(
            eq(schema.photoRequests.officerId, officerId),
            eq(schema.photoRequests.requesterId, caller.id),
            eq(schema.photoRequests.status, 'PENDING')
          )
        )
        .limit(1)
      if (pending[0]) {
        return NextResponse.json({ ok: true, alreadyPending: true, id: pending[0].id })
      }

      const id = `req-photo-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
      const message = reason || 'Please send one photo proof'
      await db.insert(schema.photoRequests).values({
        id,
        officerId,
        requesterId: caller.id,
        requesterName: caller.name || 'Regional Command',
        reason: message,
        status: 'PENDING',
      })
      await recordAuditLog({
        actorId: caller.id,
        actorName: caller.name || 'Regional Command',
        actorRole: caller.role,
        action: 'PHOTO_PROOF_REQUESTED',
        entityType: 'photo_requests',
        entityId: id,
        details: { message: `${caller.name} asked ${officerId} for photo proof: ${message}` },
      })
      return NextResponse.json({ ok: true, request: { id, officerId, reason: message, status: 'PENDING' } })
    }

    if (!requestId) {
      return NextResponse.json({ error: 'requestId is required.' }, { status: 400 })
    }
    const rows = await db
      .select()
      .from(schema.photoRequests)
      .where(eq(schema.photoRequests.id, requestId))
      .limit(1)
    const row = rows[0]

    if (!row) {
      return NextResponse.json({ error: 'Photo request not found.' }, { status: 404 })
    }

    // ---------- Officer marks the request done after uploading a photo ----------
    if (action === 'fulfill') {
      if (kind !== 'officer' || row.officerId !== caller.id) {
        return NextResponse.json(
          { error: 'Only the officer who received the request can send the photo.' },
          { status: 403 }
        )
      }
      if (row.status !== 'PENDING') {
        return NextResponse.json({ ok: true, alreadyDone: true })
      }

      const evidence = await db
        .select({ id: schema.evidencePhotos.id })
        .from(schema.evidencePhotos)
        .where(
          and(
            eq(schema.evidencePhotos.officerId, caller.id),
            gte(schema.evidencePhotos.createdAt, row.createdAt)
          )
        )
        .orderBy(desc(schema.evidencePhotos.createdAt))
        .limit(1)
      if (!evidence[0]) {
        return NextResponse.json(
          { error: 'Take and save the photo first, then send it.' },
          { status: 422 }
        )
      }

      await db
        .update(schema.photoRequests)
        .set({ status: 'FULFILLED', evidenceId: evidence[0].id, fulfilledAt: new Date() })
        .where(eq(schema.photoRequests.id, row.id))
      await recordAuditLog({
        actorId: caller.id,
        actorName: caller.name || 'Field officer',
        actorRole: caller.role,
        action: 'PHOTO_PROOF_SENT',
        entityType: 'photo_requests',
        entityId: row.id,
        details: { message: `${caller.name} answered the request for photo proof`, reason: row.reason },
      })
      return NextResponse.json({ ok: true, fulfilled: true })
    }

    // ---------- Requester withdraws an ask ----------
    if (row.requesterId !== caller.id && kind !== 'admin') {
      return NextResponse.json({ error: 'Only the person who asked can cancel it.' }, { status: 403 })
    }
    if (row.status !== 'PENDING') {
      return NextResponse.json({ ok: true, alreadyDone: true })
    }
    await db
      .update(schema.photoRequests)
      .set({ status: 'CANCELLED' })
      .where(eq(schema.photoRequests.id, row.id))
    await recordAuditLog({
      actorId: caller.id,
      actorName: caller.name || 'Regional Command',
      actorRole: caller.role,
      action: 'PHOTO_PROOF_REQUEST_CANCELLED',
      entityType: 'photo_requests',
      entityId: row.id,
      details: { message: `${caller.name} withdrew a photo proof request` },
    })
    return NextResponse.json({ ok: true, cancelled: true })
  } catch (err) {
    console.error('photo request POST failed:', err)
    return NextResponse.json({ error: 'Could not update the photo request.' }, { status: 500 })
  }
}
