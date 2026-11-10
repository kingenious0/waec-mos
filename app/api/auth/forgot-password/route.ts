import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { recordAuditLog } from '@/lib/db/audit'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const cleanIdentifier = String(body.identifier || '').trim()

    if (!cleanIdentifier) {
      return NextResponse.json(
        { error: 'Please enter your registered phone number, email, or Staff ID.' },
        { status: 400 }
      )
    }

    if (isLiveDatabase && db) {
      const digits = cleanIdentifier.replace(/\D/g, '')
      const last9 = digits.length >= 9 ? digits.slice(-9) : digits
      const lower = cleanIdentifier.toLowerCase()

      const users = await db
        .select({
          id: schema.user.id,
          name: schema.user.name,
          email: schema.user.email,
          phone: schema.user.phone,
          staffId: schema.user.staffId,
          role: schema.user.role,
          status: schema.user.status,
        })
        .from(schema.user)

      const matched = users.find((u) => {
        if (u.email && u.email.toLowerCase() === lower) return true
        if (u.staffId && u.staffId.toLowerCase() === lower) return true
        if (last9 && u.phone) {
          const uDigits = u.phone.replace(/\D/g, '')
          const uLast9 = uDigits.length >= 9 ? uDigits.slice(-9) : uDigits
          return uLast9 === last9
        }
        return false
      })

      if (matched) {
        await recordAuditLog({
          actorId: matched.id,
          actorName: matched.name,
          actorRole: matched.role,
          action: 'PIN_RESET_REQUESTED',
          entityType: 'users',
          entityId: matched.id,
          details: {
            message: `${matched.name} (${matched.staffId || matched.phone || matched.email}) submitted a PIN/password recovery request`,
            identifier: cleanIdentifier,
          },
        })
      }
    }

    return NextResponse.json({
      success: true,
      message:
        'If this identifier matches an accredited officer or administrator, your recovery request has been logged for regional HQ review.',
    })
  } catch (error) {
    console.error('Failed to log forgot-password request:', error)
    return NextResponse.json(
      { error: 'Unable to submit recovery request right now.' },
      { status: 500 }
    )
  }
}

