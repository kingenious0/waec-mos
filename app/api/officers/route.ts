import { NextResponse } from 'next/server'
import { store } from '@/lib/db'

export async function GET() {
  const officers = store.getFieldOfficers()
  return NextResponse.json({ officers })
}

export async function POST(request: Request) {
  try {
    const data = await request.json()
    const {
      name,
      staffId,
      email,
      phone,
      pin,
      group,
      isGroupLeader,
      region,
      assignedCenter,
      assignedCenterCode,
      password,
    } = data

    if (!name || !phone || !assignedCenter) {
      return NextResponse.json({ error: 'Name, Phone number, and Assigned Center are required' }, { status: 400 })
    }

    // Check unique phone number or staff ID
    const existingPhone = store.findOfficerByPhone(phone)
    if (existingPhone) {
      return NextResponse.json({ error: 'An officer with this phone number is already provisioned.' }, { status: 409 })
    }

    const effectiveStaffId = staffId || 'WAEC-GH-' + Math.floor(1000 + Math.random() * 9000)
    const effectiveEmail = email || `${name.toLowerCase().replace(/\s+/g, '')}@waec.org`
    const effectivePin = (pin && String(pin).padStart(4, '0')) || Math.floor(1000 + Math.random() * 9000).toString()

    const created = store.createUser({
      name,
      staffId: effectiveStaffId,
      email: effectiveEmail,
      phone: phone.trim(),
      pin: effectivePin,
      role: 'FIELD_OFFICER',
      status: 'ACTIVE',
      region: region || 'Ashanti Region',
      group: group || 'Group 1',
      isGroupLeader: Boolean(isGroupLeader),
      assignedCenter,
      assignedCenterCode: assignedCenterCode || '05' + Math.floor(1000 + Math.random() * 9000),
      passwordHash: password || 'Waec@' + Math.floor(1000 + Math.random() * 9000),
      photo: '',
    })

    return NextResponse.json({ success: true, officer: created }, { status: 201 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to provision field officer' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, action, status, newPassword, newPin, dutyStatus } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    if (action === 'TOGGLE_STATUS' && status) {
      const updated = store.updateUserStatus(id, status)
      return NextResponse.json({ success: true, officer: updated })
    }

    if (action === 'RESET_PASSWORD' && newPassword) {
      const updated = store.resetUserPassword(id, newPassword)
      return NextResponse.json({ success: true, officer: updated })
    }

    if (action === 'RESET_PIN' && newPin) {
      const user = store.findUser(id)
      if (user) {
        user.pin = String(newPin).trim()
        return NextResponse.json({ success: true, officer: user })
      }
    }

    if (action === 'TOGGLE_DUTY' && dutyStatus) {
      const updated = store.toggleDutyStatus(id, dutyStatus)
      return NextResponse.json({ success: true, officer: updated })
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update field officer' }, { status: 500 })
  }
}
