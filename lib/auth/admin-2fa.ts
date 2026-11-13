/**
 * Admin sign-in 2FA. After the password passes, a 6-digit SMS code is
 * required. Codes are hashed (secret-peppered sha256), expire in 5 minutes,
 * allow 3 tries, and work once. Provider is swappable via SMS_PROVIDER.
 */
import { verifyPassword } from '@/lib/auth/password'
import { recordAuditLog, recordSecurityEvent } from '@/lib/db/audit'
import { checkLockout, recordLoginFailure, recordLoginSuccess } from '@/lib/auth/lockout'
import { createSession, setSessionCookie } from '@/lib/auth/server-session'
import { getServerUser } from '@/lib/auth/guard'
import { generateCode, hashSmsCode, sendSms, smsCodeMessage } from '@/lib/sms'
import { eq, desc, or, ilike } from 'drizzle-orm'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { NextResponse } from 'next/server'

export type AdminRow = typeof schema.user.$inferSelect

export const SMS_GENERIC_ERROR = 'The code we sent is not right.'
export const SMS_EXPIRED_ERROR = 'That code has expired. Request a new one.'
export const SMS_TOO_MANY_TRIES = 'Too many wrong codes. Please sign in again.'

export async function findAdminByIdentifier(
  identifier: string
): Promise<AdminRow | undefined> {
  if (!db) return undefined
  const clean = identifier.trim()
  const rows = await db
    .select()
    .from(schema.user)
    .where(
      or(
        ilike(schema.user.email, clean),
        ilike(schema.user.staffId, clean)
      )
    )
    .limit(1)
  return rows[0]
}

export async function isAdminSmsCheckEnabled(): Promise<boolean> {
  if (!isLiveDatabase || !db) return true
  const rows = await db
    .select({ adminSmsCheck: schema.systemSettings.adminSmsCheck })
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.id, 'default-ashanti'))
    .limit(1)
  return rows[0]?.adminSmsCheck !== false
}

/** Create the 6-digit challenge and send the SMS. Caller must already have verified the password. */
export async function issueSmsChallenge(user: AdminRow): Promise<
  | { ok: true }
  | { ok: false; error: string }
> {
  if (!db) return { ok: false, error: 'Database not connected' }
  const phone = (user.phone || '').trim()
  if (!phone) {
    return {
      ok: false,
      error: 'No phone number on file for this account. Ask HQ to add one first.',
    }
  }

  // 60-second cooldown — same person can't spam SMS sends
  const recent = await db
    .select({ id: schema.smsCodes.id, createdAt: schema.smsCodes.createdAt })
    .from(schema.smsCodes)
    .where(eq(schema.smsCodes.userId, user.id))
    .orderBy(desc(schema.smsCodes.createdAt))
    .limit(1)
  if (recent[0] && Date.now() - new Date(recent[0].createdAt).getTime() < 60_000) {
    return { ok: false, error: 'A code was already sent. Check your phone or try again in a minute.' }
  }

  const code = generateCode()
  const codeHash = hashSmsCode(code)
  const now = Date.now()

  // Clean up older outstanding codes for this user
  await db
    .update(schema.smsCodes)
    .set({ usedAt: new Date(now) })
    .where(eq(schema.smsCodes.userId, user.id))

  await db.insert(schema.smsCodes).values({
    id: `smsc-${now}-${Math.random().toString(36).slice(2, 7)}`,
    userId: user.id,
    purpose: 'admin_login',
    codeHash,
    phone,
    attempts: 0,
    expiresAt: new Date(now + 5 * 60 * 1000),
    createdAt: new Date(now),
  })

  const sent = await sendSms(phone, smsCodeMessage(code))
  if (!sent.ok) {
    return {
      ok: false,
      error: 'Couldn’t send the SMS code. Try again later or ask HQ for help.',
    }
  }

  await recordAuditLog({
    actorId: user.id,
    actorName: user.name,
    actorRole: user.role,
    action: 'SMS_CODE_SENT',
    entityType: 'users',
    entityId: user.id,
    details: { message: `${user.name} requested a sign-in code by SMS` },
  })

  return { ok: true }
}

/** Create the session + full user payload (used by both password-only and SMS-verified logins). */
export async function completeAdminLogin(
  request: Request,
  user: AdminRow,
  method: string
): Promise<NextResponse> {
  // recordLoginSuccess already done by caller
  const rawToken = await createSession(user.id, request as any)
  const userAgent = request.headers.get('user-agent') || ''
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'

  const normalizedRole = ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_COORD', 'SUPERVISOR'].includes(
    (user.role || '').toUpperCase()
  )
    ? 'ADMIN'
    : 'FIELD_OFFICER'

  // Detect new device
  const lastLogin = await db!
    .select({ createdAt: schema.auditLogs.createdAt, details: schema.auditLogs.details })
    .from(schema.auditLogs)
    .where(eq(schema.auditLogs.actorId, user.id))
    .orderBy(desc(schema.auditLogs.createdAt))
    .limit(1)
  const lastUa = (lastLogin[0]?.details as any)?.userAgent
  const isNewDevice = !lastUa || lastUa !== userAgent

  await recordAuditLog({
    actorId: user.id,
    actorName: user.name,
    actorRole: normalizedRole,
    action: 'ADMIN_LOGIN',
    entityType: 'users',
    entityId: user.id,
    details: {
      message: `${user.name} signed in to Command Console`,
      method,
      userAgent,
      ip,
      newDevice: isNewDevice,
    },
  })

  if (isNewDevice) {
    await recordSecurityEvent({
      action: 'NEW_DEVICE_SIGNIN',
      actorId: user.id,
      actorName: user.name,
      actorRole: normalizedRole,
      details: { userAgent, ip },
      ipAddress: ip,
      userAgent,
    })
  }

  const res = NextResponse.json({
    success: true,
    user: {
      id: user.id,
      staffId: user.staffId || 'WAEC-HQ-001',
      email: user.email,
      name: user.name,
      phone: user.phone || '',
      role: normalizedRole as 'ADMIN' | 'FIELD_OFFICER' | 'SUPER_ADMIN' | 'REGIONAL_COORD' | 'SUPERVISOR',
      status: user.status as 'ACTIVE' | 'REVOKED',
      region: 'Ashanti Region',
      group: 'HQ Command',
      isGroupLeader: true,
      assignedCenter: 'National Headquarters Command',
      assignedCenterCode: 'HQ-ACC-01',
      photo: user.image || '/images/waec-logo.jpg',
      bio: user.bio || '',
      mustChangePassword: Boolean(user.mustChangePassword),
    },
  })
  if (rawToken) setSessionCookie(res, rawToken)
  return res
}

/** Verify a 6-digit SMS code for this user. */
export async function verifySmsChallenge(
  request: Request,
  user: AdminRow,
  code: string
): Promise<{ ok: true; res: NextResponse } | { ok: false; status: number; error: string }> {
  if (!db) {
    return { ok: false, status: 500, error: 'Database not connected' }
  }

  const rows = await db
    .select()
    .from(schema.smsCodes)
    .where(eq(schema.smsCodes.userId, user.id))
    .orderBy(desc(schema.smsCodes.createdAt))
    .limit(1)

  const row = rows[0]
  const now = Date.now()

  if (!row || row.usedAt) {
    return { ok: false, status: 401, error: SMS_GENERIC_ERROR }
  }
  if (new Date(row.expiresAt).getTime() < now) {
    return { ok: false, status: 401, error: SMS_EXPIRED_ERROR }
  }
  if (row.attempts >= 3) {
    await db
      .update(schema.smsCodes)
      .set({ usedAt: new Date(now) })
      .where(eq(schema.smsCodes.id, row.id))
    return { ok: false, status: 429, error: SMS_TOO_MANY_TRIES }
  }

  const matches = hashSmsCode(code) === row.codeHash

  if (!matches) {
    const attempts = row.attempts + 1
    await db
      .update(schema.smsCodes)
      .set({ attempts })
      .where(eq(schema.smsCodes.id, row.id))
    if (attempts >= 3) {
      await db
        .update(schema.smsCodes)
        .set({ usedAt: new Date(now) })
        .where(eq(schema.smsCodes.id, row.id))
      return { ok: false, status: 429, error: SMS_TOO_MANY_TRIES }
    }
    return {
      ok: false,
      status: 401,
      error: `The code we sent is not right. ${3 - attempts} ${3 - attempts === 1 ? 'try' : 'tries'} left.`,
    }
  }

  // Code good — burn it, reset lockout, create session
  await db
    .update(schema.smsCodes)
    .set({ usedAt: new Date(now) })
    .where(eq(schema.smsCodes.id, row.id))

  await recordLoginSuccess(user.id)
  const res = await completeAdminLogin(request, user, 'password+sms')
  return { ok: true, res }
}

/** Find admin by email/staffId and verify password — used by login route. */
export async function verifyAdminCredentials(
  identifier: string,
  password: string
): Promise<
  | { ok: true; user: AdminRow }
  | { ok: false; status: number; error: string }
> {
  const user = await findAdminByIdentifier(identifier)
  if (!user) {
    // Dummy verify to keep timing similar
    verifyPassword(password, '$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA$+AAAAAAAA')
    await recordLoginFailure(undefined, undefined, undefined)
    return { ok: false, status: 401, error: 'The phone number or PIN is not right.' }
  }

  const locked = await checkLockout(user.id)
  if (locked) {
    return { ok: false, status: 429, error: 'Too many wrong tries. Please take a short break and try again.' }
  }

  if (user.status !== 'ACTIVE') {
    await recordLoginFailure(user.id)
    return { ok: false, status: 401, error: 'The phone number or PIN is not right.' }
  }

  if (!verifyPassword(password, user.passwordHash)) {
    // Also check better-auth credential account if present
    const accounts = await db!
      .select({ password: schema.account.password })
      .from(schema.account)
      .where(eq(schema.account.userId, user.id))
    const ok = accounts.some((a) => verifyPassword(password, a.password))
    if (!ok) {
      await recordLoginFailure(user.id)
      return { ok: false, status: 401, error: 'The phone number or PIN is not right.' }
    }
  }

  return { ok: true, user }
}
