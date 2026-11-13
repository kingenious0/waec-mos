import { NextResponse } from 'next/server'
import { db, isLiveDatabase, store } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { hitRateLimit, requestIp } from '@/lib/auth/rate-limit'
import { desc, eq } from 'drizzle-orm'

async function verifyOfficerByPhone(phone: string) {
  const digits = phone.trim().replace(/\D/g, '')
  if (!digits) {
    return { error: 'Please enter a valid phone number.', status: 400 }
  }
  const last9 = digits.length >= 9 ? digits.slice(-9) : digits

  if (isLiveDatabase && db) {
    const rows = await db
      .select({
        id: schema.user.id,
        name: schema.user.name,
        phone: schema.user.phone,
        staffId: schema.user.staffId,
        status: schema.user.status,
        groupName: schema.user.groupName,
        isGroupLeader: schema.user.isGroupLeader,
        regionName: schema.regions.name,
        centerName: schema.examinationCenters.centerName,
        centerCode: schema.examinationCenters.centerCode,
      })
      .from(schema.user)
      .leftJoin(schema.regions, eq(schema.user.regionId, schema.regions.id))
      .leftJoin(schema.assignments, eq(schema.user.id, schema.assignments.officerId))
      .leftJoin(schema.examinationCenters, eq(schema.assignments.centerId, schema.examinationCenters.id))
      .where(eq(schema.user.role, 'FIELD_OFFICER'))
      .orderBy(desc(schema.assignments.updatedAt))

    const found = rows.find((u) => {
      if (!u.phone) return false
      const uDigits = u.phone.replace(/\D/g, '')
      const uLast9 = uDigits.length >= 9 ? uDigits.slice(-9) : uDigits
      return uLast9 === last9
    })

    if (!found) {
      return {
        error: 'No deployment record was found for this phone number. Please contact your Zonal Coordinator or Regional Controller.',
        status: 404,
      }
    }

    // Minimal payload — never leak staff IDs or centre assignments to callers
    return {
      officer: {
        name: found.name,
        status: found.status || 'ACTIVE',
      },
    }
  }

  const foundStore = store.findOfficerByPhone(phone)
  if (!foundStore) {
    return {
      error: 'No deployment record was found for this phone number.',
      status: 404,
    }
  }

  return {
    officer: {
      name: foundStore.name,
      status: foundStore.status,
    },
  }
}

export async function POST(request: Request) {
  try {
    const ip = requestIp(request)
    const limit = await hitRateLimit(`verify:${ip}`, 10)
    if (limit.limited) {
      return NextResponse.json(
        { error: 'Too many requests. Try again in a few minutes.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const result = await verifyOfficerByPhone(String(body.phone || ''))
    if (result.error) {
      return NextResponse.json({ verified: false, error: result.error }, { status: result.status })
    }
    return NextResponse.json({ verified: true, officer: result.officer })
  } catch (error) {
    console.error('Roster verification error:', error)
    return NextResponse.json(
      { verified: false, error: 'Failed to connect to the WAEC central registry.' },
      { status: 500 }
    )
  }
}

export async function GET(request: Request) {
  try {
    const ip = requestIp(request)
    const limit = await hitRateLimit(`verify:${ip}`, 10)
    if (limit.limited) {
      return NextResponse.json(
        { error: 'Too many requests. Try again in a few minutes.' },
        { status: 429 }
      )
    }

    const { searchParams } = new URL(request.url)
    const phone = searchParams.get('phone') || ''
    const result = await verifyOfficerByPhone(phone)
    if (result.error) {
      return NextResponse.json({ verified: false, error: result.error }, { status: result.status })
    }
    return NextResponse.json({ verified: true, officer: result.officer })
  } catch (error) {
    console.error('Roster verification error:', error)
    return NextResponse.json(
      { verified: false, error: 'Failed to connect to the WAEC central registry.' },
      { status: 500 }
    )
  }
}

