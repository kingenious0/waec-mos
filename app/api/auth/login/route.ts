import { NextResponse } from 'next/server'
import { db, isLiveDatabase, store } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { verifyPassword } from '@/lib/auth/password'
import { verifyPin } from '@/lib/auth/pin'
import { recordAuditLog } from '@/lib/db/audit'
import { desc, eq, ilike, or } from 'drizzle-orm'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone, pin, identifier, password } = body

    let user: any = null

    // 1. Live Neon PostgreSQL authentication
    if (isLiveDatabase && db) {
      if (phone && pin) {
        const cleanPhone = String(phone).trim()
        const cleanPin = String(pin).trim()
        const digits = cleanPhone.replace(/\D/g, '')
        const last9 = digits.length >= 9 ? digits.slice(-9) : digits

        if (!digits) {
          return NextResponse.json(
            { error: 'Please enter a valid registered phone number.' },
            { status: 400 }
          )
        }

        const rows = await db
          .select({
            id: schema.user.id,
            name: schema.user.name,
            email: schema.user.email,
            phone: schema.user.phone,
            pin: schema.user.pin,
            groupName: schema.user.groupName,
            isGroupLeader: schema.user.isGroupLeader,
            staffId: schema.user.staffId,
            role: schema.user.role,
            status: schema.user.status,
            image: schema.user.image,
            bio: schema.user.bio,
            regionName: schema.regions.name,
            centerName: schema.examinationCenters.centerName,
            centerCode: schema.examinationCenters.centerCode,
            assignmentUpdatedAt: schema.assignments.updatedAt,
          })
          .from(schema.user)
          .leftJoin(schema.regions, eq(schema.user.regionId, schema.regions.id))
          .leftJoin(schema.assignments, eq(schema.user.id, schema.assignments.officerId))
          .leftJoin(schema.examinationCenters, eq(schema.assignments.centerId, schema.examinationCenters.id))
          .where(eq(schema.user.role, 'FIELD_OFFICER'))
          .orderBy(desc(schema.assignments.updatedAt))

        const matched = rows.find((u) => {
          if (!u.phone) return false
          const uDigits = u.phone.replace(/\D/g, '')
          const uLast9 = uDigits.length >= 9 ? uDigits.slice(-9) : uDigits
          return uLast9 === last9
        })

        if (!matched) {
          return NextResponse.json(
            { error: 'Unrecognized phone number. Closed Registry: Field Officers must be pre-provisioned by WAEC HQ.' },
            { status: 401 }
          )
        }

        if (matched.status === 'REVOKED' || matched.status === 'SUSPENDED' || matched.status === 'ARCHIVED') {
          return NextResponse.json(
            { error: 'Access REVOKED by WAEC National Operations Command. Contact HQ Administration.' },
            { status: 403 }
          )
        }

        if (!matched.pin || !verifyPin(cleanPin, matched.pin)) {
          return NextResponse.json(
            { error: 'Incorrect 4-digit PIN. Please verify your confidential passkey.' },
            { status: 401 }
          )
        }

        // Update lastLoginAt in Neon DB
        await db
          .update(schema.user)
          .set({ lastLoginAt: new Date(), updatedAt: new Date() })
          .where(eq(schema.user.id, matched.id))

        await recordAuditLog({
          actorId: matched.id,
          actorName: matched.name,
          actorRole: 'FIELD_OFFICER',
          action: 'OFFICER_LOGIN',
          entityType: 'users',
          entityId: matched.id,
          details: {
            message: `${matched.name} authenticated on Field Portal`,
            centerName: matched.centerName || 'Unassigned',
          },
        })

        user = {
          id: matched.id,
          staffId: matched.staffId || 'WAEC-GH-0000',
          email: matched.email,
          name: matched.name,
          phone: matched.phone,
          pin: '',
          role: 'FIELD_OFFICER',
          status: matched.status || 'ACTIVE',
          region: matched.regionName || 'Ashanti Region',
          group: matched.groupName || 'Group 1',
          isGroupLeader: Boolean(matched.isGroupLeader),
          assignedCenter: matched.centerName || 'Unassigned',
          assignedCenterCode: matched.centerCode || '',
          photo: matched.image || '',
          bio: matched.bio || '',
          // Field Officers sign in via 4-digit PIN issued by HQ rather than an 8-char password
          mustChangePassword: false,
        }
      } else if (identifier && password) {
        const cleanIdentifier = String(identifier).trim()

        const users = await db
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
            passwordHash: schema.user.passwordHash,
            mustChangePassword: schema.user.mustChangePassword,
            regionName: schema.regions.name,
          })
          .from(schema.user)
          .leftJoin(schema.regions, eq(schema.user.regionId, schema.regions.id))
          .where(or(
            ilike(schema.user.email, cleanIdentifier),
            ilike(schema.user.staffId, cleanIdentifier)
          ))
          .limit(1)

        if (users.length === 0) {
          return NextResponse.json(
            { error: 'Invalid credentials. Please verify your Staff ID or Council email and password.' },
            { status: 401 }
          )
        }

        const dbUser = users[0]

        if (dbUser.status === 'REVOKED' || dbUser.status === 'SUSPENDED' || dbUser.status === 'ARCHIVED') {
          return NextResponse.json(
            { error: 'Access REVOKED by WAEC National Operations Command. Contact HQ Administration.' },
            { status: 403 }
          )
        }

        let passwordValid = verifyPassword(password, dbUser.passwordHash)

        // Also check Better Auth credential account table if passwordHash was not set on user directly
        if (!passwordValid) {
          const accounts = await db
            .select({ password: schema.account.password })
            .from(schema.account)
            .where(eq(schema.account.userId, dbUser.id))
          passwordValid = accounts.some((acc) => verifyPassword(password, acc.password))
        }

        if (!passwordValid) {
          return NextResponse.json(
            { error: 'Invalid password. Please check your credentials.' },
            { status: 401 }
          )
        }

        await db
          .update(schema.user)
          .set({ lastLoginAt: new Date(), updatedAt: new Date() })
          .where(eq(schema.user.id, dbUser.id))

        const normalizedRole = ['SUPER_ADMIN', 'ADMIN', 'REGIONAL_COORD', 'SUPERVISOR'].includes(
          (dbUser.role || '').toUpperCase()
        )
          ? 'ADMIN'
          : 'FIELD_OFFICER'

        await recordAuditLog({
          actorId: dbUser.id,
          actorName: dbUser.name,
          actorRole: normalizedRole,
          action: 'ADMIN_LOGIN',
          entityType: 'users',
          entityId: dbUser.id,
          details: {
            message: `${dbUser.name} signed in to Command Console`,
          },
        })

        user = {
          id: dbUser.id,
          staffId: dbUser.staffId || 'WAEC-HQ-001',
          email: dbUser.email,
          name: dbUser.name,
          phone: dbUser.phone || '',
          pin: '',
          role: normalizedRole,
          status: dbUser.status || 'ACTIVE',
          region: dbUser.regionName || 'Ashanti Region',
          group: 'HQ Command',
          isGroupLeader: true,
          assignedCenter: 'National Headquarters Command',
          assignedCenterCode: 'HQ-ACC-01',
          photo: dbUser.image || '/images/waec-logo.jpg',
          bio: dbUser.bio || '',
          mustChangePassword: Boolean(dbUser.mustChangePassword),
        }
      } else {
        return NextResponse.json(
          { error: 'Please provide either (Phone + 4-digit PIN) or (Staff ID/Email + Password).' },
          { status: 400 }
        )
      }
    } else {
      // Offline / no DATABASE_URL fallback using in-memory store
      if (phone && pin) {
        user = store.findOfficerByPhoneAndPin(phone, pin)
        if (!user) {
          const phoneExists = store.findOfficerByPhone(phone)
          if (phoneExists) {
            return NextResponse.json(
              { error: 'Incorrect 4-digit PIN. Please verify your confidential passkey.' },
              { status: 401 }
            )
          }
          return NextResponse.json(
            { error: 'Unrecognized phone number. Closed Registry: Field Officers must be pre-provisioned by WAEC HQ.' },
            { status: 401 }
          )
        }
      } else if (identifier && password) {
        user = store.findUser(identifier)
        if (!user) {
          return NextResponse.json(
            { error: 'Invalid credentials. Please verify your Staff ID/Email and password.' },
            { status: 401 }
          )
        }
        if (user.passwordHash !== password) {
          return NextResponse.json(
            { error: 'Invalid password. Please check your credentials.' },
            { status: 401 }
          )
        }
      } else {
        return NextResponse.json(
          { error: 'Please provide either (Phone + 4-digit PIN) or (Staff ID + Password).' },
          { status: 400 }
        )
      }
    }

    if (!user) {
      return NextResponse.json({ error: 'Authentication failed.' }, { status: 401 })
    }

    if (user.status === 'REVOKED') {
      return NextResponse.json(
        { error: 'Access REVOKED by WAEC National Operations Command. Contact HQ Administration.' },
        { status: 403 }
      )
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        staffId: user.staffId,
        email: user.email,
        name: user.name,
        phone: user.phone,
        pin: '',
        role: user.role,
        status: user.status,
        region: user.region || 'Ashanti Region',
        group: user.group || 'Group 1',
        isGroupLeader: Boolean(user.isGroupLeader),
        assignedCenter: user.assignedCenter,
        assignedCenterCode: user.assignedCenterCode,
        photo: user.photo || '',
        bio: user.bio || '',
        mustChangePassword: Boolean(user.mustChangePassword),
      },
    })
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json({ error: error?.message || 'Internal authentication error' }, { status: 500 })
  }
}
