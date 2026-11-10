export interface SystemSettingsConfig {
  lowBatteryThreshold: string
  outsideGeofenceAlert: boolean
  officerOfflineTimeout: string
  inAppNotifications: boolean
  sosAlarmSound: boolean
  smsToController: boolean
  dailyEmailSummary: boolean
  geofenceRadius: string
  locationRefreshInterval: string
  hideOfficerPins: boolean
  sessionTimeout: string
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettingsConfig = {
  lowBatteryThreshold: 'Below 25%',
  outsideGeofenceAlert: true,
  officerOfflineTimeout: 'After 2 minutes',
  inAppNotifications: true,
  sosAlarmSound: true,
  smsToController: true,
  dailyEmailSummary: false,
  geofenceRadius: '150 m',
  locationRefreshInterval: 'Every 10 s',
  hideOfficerPins: true,
  sessionTimeout: '30 minutes',
}

export function parseBatteryThresholdPct(val: string | undefined): number {
  const m = String(val || '').match(/(\d+)/)
  return m ? Number(m[1]) : 25
}

export function parseGeofenceRadiusMeters(val: string | undefined): number {
  const m = String(val || '').match(/(\d+)/)
  return m ? Number(m[1]) : 150
}

export function parseRefreshIntervalMs(val: string | undefined): number {
  const m = String(val || '').match(/(\d+)/)
  const seconds = m ? Number(m[1]) : 10
  return Math.max(3000, seconds * 1000)
}

export function parseOfflineTimeoutMs(val: string | undefined): number {
  const m = String(val || '').match(/(\d+)/)
  const mins = m ? Number(m[1]) : 2
  return Math.max(30000, mins * 60 * 1000)
}

export function parseSessionTimeoutMs(val: string | undefined): number | null {
  if (!val || val === 'Never') return null
  const m = String(val).match(/(\d+)/)
  if (!m) return 30 * 60 * 1000
  const num = Number(m[1])
  if (val.toLowerCase().includes('hour')) return num * 60 * 60 * 1000
  return num * 60 * 1000
}
