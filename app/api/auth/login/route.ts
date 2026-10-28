import { NextResponse } from 'next/server'
import { store } from '@/lib/db'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { phone, pin, identifier, password, mode } = body

    let user = null

    // Mode 1: Field Officer Phone + 4-digit PIN Auth (Pillar 1 Specification)
    if (phone && pin) {
      user = store.findOfficerByPhoneAndPin(phone, pin)

      if (!user) {
        // Check if phone exists but pin is wrong
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
    } 
    // Mode 2: Standard/Admin identifier + password
    else if (identifier && password) {
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

    if (user.status === 'REVOKED') {
      return NextResponse.json(
        { error: 'Access REVOKED by WAEC National Operations Command. Contact HQ Administration.' },
        { status: 403 }
      )
    }

    user.lastLoginAt = new Date().toLocaleTimeString('en-GB') + ' GMT'

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        staffId: user.staffId,
        email: user.email,
        name: user.name,
        phone: user.phone,
        pin: user.pin,
        role: user.role,
        status: user.status,
        region: user.region || 'Ashanti Region',
        group: user.group || 'Group 1',
        isGroupLeader: user.isGroupLeader || false,
        assignedCenter: user.assignedCenter,
        assignedCenterCode: user.assignedCenterCode,
        photo: user.photo || '',
        mustChangePassword: user.mustChangePassword,
      },
    })
  } catch (error: any) {
    console.error('Login error:', error)
    return NextResponse.json({ error: error?.message || 'Internal authentication error' }, { status: 500 })
  }
}
