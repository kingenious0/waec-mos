import { NextResponse } from 'next/server'
import { db, isLiveDatabase, store } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { parseGeofenceRadiusMeters } from '@/lib/settings-utils'
import { desc, eq, or } from 'drizzle-orm'

// Helper to calculate times before start time
function calculateTimeline(paperName: string, startTimeRaw: string, endTimeRaw: string) {
  const timeMatch = startTimeRaw.match(/(\d{1,2}):(\d{2})/)
  const endMatch = endTimeRaw.match(/(\d{1,2}):(\d{2})/)

  let collectTime = '07:45'
  let arriveTime = '08:00'
  let startTimeFormatted = startTimeRaw.trim()
  let endTimeFormatted = endTimeRaw.trim()

  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10)
    const minutes = parseInt(timeMatch[2], 10)
    const totalMinutes = hours * 60 + minutes

    const collectTotal = totalMinutes - 45
    const collectH = Math.floor(collectTotal / 60)
    const collectM = collectTotal % 60
    collectTime = `${String(collectH).padStart(2, '0')}:${String(collectM).padStart(2, '0')}`

    const arriveTotal = totalMinutes - 30
    const arriveH = Math.floor(arriveTotal / 60)
    const arriveM = arriveTotal % 60
    arriveTime = `${String(arriveH).padStart(2, '0')}:${String(arriveM).padStart(2, '0')}`

    startTimeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
  }

  if (endMatch) {
    const endH = parseInt(endMatch[1], 10)
    const endM = parseInt(endMatch[2], 10)
    endTimeFormatted = `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`
  }

  const timeline = [
    { time: collectTime, label: 'Collect papers', isHighlight: false },
    { time: arriveTime, label: 'Check in deadline', isHighlight: true },
    { time: startTimeFormatted, label: `${paperName} begins`, isHighlight: false },
    { time: endTimeFormatted, label: 'Paper ends', isHighlight: false },
  ]

  const paper = {
    title: paperName,
    timeRange: `${startTimeRaw} to ${endTimeRaw}`,
    arriveBy: arriveTime,
    collectBy: `Collect at ${collectTime}`,
  }

  return { timeline, paper }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const officerId = searchParams.get('officerId')
    const staffId = searchParams.get('staffId')

    let assignmentRow: any = null
    let defaultRadius = 150
    let refreshIntervalMs = 10000

    if (isLiveDatabase && db) {
      const settingsRows = await db
        .select()
        .from(schema.systemSettings)
        .where(eq(schema.systemSettings.id, 'default-ashanti'))
        .limit(1)
      if (settingsRows[0]) {
        defaultRadius = parseGeofenceRadiusMeters(settingsRows[0].geofenceRadius)
        const m = String(settingsRows[0].locationRefreshInterval || '').match(/(\d+)/)
        if (m) refreshIntervalMs = Math.max(3000, Number(m[1]) * 1000)
      }

      const query = db
        .select({
          assignmentId: schema.assignments.id,
          paperName: schema.assignments.paperName,
          startTime: schema.assignments.startTime,
          endTime: schema.assignments.endTime,
          status: schema.assignments.status,
          checkInTime: schema.assignments.checkInTime,
          checkOutTime: schema.assignments.checkOutTime,
          date: schema.assignments.date,
          centerId: schema.examinationCenters.id,
          centerName: schema.examinationCenters.centerName,
          centerCode: schema.examinationCenters.centerCode,
          latitude: schema.examinationCenters.latitude,
          longitude: schema.examinationCenters.longitude,
          geofenceRadiusMeters: schema.examinationCenters.geofenceRadiusMeters,
          districtName: schema.districts.name,
          regionName: schema.regions.name,
          isSosActive: schema.user.isSosActive,
        })
        .from(schema.assignments)
        .leftJoin(schema.user, eq(schema.assignments.officerId, schema.user.id))
        .leftJoin(schema.examinationCenters, eq(schema.assignments.centerId, schema.examinationCenters.id))
        .leftJoin(schema.districts, eq(schema.examinationCenters.districtId, schema.districts.id))
        .leftJoin(schema.regions, eq(schema.districts.regionId, schema.regions.id))
        .orderBy(desc(schema.assignments.updatedAt))

      let rows: any[] = []

      if (officerId || staffId) {
        const lookupConds = []
        if (officerId) lookupConds.push(eq(schema.user.id, officerId))
        if (staffId) lookupConds.push(eq(schema.user.staffId, staffId))

        const userMatches = await db
          .select({ id: schema.user.id, isSosActive: schema.user.isSosActive })
          .from(schema.user)
          .where(lookupConds.length === 1 ? lookupConds[0] : or(...lookupConds))
          .limit(1)

        const resolvedUserId = userMatches[0]?.id || officerId

        if (resolvedUserId) {
          rows = await query.where(eq(schema.assignments.officerId, resolvedUserId)).limit(1)
        }
      }

      if (rows.length > 0) {
        assignmentRow = rows[0]
      }
    }

    if (!assignmentRow && (!isLiveDatabase || !db)) {
      const officer = (officerId || staffId)
        ? store.findUser(officerId || staffId || '')
        : store.getFieldOfficers()[0]

      const centerName = officer?.assignedCenter || 'Prempeh College Center A'
      const centerCode = officer?.assignedCenterCode || '050102'

      const centerCoordsMap: Record<string, { lat: number; lng: number; district: string; radius: number }> = {
        '050102': { lat: 6.7028, lng: -1.6369, district: 'Bantama Sub-Metro', radius: 150 },
        '050510': { lat: 6.6912, lng: -1.6521, district: 'Kwadaso Municipal', radius: 150 },
        '050211': { lat: 6.6663, lng: -1.5975, district: 'Asokwa Municipal', radius: 150 },
        '050304': { lat: 6.6806, lng: -1.6389, district: 'Kumasi Metropolitan', radius: 150 },
      }

      const centerMeta = centerCoordsMap[centerCode] || {
        lat: 6.7028,
        lng: -1.6369,
        district: 'Kumasi Metropolitan',
        radius: 150,
      }

      assignmentRow = {
        paperName: 'Core Mathematics Paper 1 & 2',
        startTime: '08:30 GMT',
        endTime: '12:00 GMT',
        status: officer?.dutyStatus === 'ON_DUTY' ? 'ON_SITE' : 'PENDING',
        checkInTime: null,
        isSosActive: false,
        centerName,
        centerCode,
        latitude: centerMeta.lat,
        longitude: centerMeta.lng,
        geofenceRadiusMeters: centerMeta.radius,
        districtName: centerMeta.district,
        regionName: officer?.region || 'Ashanti Region',
      }
    }

    if (!assignmentRow) {
      return NextResponse.json({
        success: true,
        venue: null,
        paper: null,
        timeline: [],
        assignmentStatus: 'UNASSIGNED',
        isCheckedIn: false,
        checkInTimeIso: null,
        checkInTimeFormatted: null,
        isSosActive: false,
        refreshIntervalMs,
        isLiveDb: isLiveDatabase,
      })
    }

    const { timeline, paper } = calculateTimeline(
      assignmentRow.paperName || 'Core Mathematics Paper 1 & 2',
      assignmentRow.startTime || '08:30 GMT',
      assignmentRow.endTime || '12:00 GMT'
    )

    const venue = {
      name: assignmentRow.centerName || 'Unassigned Center',
      code: assignmentRow.centerCode || '',
      zone: assignmentRow.districtName
        ? `${assignmentRow.districtName} Examination Zone`
        : 'Kumasi Central Examination Zone',
      region: assignmentRow.regionName || 'Ashanti Region',
      lat: Number(assignmentRow.latitude) || 6.7028,
      lng: Number(assignmentRow.longitude) || -1.6369,
      radiusMeters: Number(assignmentRow.geofenceRadiusMeters) || defaultRadius,
    }

    const isCheckedIn = assignmentRow.status === 'ON_SITE'
    const checkInDate = assignmentRow.checkInTime ? new Date(assignmentRow.checkInTime) : null

    return NextResponse.json({
      success: true,
      assignmentId: assignmentRow.assignmentId || null,
      assignmentStatus: assignmentRow.status || 'PENDING',
      isCheckedIn,
      checkInTimeIso: isCheckedIn && checkInDate ? checkInDate.toISOString() : null,
      checkInTimeFormatted:
        isCheckedIn && checkInDate
          ? checkInDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) + ' GMT'
          : null,
      isSosActive: Boolean(assignmentRow.isSosActive),
      refreshIntervalMs,
      venue,
      paper,
      timeline,
      isLiveDb: isLiveDatabase,
    })
  } catch (error) {
    console.error('Failed to fetch field assignment:', error)
    return NextResponse.json({ error: 'Failed to retrieve field assignment' }, { status: 500 })
  }
}
