import { NextRequest, NextResponse } from 'next/server'
import { db, isLiveDatabase, store } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { verifyPassword, dummyVerify } from '@/lib/auth/password'
import { verifyPin } from '@/lib/auth/pin'
import { recordAuditLog } from '@/lib/db/audit'
import {
  checkLockout,
  recordLoginFailure,
  recordLoginSuccess,
} from '@/lib/auth/lockout'
import { createSession, setSessionCookie } from '@/lib/auth/server-session'
import { desc, eq, ilike, or } from 'drizzle-orm'

const GENERIC_ERROR = 'Phone number or PIN is not right.'
const TOO_MANY = 'Too many tries. Take a short break and try again.'

function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for') || ''
  return forwarded.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown'
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { phone, pin, identifier, password } = body
    const ip = clientIp(request)
    const userAgent = request.headers.get('user-agent') || ''

    if (!isLiveDatabase || !db) {
      return NextResponse.json(
        { error: 'Sign-in is temporarily unavailable. Please try again later.' },
        { status: 503 }
      )
    }

    // ---------- FIELD OFFICER: phone + PIN ----------
    if (phone && pin) {
      const cleanPhone = String(phone).trim()
      const cleanPin = String(pin).trim()
      const digits = cleanPhone.replace(/\D/g, '')
      const last9 = digits.length >= 9 ? digits.slice(-9) : digits

      if (!digits) {
        return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
      }

      const rows = await db
        .select({
          id: schema.user.id,
          name: schema.user.name,
          email: schema.user.email,
          phone: schema.user.phone,
          pin: schema.user.pin,
          staffId: schema.user.staffId,
          role: schema.user.role,
          status: schema.user.status,
          image: schema.user.image,
          bio: schema.user.bio,
          groupName: schema.user.groupName,
          isGroupLeader: schema.user.isGroupLeader,
          regionName: schema.regions.name,
          centerName: schema.examinationCenters.centerName,
          centerCode: schema.examinationCenters.centerCode,
        })
        .from(schema.user)
        .leftJoin(schema.regions, eq(schema.user.regionId, schema.regions.id))
        .leftJoin(schema.assignments, eq(schema.assignments.officerId, schema.user.id))
        .leftJoin(schema.examinationCenters, eq(schema.assignments.centerId, schema.examinationCenters.id))
        .where(eq(schema.user.role, 'FIELD_OFFICER'))
        .orderBy(desc(schema.assignments.updatedAt))

      const matched = rows.find((u) => {
        const uDigits = (u.phone || '').replace(/\D/g, '')
        const uLast9 = uDigits.length >= 9 ? uDigits.slice(-9) : uDigits
        return uLast9 === last9
      })

      // One response for every failure — and equal hashing cost either way
      if (!matched) {
        dummyVerify(cleanPin)
        await recordLoginFailure(undefined, ip, digits)
        return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
      }

      if (await checkLockout(matched.id, ip)) {
        return NextResponse.json({ error: TOO_MANY }, { status: 429 })
      }

      if (matched.status !== 'ACTIVE' || !verifyPin(cleanPin, matched.pin)) {
        await recordLoginFailure(matched.id, ip, digits)
        return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
      }

      await recordLoginSuccess(matched.id, ip, digits)
      await db
        .update(schema.user)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.user.id, matched.id))

      // New device? (different user-agent than the last recorded sign-in)
      const lastLogin = await db
        .select({ createdAt: schema.auditLogs.createdAt, details: schema.auditLogs.details })
        .from(schema.auditLogs)
        .where(eq(schema.auditLogs.actorId, matched.id))
        .orderBy(desc(schema.auditLogs.createdAt))
        .limit(1)
      const lastUa = (lastLogin[0]?.details as any)?.userAgent

      await recordAuditLog({
        actorId: matched.id,
        actorName: matched.name,
        actorRole: 'FIELD_OFFICER',
        action: 'OFFICER_LOGIN',
        entityType: 'users',
        entityId: matched.id,
        details: {
          message: `${matched.name} signed in on the field portal`,
          centerName: matched.centerName || 'Unassigned',
          userAgent,
          ip,
        },
      })

      if (!lastUa || lastUa !== userAgent) {
        await recordAuditLog({
          actorId: matched.id,
          actorName: matched.name,
          actorRole: 'FIELD_OFFICER',
          action: 'NEW_DEVICE_SIGNIN',
          entityType: 'users',
          entityId: matched.id,
          details: {
            message: `${matched.name} signed in on a new device`,
            userAgent,
            ip,
          },
        })
      }

      const rawToken = await createSession(matched.id, request)
      const res = NextResponse.json({
        success: true,
        user: {
          id: matched.id,
          staffId: matched.staffId || 'WAEC-GH-0000',
          email: matched.email,
          name: matched.name,
          phone: matched.phone,
          role: 'FIELD_OFFICER',
          status: matched.status,
          region: matched.regionName || 'Ashanti Region',
          group: matched.groupName || 'Group 1',
          isGroupLeader: Boolean(matched.isGroupLeader),
          assignedCenter: matched.centerName || 'Unassigned',
          assignedCenterCode: matched.centerCode || '',
          photo: matched.image || '',
          bio: matched.bio || '',
          mustChangePassword: false,
        },
      })
      if (rawToken) setSessionCookie(res, rawToken)
      return res
    }

    // ---------- HQ ADMIN: identifier + password ----------
    if (identifier && password) {
      const cleanIdentifier = String(identifier).trim()

      const users = await db
        .select({
          id: schema.user.id,
          name: schema.user.name,
          email: schema.user.email,
          phone: schema.user.phone,
          staffId: schema.user.staffId,
          role: schema.user.role,
          status: schema.user.status,
          image: schema.user.image,
          bio: schema.user.bio,
          passwordHash: schema.user.passwordHash,
          mustChangePassword: schema.user.mustChangePassword,
          regionName: schema.regions.name,
        })
        .from(schema.user)
        .leftJoin(schema.regions, eq(schema.user.regionId, schema.regions.id))
        .where(
          or(
            ilike(schema.user.email, cleanIdentifier),
            ilike(schema.user.staffId, cleanIdentifier)
          )
        )
        .limit(1)

      if (users.length === 0) {
        dummyVerify(password)
        await recordLoginFailure(undefined, ip)
        return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
      }

      const dbUser = users[0]

      if (await checkLockout(dbUser.id, ip)) {
        return NextResponse.json({ error: TOO_MANY }, { status: 429 })
      }

      if (dbUser.status !== 'ACTIVE') {
        await recordLoginFailure(dbUser.id, ip)
        return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
      }

      let passwordValid = verifyPassword(password, dbUser.passwordHash)

      if (!passwordValid) {
        const accounts = await db
          .select({ password: schema.account.password })
          .from(schema.account)
          .where(eq(schema.account.userId, dbUser.id))
        passwordValid = accounts.some((acc) => verifyPassword(password, acc.password))
      }

      if (!passwordValid) {
        await recordLoginFailure(dbUser.id, ip)
        return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 })
      }

      const normalizedRole = ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_COORD', 'SUPERVISOR'].includes(
        (dbUser.role || '').toUpperCase()
      )
        ? 'ADMIN'
        : 'FIELD_OFFICER'

      await recordLoginSuccess(dbUser.id, ip)
      await db
        .update(schema.user)
        .set({ lastLoginAt: new Date(), updatedAt: new Date() })
        .where(eq(schema.user.id, dbUser.id))

      const lastLogin = await db
        .select({ createdAt: schema.auditLogs.createdAt, details: schema.auditLogs.details })
        .from(schema.auditLogs)
        .where(eq(schema.auditLogs.actorId, dbUser.id))
        .orderBy(desc(schema.auditLogs.createdAt))
        .limit(1)
      const lastUa = (lastLogin[0]?.details as any)?.userAgent

      await recordAuditLog({
        actorId: dbUser.id,
        actorName: dbUser.name,
        actorRole: normalizedRole,
        action: 'ADMIN_LOGIN',
        entityType: 'users',
        entityId: dbUser.id,
        details: {
          message: `${dbUser.name} signed in to Command Console`,
          userAgent,
          ip,
        },
      })

      if (!lastUa || lastUa !== userAgent) {
        await recordAuditLog({
          actorId: dbUser.id,
          actorName: dbUser.name,
          actorRole: normalizedRole,
          action: 'NEW_DEVICE_SIGNIN',
          entityType: 'users',
          entityId: dbUser.id,
          details: {
            message: `${dbUser.name} signed in on a new device`,
            userAgent,
            ip,
          },
        })
      }

      const rawToken = await createSession(dbUser.id, request)
      const res = NextResponse.json({
        success: true,
        user: {
          id: dbUser.id,
          staffId: dbUser.staffId || 'WAEC-HQ-001',
          email: dbUser.email,
          name: dbUser.name,
          phone: dbUser.phone || '',
          role: normalizedRole,
          status: dbUser.status,
          region: dbUser.regionName || 'Ashanti Region',
          group: 'HQ Command',
          isGroupLeader: true,
          assignedCenter: 'National Headquarters Command',
          assignedCenterCode: 'HQ-ACC-01',
          photo: dbUser.image || '/images/waec-logo.jpg',
          bio: dbUser.bio || '',
          mustChangePassword: Boolean(dbUser.mustChangePassword),
        },
      })
      if (rawToken) setSessionCookie(res, rawToken)
      return res
    }

    return NextResponse.json(
      { error: 'Please provide either (Phone + 4-digit PIN) or (Staff ID/Email + Password).' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Something went wrong on our side. Try again.' },
      { status: 500 }
    )
  }
}
