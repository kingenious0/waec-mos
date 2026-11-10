import { NextResponse } from 'next/server'
import { db, isLiveDatabase, store, UserAccount } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { recordAuditLog } from '@/lib/db/audit'
import { desc, eq, or } from 'drizzle-orm'

export async function GET() {
  try {
    if (isLiveDatabase && db) {
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
          mustChangePassword: schema.user.mustChangePassword,
          lastLoginAt: schema.user.lastLoginAt,
          assignmentId: schema.assignments.id,
          assignmentStatus: schema.assignments.status,
          checkInTime: schema.assignments.checkInTime,
          centerName: schema.examinationCenters.centerName,
          centerCode: schema.examinationCenters.centerCode,
        })
        .from(schema.user)
        .leftJoin(schema.regions, eq(schema.user.regionId, schema.regions.id))
        .leftJoin(schema.assignments, eq(schema.user.id, schema.assignments.officerId))
        .leftJoin(schema.examinationCenters, eq(schema.assignments.centerId, schema.examinationCenters.id))
        .where(eq(schema.user.role, 'FIELD_OFFICER'))
        .orderBy(desc(schema.assignments.updatedAt))

      // Deduplicate by officer id (keeping latest assignment)
      const seen = new Set<string>()
      const officers: UserAccount[] = []

      for (const u of rows) {
        if (seen.has(u.id)) continue
        seen.add(u.id)

        officers.push({
          id: u.id,
          staffId: u.staffId || 'WAEC-GH-0000',
          email: u.email,
          name: u.name,
          phone: u.phone || '',
          pin: u.pin || '',
          role: 'FIELD_OFFICER',
          status: (u.status as any) || 'ACTIVE',
          region: u.regionName || 'Ashanti Region',
          group: u.groupName || 'Group 1',
          isGroupLeader: Boolean(u.isGroupLeader),
          assignedCenter: u.centerName || 'Unassigned',
          assignedCenterCode: u.centerCode || '',
          dutyStatus: u.assignmentStatus === 'ON_SITE' ? 'ON_DUTY' : 'OFF_DUTY',
          mustChangePassword: Boolean(u.mustChangePassword),
          passwordHash: '',
          photo: u.image || '',
          bio: u.bio || '',
          lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('en-GB') : 'Never',
          checkInTime: u.checkInTime
            ? new Date(u.checkInTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' GMT'
            : undefined,
        })
      }

      return NextResponse.json({ officers })
    }

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
      actorId,
      actorName,
    } = data

    if (!name || !phone || !assignedCenter) {
      return NextResponse.json(
        { error: 'Name, Phone number, and Assigned Center are required' },
        { status: 400 }
      )
    }

    const effectiveStaffId = staffId || 'WAEC-GH-' + Math.floor(1000 + Math.random() * 9000)
    const effectiveEmail =
      email || `${name.toLowerCase().replace(/[^a-z0-9]+/g, '')}.${Date.now().toString().slice(-3)}@waec.org`
    const effectivePin =
      (pin && String(pin).padStart(4, '0')) || Math.floor(1000 + Math.random() * 9000).toString()
    const newUserId = `usr-off-${Date.now()}`

    if (isLiveDatabase && db) {
      const existing = await db
        .select()
        .from(schema.user)
        .where(or(eq(schema.user.phone, phone.trim()), eq(schema.user.staffId, effectiveStaffId)))
        .limit(1)

      if (existing.length > 0) {
        return NextResponse.json(
          { error: 'An officer with this phone number or Staff ID already exists.' },
          { status: 409 }
        )
      }

      // Resolve regionId dynamically from DB
      let resolvedRegionId = 'reg-ashanti'
      if (region) {
        const regRows = await db
          .select({ id: schema.regions.id, name: schema.regions.name })
          .from(schema.regions)
        const matchedReg = regRows.find((r) => r.name.toLowerCase().includes(String(region).toLowerCase()))
        if (matchedReg) resolvedRegionId = matchedReg.id
      }

      await db.insert(schema.user).values({
        id: newUserId,
        name: name.trim(),
        email: effectiveEmail,
        staffId: effectiveStaffId,
        phone: phone.trim(),
        pin: effectivePin,
        groupName: group || 'Group 1',
        isGroupLeader: Boolean(isGroupLeader),
        role: 'FIELD_OFFICER',
        status: 'ACTIVE',
        regionId: resolvedRegionId,
        mustChangePassword: false,
      })

      const centers = await db
        .select()
        .from(schema.examinationCenters)
        .where(
          assignedCenterCode
            ? eq(schema.examinationCenters.centerCode, assignedCenterCode)
            : eq(schema.examinationCenters.centerName, assignedCenter)
        )
        .limit(1)

      const centerId = centers[0]?.id
      if (centerId) {
        await db.insert(schema.assignments).values({
          id: `asg-${Date.now()}`,
          operationId: 'op-wassce-2026',
          centerId,
          officerId: newUserId,
          date: new Date().toISOString().split('T')[0],
          paperName: 'Core Mathematics Paper 1 & 2',
          startTime: '08:30 GMT',
          endTime: '12:00 GMT',
          status: 'PENDING',
        })
      }

      await recordAuditLog({
        actorId: actorId || 'usr-admin-hq',
        actorName: actorName || 'HQ Command',
        actorRole: 'ADMIN',
        action: 'USER_CREATED',
        entityType: 'users',
        entityId: newUserId,
        details: {
          message: `Registered officer ${name.trim()} (${effectiveStaffId}) at ${assignedCenter}`,
          centerName: assignedCenter,
          group: group || 'Group 1',
        },
      })
    }

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
      assignedCenterCode: assignedCenterCode || '',
      passwordHash: '',
      photo: '',
    })

    return NextResponse.json({ success: true, officer: { ...created, id: newUserId } }, { status: 201 })
  } catch (error) {
    console.error('Failed to provision field officer:', error)
    return NextResponse.json({ error: 'Failed to provision field officer' }, { status: 500 })
  }
}

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
    bio,
    dutyStatus,
    actorId,
    actorName,
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
  if (name !== undefined && String(name).trim()) userUpdates.name = String(name).trim()
  if (email !== undefined && String(email).trim()) userUpdates.email = String(email).trim()
  if (phone !== undefined) userUpdates.phone = String(phone).trim()
  if (effectiveGroup !== undefined) userUpdates.groupName = effectiveGroup
  if (isGroupLeader !== undefined) userUpdates.isGroupLeader = Boolean(isGroupLeader)
  if (effectivePhoto !== undefined) userUpdates.image = effectivePhoto
  if (bio !== undefined) userUpdates.bio = String(bio)

  if (isLiveDatabase && db) {
    const existingRows = await db
      .select({ id: schema.user.id, name: schema.user.name, status: schema.user.status })
      .from(schema.user)
      .where(eq(schema.user.id, id))
      .limit(1)

    if (existingRows.length === 0) {
      return { error: 'Officer not found in database', status: 404 }
    }

    const existing = existingRows[0]

    if (Object.keys(userUpdates).length > 1) {
      await db.update(schema.user).set(userUpdates).where(eq(schema.user.id, id))
    }

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
          .orderBy(desc(schema.assignments.updatedAt))
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

    const targetName = (userUpdates.name as string) || existing.name
    let auditAction = 'USER_UPDATED'
    let auditMessage = `Updated profile for ${targetName}`

    if (effectiveStatus && effectiveStatus !== existing.status) {
      auditAction = effectiveStatus === 'REVOKED' ? 'USER_REVOKED' : 'USER_RESTORED'
      auditMessage =
        effectiveStatus === 'REVOKED'
          ? `Revoked access for ${targetName}`
          : `Restored active access for ${targetName}`
    } else if (effectivePin !== undefined && Object.keys(userUpdates).length === 2) {
      auditAction = 'PIN_RESET'
      auditMessage = `Reset login PIN for ${targetName}`
    }

    await recordAuditLog({
      actorId: actorId || 'usr-admin-hq',
      actorName: actorName || 'HQ Command',
      actorRole: 'ADMIN',
      action: auditAction,
      entityType: 'users',
      entityId: id,
      details: {
        message: auditMessage,
        targetName,
      },
    })
  }

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
  if (bio !== undefined) storeUpdates.bio = bio
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
