import { NextRequest, NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getSessionFromCookie } from '@/lib/auth/server-session'

export async function GET(request: NextRequest) {
  const session = await getSessionFromCookie(request)
  if (!session || !isLiveDatabase || !db) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  const rows = await db
    .select({
      id: schema.user.id,
      staffId: schema.user.staffId,
      email: schema.user.email,
      name: schema.user.name,
      phone: schema.user.phone,
      role: schema.user.role,
      status: schema.user.status,
      groupName: schema.user.groupName,
      isGroupLeader: schema.user.isGroupLeader,
      image: schema.user.image,
      bio: schema.user.bio,
      mustChangePassword: schema.user.mustChangePassword,
      regionName: schema.regions.name,
      centerName: schema.examinationCenters.centerName,
      centerCode: schema.examinationCenters.centerCode,
    })
    .from(schema.user)
    .leftJoin(schema.regions, eq(schema.user.regionId, schema.regions.id))
    .leftJoin(schema.assignments, eq(schema.assignments.officerId, schema.user.id))
    .leftJoin(schema.examinationCenters, eq(schema.assignments.centerId, schema.examinationCenters.id))
    .where(eq(schema.user.id, session.userId))
    .limit(1)

  const u = rows[0]
  if (!u) {
    return NextResponse.json({ error: 'Not signed in' }, { status: 401 })
  }

  return NextResponse.json({
    user: {
      userId: u.id,
      staffId: u.staffId || 'WAEC-GH-0000',
      email: u.email,
      name: u.name,
      phone: u.phone || '',
      role: u.role as 'ADMIN' | 'FIELD_OFFICER' | 'SUPER_ADMIN' | 'REGIONAL_COORD' | 'SUPERVISOR',
      status: u.status as 'ACTIVE' | 'REVOKED',
      region: u.regionName || 'Ashanti Region',
      group: u.groupName || 'Group 1',
      isGroupLeader: Boolean(u.isGroupLeader),
      assignedCenter: u.centerName || 'Unassigned',
      assignedCenterCode: u.centerCode || '',
      photo: u.image || '',
      bio: u.bio || '',
      mustChangePassword: Boolean(u.mustChangePassword),
    },
  })
}
