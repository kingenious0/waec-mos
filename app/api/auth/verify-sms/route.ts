import { NextRequest, NextResponse } from 'next/server'
import { findAdminByIdentifier, isAdminSmsCheckEnabled, verifySmsChallenge } from '@/lib/auth/admin-2fa'
import { hitRateLimit, requestIp } from '@/lib/auth/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const ip = requestIp(request)
    const limit = await hitRateLimit(`verify-sms:${ip}`, 10)
    if (limit.limited) {
      return NextResponse.json(
        { error: 'Too many requests. Try again in a few minutes.' },
        { status: 429 }
      )
    }

    if (!(await isAdminSmsCheckEnabled())) {
      return NextResponse.json({ error: 'SMS verification is not required.' }, { status: 400 })
    }

    const body = await request.json()
    const identifier = String(body.identifier || '').trim()
    const code = String(body.code || '').trim()

    if (!identifier || !code) {
      return NextResponse.json({ error: 'Identifier and code are required.' }, { status: 400 })
    }

    const user = await findAdminByIdentifier(identifier)
    if (!user) {
      return NextResponse.json({ error: 'The code we sent is not right.' }, { status: 401 })
    }

    const result = await verifySmsChallenge(request, user, code)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return result.res
  } catch (error) {
    console.error('Verify SMS error:', error)
    return NextResponse.json(
      { error: 'Something went wrong on our side. Try again.' },
      { status: 500 }
    )
  }
}
