import { NextResponse } from 'next/server'
import { sendSms } from '@/lib/sms'
import { DEFAULT_SYSTEM_SETTINGS } from '@/lib/settings-utils'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { dummyVerify } from '@/lib/auth/password'
import { recordAuditLog, recordSecurityEvent } from '@/lib/db/audit'
import { hitRateLimit, requestIp } from '@/lib/auth/rate-limit'
import { forgotPinSchema } from '@/lib/validation-schemas'
import { eq } from 'drizzle-orm'

/**
 * POST /api/auth/forgot-password
 * Creates a PIN-reset request for the regional controller. ALWAYS returns
 * the same response whether the number/staff ID matches an account or not —
 * the page cannot be used to enumerate officers. Rate-limited per device
 * and per identifier.
 */
export async function POST(request: Request) {
  try {
    if (!isLiveDatabase || !db) {
      return NextResponse.json({ error: 'Requests are temporarily unavailable. Try again later.' }, { status: 503 })
    }
    const ip = requestIp(request)

    const parsed = forgotPinSchema.safeParse(await request.json().catch(() => ({})))
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Enter your phone number or staff ID' }, { status: 400 })
    }
    const identifier = parsed.data.identifier.trim()

    const [ipBudget, idBudget] = await Promise.all([
      hitRateLimit(`forgot:ip:${ip}`, 10),
      hitRateLimit(`forgot:id:${identifier.toLowerCase()}`, 5),
    ])
    if (ipBudget.limited || idBudget.limited) {
      return NextResponse.json({ error: 'Too many requests from this device. Try again later.' }, { status: 429 })
    }

    const digits = identifier.replace(/\D/g, '')
    const last9 = digits.length >= 9 ? digits.slice(-9) : ''

    const officers = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        phone: schema.user.phone,
        staffId: schema.user.staffId,
        role: schema.user.role,
        regionId: schema.user.regionId,
      })
      .from(schema.user)

    const officer =
      officers.find((u) => {
        const d = (u.phone || '').replace(/\D/g, '')
        return last9 && d.length >= 9 && d.slice(-9) === last9
      }) ||
      officers.find((u) => (u.staffId || '').toUpperCase() === identifier.toUpperCase())

    // If we matched an officer, also find a regional controller's phone for the
    // "Call my controller" button on the confirmation screen. Otherwise null.
    const officerRegionId = officer ? (officer.regionId || null) : null
    let controllerPhone: string | null = null
    if (officer && officerRegionId) {
      const controllers = await db
        .select({ phone: schema.user.phone, role: schema.user.role })
        .from(schema.user)
        .where(eq(schema.user.regionId, officerRegionId))
      const match = controllers.find((c) => {
        const r = (c.role || '').toUpperCase()
        return (r === 'REGIONAL_COORD' || r === 'SUPERVISOR') && c.phone
      })
      controllerPhone = match?.phone || null
    }

    // Always burn comparable time — the response must not reveal whether the account exists
    dummyVerify('0000000000')

    if (officer && (officer.role || '').toUpperCase() === 'FIELD_OFFICER') {
      const existing = await db
        .select({ id: schema.pinResetRequests.id, status: schema.pinResetRequests.status })
        .from(schema.pinResetRequests)
        .where(eq(schema.pinResetRequests.officerId, officer.id))
      const hasPending = existing.some((r) => r.status === 'PENDING')

      if (!hasPending) {
        const id = `pinreq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        await db.insert(schema.pinResetRequests).values({
          id,
          officerId: officer.id,
          officerName: officer.name,
          officerPhone: officer.phone || digits,
          staffId: officer.staffId || null,
          status: 'PENDING',
          createdByIp: ip,
        })
        await recordAuditLog({
          actorId: officer.id,
          actorName: officer.name,
          actorRole: 'FIELD_OFFICER',
          action: 'PIN_RESET_REQUESTED',
          entityType: 'pin_reset_requests',
          entityId: id,
          details: { message: `${officer.name} asked for a new PIN` },
        })
        await recordSecurityEvent({
          action: 'PIN_RESET_REQUESTED',
          actorId: officer.id,
          actorName: officer.name,
          actorRole: 'FIELD_OFFICER',
          details: { requestId: id },
          ipAddress: ip,
        })
        // Best-effort SMS to the regional controller(s) — only if enabled in settings
        try {
          if (officerRegionId) {
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
                .where(eq(schema.user.regionId, officerRegionId))
              const targets = controllers.filter((c) => {
                const r = (c.role || '').toUpperCase()
                return (r === 'REGIONAL_COORD' || r === 'SUPERVISOR') && c.phone
              })
              const message = `WAEC MOS: ${officer.name} (${officer.staffId || 'field officer'}) asked for a new PIN. Open Directory to approve or decline.`
              await Promise.all(targets.map((t) => sendSms(t.phone!, message)))
            }
          }
        } catch (e) {
          console.error('Controller SMS failed:', e) // SMS is best-effort — request still stands
        }
      }
    }

    // Identical response whether or not the account exists
    return NextResponse.json({ ok: true, sentAt: new Date().toISOString(), controllerPhone })
  } catch (err) {
    console.error('forgot-pin failed:', err)
    return NextResponse.json({ error: 'Something went wrong on our side. Try again.' }, { status: 500 })
  }
}
