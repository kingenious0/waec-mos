import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export async function GET() {
  try {
    if (!isLiveDatabase || !db) {
      return NextResponse.json({ officers: [] })
    }

    // Query assignments joined with user and examination_centers
    const rows = await db
      .select({
        assignmentId: schema.assignments.id,
        assignmentStatus: schema.assignments.status,
        checkInTime: schema.assignments.checkInTime,
        checkInDistance: schema.assignments.checkInDistanceMeters,
        checkInLat: schema.assignments.checkInLatitude,
        checkInLng: schema.assignments.checkInLongitude,
        userId: schema.user.id,
        userName: schema.user.name,
        userPhone: schema.user.phone,
        userStaffId: schema.user.staffId,
        userRole: schema.user.role,
        userStatus: schema.user.status,
        centerId: schema.examinationCenters.id,
        centerName: schema.examinationCenters.centerName,
        centerCode: schema.examinationCenters.centerCode,
        centerLat: schema.examinationCenters.latitude,
        centerLng: schema.examinationCenters.longitude,
      })
      .from(schema.assignments)
      .innerJoin(schema.user, eq(schema.assignments.officerId, schema.user.id))
      .innerJoin(schema.examinationCenters, eq(schema.assignments.centerId, schema.examinationCenters.id))

    const officers = rows.map((r, idx) => {
      // Determine status: ON_SITE, PENDING, or SOS
      let status: 'ON_SITE' | 'PENDING' | 'SOS' = 'PENDING'
      if (r.assignmentStatus === 'ON_SITE' || r.assignmentStatus === 'COMPLETED') {
        status = 'ON_SITE'
      }

      const centerLat = Number(r.centerLat) || 6.7028
      const centerLng = Number(r.centerLng) || -1.6369

      // Position: use check-in coords if present, else slightly offset around the center
      const lat = r.checkInLat ? Number(r.checkInLat) : centerLat + ((idx % 3) - 1) * 0.0003
      const lng = r.checkInLng ? Number(r.checkInLng) : centerLng + ((idx % 2) === 0 ? 0.0002 : -0.0002)

      const verifiedTimeStr = r.checkInTime
        ? new Date(r.checkInTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' GMT'
        : status === 'ON_SITE' ? '07:54 GMT' : undefined

      return {
        id: r.userId || r.assignmentId,
        name: r.userName || 'Field Officer',
        phone: r.userPhone || '+233 24 000 0000',
        staffId: r.userStaffId || 'WAEC-ASH-0100',
        group: `Group ${Math.floor(idx / 2) + 1}`,
        isLeader: idx % 2 === 0,
        assignedCenter: r.centerName,
        centerCode: r.centerCode,
        status,
        verifiedTime: verifiedTimeStr,
        distanceFromDatum: r.checkInDistance || (status === 'ON_SITE' ? 24 : 450),
        battery: 80 + ((idx * 7) % 19),
        lat,
        lng,
        sosDetails: undefined,
      }
    })

    return NextResponse.json({ officers })
  } catch (error) {
    console.error('Failed to fetch fleet officers:', error)
    return NextResponse.json({ error: 'Failed to fetch fleet officers' }, { status: 500 })
  }
}
