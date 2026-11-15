import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { hashPin } from '@/lib/auth/pin'
import { recordAuditLog, recordSecurityEvent } from '@/lib/db/audit'
import { requireCommand } from '@/lib/auth/guard'
import { eq } from 'drizzle-orm'
import crypto from 'crypto'

const BANNED = new Set([
  '0000','1111','2222','3333','4444','5555','6666','7777','8888','9999',
  '0123','1234','2345','3456','4567','5678','6789','7890',
  '0987','9876','8765','7654','6543','5432','4321','3210',
])

function generateTempPin(): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    const pin = String(crypto.randomInt(0, 10000)).padStart(4, '0')
    if (!BANNED.has(pin)) return pin
  }
  throw new Error('Could not generate a safe temporary PIN')
}

function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for') || ''
  return forwarded.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
}

/**
 * POST /api/requests/decide
 * Body: { kind: 'access' | 'pin', id: string, action: 'approve' | 'decline' | 'issue', note?: string }
 *
 * access + approve → creates the FIELD_OFFICER account (status ACTIVE, chosen PIN).
 * access + decline → marks the request DECLINED.
 * pin + issue     → generates a one-time temporary PIN, hashes it onto the officer,
 *                   forces PIN change at next sign-in, shows the PIN ONCE.
 * pin + approve   → (same as issue; kept for clarity at the UI layer)
 * pin + decline   → marks the request DECLINED.
 */
export async function POST(request: Request) {
  try {
    const gate = await requireCommand(request as any)
    if (gate.error) return gate.error
    if (!isLiveDatabase || !db) return NextResponse.json({ error: 'Database not connected' }, { status: 503 })

    const body = await request.json().catch(() => ({}))
    const kind = String(body.kind || '')
    const id = String(body.id || '')
    const action = String(body.action || '')
    const note = body.note ? String(body.note).slice(0, 400) : null

    if (!id || !['access', 'pin'].includes(kind) || !['approve', 'decline', 'issue'].includes(action)) {
      return NextResponse.json({ error: 'Unknown request or action.' }, { status: 400 })
    }
    const actor = { id: gate.user.id, name: gate.user.name || 'Unknown', role: gate.user.role }

    /* ---------------- ACCESS REQUESTS ---------------- */
    if (kind === 'access') {
      const rows = await db.select().from(schema.accountRequests).where(eq(schema.accountRequests.id, id)).limit(1)
      const reqRow = rows[0]
      if (!reqRow) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
      if (reqRow.status !== 'PENDING') {
        return NextResponse.json({ error: 'This request has already been decided.' }, { status: 409 })
      }

      if (action === 'decline') {
        await db
          .update(schema.accountRequests)
          .set({ status: 'DECLINED', note, decidedAt: new Date(), decidedBy: actor.id, decidedByName: actor.name })
          .where(eq(schema.accountRequests.id, id))
        await recordAuditLog({ actorId: actor.id, actorName: actor.name, actorRole: actor.role, action: 'ACCESS_DECLINED', entityType: 'account_requests', entityId: id, details: { message: `Declined access for ${reqRow.fullName}`, note } })
        return NextResponse.json({ ok: true, status: 'DECLINED' })
      }

      // Approve → create the field officer account
      const digits = (reqRow.phone || '').replace(/\D/g, '')
      const last9 = digits.slice(-9)

      // Last-9 collision guard at decision time
      const allUsers = await db.select({ id: schema.user.id, phone: schema.user.phone, status: schema.user.status }).from(schema.user)
      const collision = allUsers.find((u) => {
        const d = (u.phone || '').replace(/\D/g, '')
        return d.length >= 9 && d.slice(-9) === last9 && u.status === 'ACTIVE'
      })
      if (collision) {
        return NextResponse.json({ error: 'This phone number already has an account. Decline instead.' }, { status: 409 })
      }

      // Staff ID uniqueness guard
      const staffTaken = await db
        .select({ id: schema.user.id })
        .from(schema.user)
        .where(eq(schema.user.staffId, reqRow.staffId))
        .limit(1)
      if (staffTaken.length > 0) {
        return NextResponse.json({ error: `Staff ID ${reqRow.staffId} is already in use. Decline this request.` }, { status: 409 })
      }

      // Re-validate the stored PIN against the shared policy (defence in depth)
      // (The hash cannot be checked for triviality, so we trust the check done at creation time.)

      const regionRows = await db.select({ id: schema.regions.id, name: schema.regions.name }).from(schema.regions).limit(1)
      const regionId = regionRows[0]?.id || null
      const newUserId = `usr-off-${Date.now()}`

      await db.insert(schema.user).values({
        id: newUserId,
        name: reqRow.fullName,
        firstName: reqRow.fullName.split(' ').slice(0, 1).join(' '),
        lastName: reqRow.fullName.split(' ').slice(1).join(' ') || '',
        email: `${(reqRow.staffId || 'officer').toLowerCase().replace(/[^a-z0-9]+/g, '.')}@waec-field.gh`,
        phone: digits,
        staffId: reqRow.staffId,
        role: 'FIELD_OFFICER',
        status: 'ACTIVE',
        groupName: 'Group 1',
        isGroupLeader: false,
        regionId,
        mustChangePassword: false,
        pin: reqRow.pinHash, // already an argon2id hash from request creation
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await db
        .update(schema.accountRequests)
        .set({ status: 'APPROVED', note, decidedAt: new Date(), decidedBy: actor.id, decidedByName: actor.name })
        .where(eq(schema.accountRequests.id, id))

      await recordAuditLog({ actorId: actor.id, actorName: actor.name, actorRole: actor.role, action: 'ACCESS_APPROVED', entityType: 'account_requests', entityId: id, details: { message: `Approved access for ${reqRow.fullName}`, userId: newUserId, staffId: reqRow.staffId } })
      await recordSecurityEvent({ action: 'ACCESS_APPROVED', actorId: actor.id, actorName: actor.name, actorRole: actor.role, details: { userId: newUserId, phone: digits } })
      return NextResponse.json({ ok: true, status: 'APPROVED', userId: newUserId })
    }

    /* ---------------- PIN RESET REQUESTS ---------------- */
    const rows = await db.select().from(schema.pinResetRequests).where(eq(schema.pinResetRequests.id, id)).limit(1)
    const reqRow = rows[0]
    if (!reqRow) return NextResponse.json({ error: 'Request not found.' }, { status: 404 })
    if (reqRow.status !== 'PENDING') {
      return NextResponse.json({ error: 'This request has already been decided.' }, { status: 409 })
    }

    if (action === 'decline') {
      await db
        .update(schema.pinResetRequests)
        .set({ status: 'DECLINED', note, decidedAt: new Date(), decidedBy: actor.id, decidedByName: actor.name })
        .where(eq(schema.pinResetRequests.id, id))
      await recordAuditLog({ actorId: actor.id, actorName: actor.name, actorRole: actor.role, action: 'PIN_RESET_DECLINED', entityType: 'pin_reset_requests', entityId: id, details: { message: `Declined PIN reset for ${reqRow.officerName}`, note } })
      return NextResponse.json({ ok: true, status: 'DECLINED' })
    }

    // approve or issue → create a one-time temporary PIN (expires in 24h)
    if (!reqRow.officerId) {
      return NextResponse.json({ error: 'This request is not linked to an officer account.' }, { status: 400 })
    }
    const tempPin = generateTempPin()
    const tempExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await db
      .update(schema.user)
      .set({ pin: hashPin(tempPin), mustChangePassword: true, updatedAt: new Date() })
      .where(eq(schema.user.id, reqRow.officerId))

    await db
      .update(schema.pinResetRequests)
      .set({ status: 'ISSUED', decidedAt: new Date(), decidedBy: actor.id, decidedByName: actor.name, tempExpiresAt, note })
      .where(eq(schema.pinResetRequests.id, id))

    await recordAuditLog({ actorId: actor.id, actorName: actor.name, actorRole: actor.role, action: 'PIN_RESET_ISSUED', entityType: 'pin_reset_requests', entityId: id, details: { message: `Issued temporary PIN for ${reqRow.officerName}; expires ${tempExpiresAt.toISOString()}`, officerId: reqRow.officerId } })
    await recordSecurityEvent({ action: 'PIN_RESET_ISSUED', actorId: actor.id, actorName: actor.name, actorRole: actor.role, details: { officerId: reqRow.officerId, expires: tempExpiresAt.toISOString() } })

    return NextResponse.json({ ok: true, status: 'ISSUED', tempPin, expiresAt: tempExpiresAt.toISOString() })
  } catch (err) {
    console.error('requests decide failed:', err)
    return NextResponse.json({ error: 'Could not process the request.' }, { status: 500 })
  }
}
