import { NextResponse } from 'next/server'
import { db, isLiveDatabase } from '@/lib/db'
import * as schema from '@/lib/db/schema'
import { DEFAULT_SYSTEM_SETTINGS, parseGeofenceRadiusMeters } from '@/lib/settings-utils'
import { recordAuditLog } from '@/lib/db/audit'
import { requireCommand, requireAdmin } from '@/lib/auth/guard'
import { eq } from 'drizzle-orm'

const SETTINGS_ID = 'default-ashanti'

async function getOrCreateSettings() {
  if (!isLiveDatabase || !db) return DEFAULT_SYSTEM_SETTINGS

  const rows = await db
    .select()
    .from(schema.systemSettings)
    .where(eq(schema.systemSettings.id, SETTINGS_ID))
    .limit(1)

  if (rows.length > 0) {
    const r = rows[0]
    return {
      lowBatteryThreshold: r.lowBatteryThreshold,
      outsideGeofenceAlert: r.outsideGeofenceAlert,
      officerOfflineTimeout: r.officerOfflineTimeout,
      inAppNotifications: r.inAppNotifications,
      sosAlarmSound: r.sosAlarmSound,
      smsToController: r.smsToController,
      dailyEmailSummary: r.dailyEmailSummary,
      geofenceRadius: r.geofenceRadius,
      locationRefreshInterval: r.locationRefreshInterval,
      hideOfficerPins: r.hideOfficerPins,
      sessionTimeout: r.sessionTimeout,
      adminSmsCheck: r.adminSmsCheck ?? true,
      locationOnlyOnDuty: r.locationOnlyOnDuty ?? true,
    }
  }

  await db
    .insert(schema.systemSettings)
    .values({ id: SETTINGS_ID, ...DEFAULT_SYSTEM_SETTINGS })
    .onConflictDoNothing()

  return DEFAULT_SYSTEM_SETTINGS
}

export async function GET(request: Request) {
  try {
    const gate = await requireCommand(request as any)
    if (gate.error) return gate.error
    const settings = await getOrCreateSettings()
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error('Failed to fetch settings:', error)
    return NextResponse.json({ error: 'Failed to load system settings' }, { status: 500 })
  }
}

export async function PUT(request: Request) {
  try {
    const gate = await requireAdmin(request as any)
    if (gate.error) return gate.error
    const body = await request.json()
    const { settings } = body
    const actorId = gate.user.id
    const actorName = gate.user.name

    // Super-admins can never disable the admin SMS check — enforce server-side
    const canSuperAdminRelaxSecurity = gate.user.role === 'SUPER_ADMIN'
    const requestedSms = Boolean(
      settings?.adminSmsCheck ?? DEFAULT_SYSTEM_SETTINGS.adminSmsCheck
    )
    const adminSmsCheck = canSuperAdminRelaxSecurity ? true : requestedSms

    const nextSettings = {
      lowBatteryThreshold: settings?.lowBatteryThreshold ?? DEFAULT_SYSTEM_SETTINGS.lowBatteryThreshold,
      outsideGeofenceAlert: Boolean(settings?.outsideGeofenceAlert ?? DEFAULT_SYSTEM_SETTINGS.outsideGeofenceAlert),
      officerOfflineTimeout: settings?.officerOfflineTimeout ?? DEFAULT_SYSTEM_SETTINGS.officerOfflineTimeout,
      inAppNotifications: Boolean(settings?.inAppNotifications ?? DEFAULT_SYSTEM_SETTINGS.inAppNotifications),
      sosAlarmSound: Boolean(settings?.sosAlarmSound ?? DEFAULT_SYSTEM_SETTINGS.sosAlarmSound),
      smsToController: Boolean(settings?.smsToController ?? DEFAULT_SYSTEM_SETTINGS.smsToController),
      dailyEmailSummary: Boolean(settings?.dailyEmailSummary ?? DEFAULT_SYSTEM_SETTINGS.dailyEmailSummary),
      geofenceRadius: settings?.geofenceRadius ?? DEFAULT_SYSTEM_SETTINGS.geofenceRadius,
      locationRefreshInterval: settings?.locationRefreshInterval ?? DEFAULT_SYSTEM_SETTINGS.locationRefreshInterval,
      hideOfficerPins: Boolean(settings?.hideOfficerPins ?? DEFAULT_SYSTEM_SETTINGS.hideOfficerPins),
      sessionTimeout: settings?.sessionTimeout ?? DEFAULT_SYSTEM_SETTINGS.sessionTimeout,
      adminSmsCheck,
      locationOnlyOnDuty: Boolean(
        settings?.locationOnlyOnDuty ?? DEFAULT_SYSTEM_SETTINGS.locationOnlyOnDuty
      ),
    }

    if (isLiveDatabase && db) {
      const current = await getOrCreateSettings()

      await db
        .insert(schema.systemSettings)
        .values({
          id: SETTINGS_ID,
          ...nextSettings,
          updatedAt: new Date(),
          updatedBy: actorId,
        })
        .onConflictDoUpdate({
          target: schema.systemSettings.id,
          set: {
            ...nextSettings,
            updatedAt: new Date(),
            updatedBy: actorId,
          },
        })

      // If geofenceRadius changed, synchronize examination centers currently matching old default radius
      const oldRadiusMeters = parseGeofenceRadiusMeters(current.geofenceRadius)
      const newRadiusMeters = parseGeofenceRadiusMeters(nextSettings.geofenceRadius)
      if (oldRadiusMeters !== newRadiusMeters) {
        await db
          .update(schema.examinationCenters)
          .set({ geofenceRadiusMeters: newRadiusMeters })
          .where(eq(schema.examinationCenters.geofenceRadiusMeters, oldRadiusMeters))
      }

      await recordAuditLog({
        actorId,
        actorName,
        actorRole: 'ADMIN',
        action: 'SETTINGS_UPDATED',
        entityType: 'system_settings',
        entityId: SETTINGS_ID,
        details: {
          message: `${actorName || 'Administrator'} updated regional hub settings (Radius: ${nextSettings.geofenceRadius}, Poll: ${nextSettings.locationRefreshInterval})`,
        },
      })
    }

    return NextResponse.json({ success: true, settings: nextSettings })
  } catch (error) {
    console.error('Failed to update settings:', error)
    return NextResponse.json({ error: 'Failed to save system settings' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const gate = await requireAdmin(request as any)
    if (gate.error) return gate.error
    const actorId = gate.user.id
    const actorName = gate.user.name

    if (isLiveDatabase && db) {
      await db
        .insert(schema.systemSettings)
        .values({
          id: SETTINGS_ID,
          ...DEFAULT_SYSTEM_SETTINGS,
          updatedAt: new Date(),
          updatedBy: actorId,
        })
        .onConflictDoUpdate({
          target: schema.systemSettings.id,
          set: {
            ...DEFAULT_SYSTEM_SETTINGS,
            updatedAt: new Date(),
            updatedBy: actorId,
          },
        })

      await recordAuditLog({
        actorId,
        actorName,
        actorRole: 'ADMIN',
        action: 'SETTINGS_RESET',
        entityType: 'system_settings',
        entityId: SETTINGS_ID,
        details: {
          message: `${actorName || 'Administrator'} reset regional hub settings to factory defaults`,
        },
      })
    }

    return NextResponse.json({ success: true, settings: DEFAULT_SYSTEM_SETTINGS })
  } catch (error) {
    console.error('Failed to reset settings:', error)
    return NextResponse.json({ error: 'Failed to reset system settings' }, { status: 500 })
  }
}

