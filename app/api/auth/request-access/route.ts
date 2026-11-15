import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { hashPin } from '@/lib/auth/pin'
import { dummyVerify } from '@/lib/auth/password'
import { validatePin } from '@/lib/auth/pin-policy'
import { recordAuditLog, recordSecurityEvent } from '@/lib/db/audit'
import { hitRateLimit, requestIp } from '@/lib/auth/rate-limit'
import { accessRequestSchema } from '@/lib/validation-schemas'
import { sendSms } from '@/lib/sms'
import { DEFAULT_SYSTEM_SETTINGS } from '@/lib/settings-utils'
import { eq } from 'drizzle-orm'

/**
 * POST /api/auth/request-access
 * Creates a PENDING account request — never an active account. The regional
 * controller reviews it in the Directory and approves or declines.
 * Requests are rate-limited per device and per phone number.
 */
export async function POST(request: Request) {
  try {
    if (!isLiveDatabase || !db) {
      return NextResponse.json(
        { error: 'Requests are temporarily unavailable. Try again later.' },
        { status: 503 }
      )
    }
    const ip = requestIp(request)

    const parsed = accessRequestSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Check your details and try again.' },
        { status: 400 }
      )
    }
    const { fullName, phone, staffId, pin } = parsed.data

    const [ipBudget, phoneBudget] = await Promise.all([
      hitRateLimit(`accessreq:ip:${ip}`, 10),
      hitRateLimit(`accessreq:phone:${phone}`, 5),
    ])
    if (ipBudget.limited || phoneBudget.limited) {
      return NextResponse.json({ error: 'Too many requests from this device. Try again later.' }, { status: 429 })
    }

    const check = validatePin(pin, phone)
    if (!check.ok) {
      return NextResponse.json({ error: check.reason }, { status: 400 })
    }

    const digits = phone.replace(/\D/g, '')
    const last9 = digits.slice(-9)

    // Phone matches an existing account? Compare last-9 digits (same rule as sign-in).
    const rows = await db
      .select({ id: schema.user.id, phone: schema.user.phone, status: schema.user.status })
      .from(schema.user)
    const existing = rows.find((u) => {
      const d = (u.phone || '').replace(/\D/g, '')
      return d.length >= 9 && d.slice(-9) === last9 && u.status === 'ACTIVE'
    })
    if (existing) {
      dummyVerify(pin) // burn comparable time
      return NextResponse.json(
        { error: 'This phone number already has an account. Sign in instead.' },
        { status: 409 }
      )
    }

    // Already pending from this phone? Treat as success to avoid duplicate rows.
    const pendings = await db
      .select({ id: schema.accountRequests.id, phone: schema.accountRequests.phone, status: schema.accountRequests.status })
      .from(schema.accountRequests)
      .where(eq(schema.accountRequests.status, 'PENDING'))
    const duplicate = pendings.find((p) => {
      const d = (p.phone || '').replace(/\D/g, '')
      return d.length >= 9 && d.slice(-9) === last9
    })
    if (duplicate) {
      return NextResponse.json({ ok: true, alreadyPending: true })
    }

    const id = `accreq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    await db.insert(schema.accountRequests).values({
      id,
      fullName,
      phone: digits,
      staffId: staffId.toUpperCase(),
      pinHash: hashPin(pin),
      status: 'PENDING',
      createdByIp: ip,
    })

    await recordAuditLog({
      actorId: id,
      actorName: fullName,
      actorRole: 'REQUESTER',
      action: 'ACCESS_REQUESTED',
      entityType: 'account_requests',
      entityId: id,
      details: { message: `${fullName} requested access`, phone: digits, staffId: staffId.toUpperCase() },
    })
    await recordSecurityEvent({
      action: 'ACCESS_REQUESTED',
      actorName: fullName,
      actorRole: 'REQUESTER',
      details: { requestId: id, phone: digits, staffId: staffId.toUpperCase() },
      ipAddress: ip,
    })

    // Best-effort SMS to regional controllers — a new access request needs a review
    try {
      const rows = await db
        .select({ smsToController: schema.systemSettings.smsToController })
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.id, 'default-ashanti'))
        .limit(1)
      const smsEnabled = rows[0]?.smsToController ?? DEFAULT_SYSTEM_SETTINGS.smsToController
      if (smsEnabled) {
        const controllers = await db
          .select({ phone: schema.user.phone, role: schema.user.role })
          .from(schema.user)
        const targets = controllers.filter((c) => {
          const r = (c.role || '').toUpperCase()
          return (r === 'REGIONAL_COORD' || r === 'SUPERVISOR') && c.phone
        })
        const message = `WAEC MOS: ${fullName} (${staffId.toUpperCase()}) asked for access. Open Directory to approve or decline.`
        await Promise.all(targets.map((t) => sendSms(t.phone!, message)))
      }
    } catch (e) {
      console.error('Controller SMS failed:', e) // best effort — request still stands
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('request-access failed:', err)
    return NextResponse.json({ error: 'Something went wrong on our side. Try again.' }, { status: 500 })
  }
}
