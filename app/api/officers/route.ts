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
          pin: schema.user.pin,
          groupName: schema.user.groupName,
          isGroupLeader: schema.user.isGroupLeader,
          staffId: schema.user.staffId,
          role: schema.user.role,
          status: schema.user.status,
          image: schema.user.image,
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
        pin: u.pin || '1234',
        role: 'FIELD_OFFICER',
        status: (u.status as any) || 'ACTIVE',
        region: 'Ashanti Region',
        group: u.groupName || 'Group 1',
        isGroupLeader: Boolean(u.isGroupLeader),
        assignedCenter: u.centerName || 'Prempeh College Center A',
        assignedCenterCode: u.centerCode || '050102',
        dutyStatus: u.assignmentStatus === 'ON_SITE' ? 'ON_DUTY' : 'OFF_DUTY',
        mustChangePassword: u.mustChangePassword ?? false,
        passwordHash: 'Field@123',
        photo: u.image || '',
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

      // 2. Insert into Neon user table with pin, groupName, and isGroupLeader
      await db.insert(schema.user).values({
        id: newUserId,
        name,
        email: effectiveEmail,
        staffId: effectiveStaffId,
        phone: phone.trim(),
        pin: effectivePin,
        groupName: group || 'Group 1',
        isGroupLeader: Boolean(isGroupLeader),
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

// Shared update handler for PUT and PATCH
async function updateOfficerRecord(body: any) {
  const {
    id,
    action,
    status,
    newStatus,
    pin,
    newPin,
    name,
    email,
    phone,
    group,
    groupName,
    isGroupLeader,
    assignedCenter,
    assignedCenterCode,
    photo,
    image,
    dutyStatus,
  } = body

  if (!id) {
    return { error: 'User ID is required', status: 400 }
  }

  const effectiveStatus = status || newStatus || (action === 'TOGGLE_STATUS' ? body.status : undefined)
  const effectivePin = pin || newPin || (action === 'RESET_PIN' ? body.newPin : undefined)
  const effectiveGroup = groupName || group
  const effectivePhoto = photo || image

  const userUpdates: Record<string, any> = { updatedAt: new Date() }
  if (effectiveStatus !== undefined) userUpdates.status = effectiveStatus
  if (effectivePin !== undefined) userUpdates.pin = String(effectivePin).trim()
  if (name !== undefined) userUpdates.name = name.trim()
  if (email !== undefined) userUpdates.email = email.trim()
  if (phone !== undefined) userUpdates.phone = phone.trim()
  if (effectiveGroup !== undefined) userUpdates.groupName = effectiveGroup
  if (isGroupLeader !== undefined) userUpdates.isGroupLeader = Boolean(isGroupLeader)
  if (effectivePhoto !== undefined) userUpdates.image = effectivePhoto

  if (isLiveDatabase && db) {
    // 1. Update user row if there are user fields
    if (Object.keys(userUpdates).length > 1) {
      await db.update(schema.user).set(userUpdates).where(eq(schema.user.id, id))
    }

    // 2. If assigned center changed, update assignments table
    if (assignedCenter || assignedCenterCode) {
      const center = await db
        .select()
        .from(schema.examinationCenters)
        .where(
          assignedCenterCode
            ? eq(schema.examinationCenters.centerCode, assignedCenterCode)
            : eq(schema.examinationCenters.centerName, assignedCenter)
        )
        .limit(1)

      if (center.length > 0) {
        const centerId = center[0].id
        const existingAsg = await db
          .select()
          .from(schema.assignments)
          .where(eq(schema.assignments.officerId, id))
          .limit(1)

        if (existingAsg.length > 0) {
          await db
            .update(schema.assignments)
            .set({ centerId, updatedAt: new Date() })
            .where(eq(schema.assignments.id, existingAsg[0].id))
        } else {
          await db.insert(schema.assignments).values({
            id: `asg-${Date.now()}`,
            operationId: 'op-wassce-2026',
            centerId,
            officerId: id,
            date: new Date().toISOString().split('T')[0],
            paperName: 'Core Mathematics Paper 1 & 2',
            startTime: '08:30 GMT',
            endTime: '12:00 GMT',
            status: 'PENDING',
          })
        }
      }
    }
  }

  // Keep in-memory store in sync
  const storeUpdates: Partial<UserAccount> = {}
  if (effectiveStatus !== undefined) storeUpdates.status = effectiveStatus as any
  if (effectivePin !== undefined) storeUpdates.pin = String(effectivePin).trim()
  if (name !== undefined) storeUpdates.name = name.trim()
  if (email !== undefined) storeUpdates.email = email.trim()
  if (phone !== undefined) storeUpdates.phone = phone.trim()
  if (effectiveGroup !== undefined) storeUpdates.group = effectiveGroup
  if (isGroupLeader !== undefined) storeUpdates.isGroupLeader = Boolean(isGroupLeader)
  if (assignedCenter !== undefined) storeUpdates.assignedCenter = assignedCenter
  if (assignedCenterCode !== undefined) storeUpdates.assignedCenterCode = assignedCenterCode
  if (dutyStatus !== undefined) storeUpdates.dutyStatus = dutyStatus as any

  const updatedStoreOfficer = store.updateUser(id, storeUpdates)

  return { success: true, officer: updatedStoreOfficer }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const result = await updateOfficerRecord(body)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ success: true, officer: result.officer })
  } catch (error) {
    console.error('Failed to update officer (PUT):', error)
    return NextResponse.json({ error: 'Failed to update field officer' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const result = await updateOfficerRecord(body)
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }
    return NextResponse.json({ success: true, officer: result.officer })
  } catch (error) {
    console.error('Failed to update officer (PATCH):', error)
    return NextResponse.json({ error: 'Failed to update field officer' }, { status: 500 })
  }
}
