import { NextResponse } from 'next/server'
import { db, isLiveDatabase, store, UserAccount } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { eq, or } from 'drizzle-orm'

export async function GET() {
  try {
    if (isLiveDatabase && db) {
      // Query field officers from Neon DB
      const users = await db
        .select({
          id: schema.user.id,
          name: schema.user.name,
          email: schema.user.email,
          phone: schema.user.phone,
          staffId: schema.user.staffId,
          role: schema.user.role,
          status: schema.user.status,
          regionId: schema.user.regionId,
          mustChangePassword: schema.user.mustChangePassword,
          lastLoginAt: schema.user.lastLoginAt,
          assignmentId: schema.assignments.id,
          assignmentStatus: schema.assignments.status,
          checkInTime: schema.assignments.checkInTime,
          centerName: schema.examinationCenters.centerName,
          centerCode: schema.examinationCenters.centerCode,
        })
        .from(schema.user)
        .leftJoin(schema.assignments, eq(schema.user.id, schema.assignments.officerId))
        .leftJoin(schema.examinationCenters, eq(schema.assignments.centerId, schema.examinationCenters.id))
        .where(eq(schema.user.role, 'FIELD_OFFICER'))

      const officers: UserAccount[] = users.map((u, idx) => ({
        id: u.id,
        staffId: u.staffId || `WAEC-ASH-${1000 + idx}`,
        email: u.email,
        name: u.name,
        phone: u.phone || '+233 24 000 0000',
        pin: '1234',
        role: 'FIELD_OFFICER',
        status: (u.status as any) || 'ACTIVE',
        region: 'Ashanti Region',
        group: `Group ${Math.floor(idx / 2) + 1}`,
        isGroupLeader: idx % 2 === 0,
        assignedCenter: u.centerName || 'Prempeh College Center A',
        assignedCenterCode: u.centerCode || '050102',
        dutyStatus: u.assignmentStatus === 'ON_SITE' ? 'ON_DUTY' : 'OFF_DUTY',
        mustChangePassword: u.mustChangePassword ?? false,
        passwordHash: 'Field@123',
        lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '27 Oct 2026, 08:00 GMT',
        checkInTime: u.checkInTime ? new Date(u.checkInTime).toLocaleTimeString('en-GB') + ' GMT' : undefined,
      }))

      return NextResponse.json({ officers })
    }

    // In-memory fallback
    const officers = store.getFieldOfficers()
    return NextResponse.json({ officers })
  } catch (error) {
    console.error('Failed to fetch field officers from Neon:', error)
    return NextResponse.json({ officers: store.getFieldOfficers() })
  }
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

    const effectiveStaffId = staffId || 'WAEC-GH-' + Math.floor(1000 + Math.random() * 9000)
    const effectiveEmail = email || `${name.toLowerCase().replace(/\s+/g, '')}@waec.org`
    const effectivePin = (pin && String(pin).padStart(4, '0')) || Math.floor(1000 + Math.random() * 9000).toString()
    const newUserId = `usr-off-${Date.now()}`

    if (isLiveDatabase && db) {
      // 1. Check existing phone/email/staffId
      const existing = await db
        .select()
        .from(schema.user)
        .where(or(eq(schema.user.phone, phone.trim()), eq(schema.user.staffId, effectiveStaffId)))
        .limit(1)

      if (existing.length > 0) {
        return NextResponse.json({ error: 'An officer with this phone number or Staff ID already exists.' }, { status: 409 })
      }

      // 2. Insert into Neon user table
      await db.insert(schema.user).values({
        id: newUserId,
        name,
        email: effectiveEmail,
        staffId: effectiveStaffId,
        phone: phone.trim(),
        role: 'FIELD_OFFICER',
        status: 'ACTIVE',
        regionId: 'reg-ashanti',
        mustChangePassword: true,
      })

      // 3. Find center to create assignment
      const centers = await db
        .select()
        .from(schema.examinationCenters)
        .where(
          assignedCenterCode
            ? eq(schema.examinationCenters.centerCode, assignedCenterCode)
            : eq(schema.examinationCenters.centerName, assignedCenter)
        )
        .limit(1)

      const centerId = centers[0]?.id || 'cnt-050102'

      await db.insert(schema.assignments).values({
        id: `asg-${Date.now()}`,
        operationId: 'op-wassce-2026',
        centerId: centerId,
        officerId: newUserId,
        date: new Date().toISOString().split('T')[0],
        paperName: 'Core Mathematics Paper 1 & 2',
        startTime: '08:30 GMT',
        endTime: '12:00 GMT',
        status: 'PENDING',
      })
    }

    // Keep in-memory store in sync
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

    return NextResponse.json({ success: true, officer: { ...created, id: newUserId } }, { status: 201 })
  } catch (error) {
    console.error('Failed to provision field officer:', error)
    return NextResponse.json({ error: 'Failed to provision field officer' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const { id, action, status, newPassword, newPin, dutyStatus } = await request.json()

    if (!id) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    if (isLiveDatabase && db) {
      if (action === 'TOGGLE_STATUS' && status) {
        await db.update(schema.user).set({ status }).where(eq(schema.user.id, id))
      }
    }

    // Keep store in sync
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
    console.error('Failed to update field officer:', error)
    return NextResponse.json({ error: 'Failed to update field officer' }, { status: 500 })
  }
}
