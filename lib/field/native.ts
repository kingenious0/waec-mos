/**
 * Native field capability bridge.
 *
 * Web and APK share every duty rule. The only difference is how location is
 * obtained: browsers stream fixes while the tab is open, the Android APK runs
 * a foreground service and streams fixes even when the app is backgrounded.
 * Nothing in here fabricates a position or a device check.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

export type DetectionMode = 'web-foreground' | 'native-background'

export interface NativePosition {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
  mock: boolean
}

/** What the native layer actually knows about location readiness. */
export interface NativeLocationStatus {
  permission: 'granted' | 'denied' | 'prompt'
  locationServicesEnabled: boolean
  running: boolean
}

/** Outcome of the permission preflight, in plain language for the field UI. */
export type NativeLocationReady =
  | { ok: true }
  | { ok: false; reason: 'permission-denied' | 'location-services-off' | 'unavailable' }

export interface DeviceIntegritySignal {
  mockLocationSetting: boolean
  adbEnabled: boolean
  developerOptions: boolean
  rooted: boolean
  emulator: boolean
  testKeys: boolean
  provider: 'device-local'
  evaluatedAt: number
  lastFixMock: boolean
}

interface FieldLocationPluginApi {
  start(options?: {
    intervalMs?: number
    notificationTitle?: string
    notificationText?: string
  }): Promise<{ started: boolean }>
  stop(): Promise<{ started: boolean }>
  isRunning(): Promise<{ running: boolean }>
  getStatus(): Promise<NativeLocationStatus>
  getLastKnown(): Promise<Partial<NativePosition>>
  getIntegrity(): Promise<DeviceIntegritySignal>
  openLocationSettings(): Promise<void>
  openAppSettings(): Promise<void>
  addListener(
    eventName: 'position',
    listenerFunc: (position: NativePosition) => void
  ): Promise<PluginListenerHandle>
  removeAllListeners(): Promise<void>
}

const fieldLocation = registerPlugin<FieldLocationPluginApi>('FieldLocation')

function platform(): string {
  if (typeof window === 'undefined') return ''
  try {
    return Capacitor.getPlatform()
  } catch {
    return ''
  }
}

export function isNativeFieldApp(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return Capacitor.isNativePlatform() && platform() === 'android'
  } catch {
    return false
  }
}

export function detectionMode(): DetectionMode {
  return isNativeFieldApp() ? 'native-background' : 'web-foreground'
}

/** Read the real Android state; never infer it from a failed GPS fix. */
export async function getNativeLocationStatus(): Promise<NativeLocationStatus | null> {
  if (!isNativeFieldApp()) return null
  try {
    return await fieldLocation.getStatus()
  } catch {
    return null
  }
}

/**
 * Ask for Android location permission through Capacitor's supported plugin.
 * This guarantees a system prompt even when the foreground-service plugin is
 * unavailable, and maps a switched-off phone to a different recovery step.
 */
export async function ensureNativeLocationReady(): Promise<NativeLocationReady> {
  if (!isNativeFieldApp()) return { ok: false, reason: 'unavailable' }

  const status = await getNativeLocationStatus()
  if (status && !status.locationServicesEnabled) {
    return { ok: false, reason: 'location-services-off' }
  }

  try {
    const permission = await Geolocation.requestPermissions({ permissions: ['location'] })
    const granted = permission.location === 'granted' || permission.coarseLocation === 'granted'
    return granted ? { ok: true } : { ok: false, reason: 'permission-denied' }
  } catch {
    // Capacitor throws here when the phone's Location switch is off.
    const after = await getNativeLocationStatus()
    if (after && !after.locationServicesEnabled) {
      return { ok: false, reason: 'location-services-off' }
    }
    return { ok: false, reason: 'unavailable' }
  }
}

export async function openPhoneLocationSettings(): Promise<void> {
  if (!isNativeFieldApp()) return
  try {
    await fieldLocation.openLocationSettings()
  } catch {
    // Nothing else to do; the officer can still use the phone's Settings app.
  }
}

export async function openAppLocationSettings(): Promise<void> {
  if (!isNativeFieldApp()) return
  try {
    await fieldLocation.openAppSettings()
  } catch {
    // Nothing else to do; the officer can still use the phone's Settings app.
  }
}

export async function startNativeTracking(intervalMs = 10000): Promise<boolean> {
  if (!isNativeFieldApp()) return false
  const result = await fieldLocation.start({ intervalMs })
  return Boolean(result?.started)
}

export async function stopNativeTracking(): Promise<void> {
  if (!isNativeFieldApp()) return
  try {
    await fieldLocation.stop()
  } catch {
    // App may be going away; nothing useful to do here.
  }
}

export async function onNativePosition(
  callback: (position: NativePosition) => void
): Promise<PluginListenerHandle | null> {
  if (!isNativeFieldApp()) return null
  return fieldLocation.addListener('position', callback)
}

export async function getLastNativePosition(): Promise<NativePosition | null> {
  if (!isNativeFieldApp()) return null
  const last = await fieldLocation.getLastKnown()
  if (typeof last.latitude !== 'number' || typeof last.longitude !== 'number') return null
  return {
    latitude: last.latitude,
    longitude: last.longitude,
    accuracy: typeof last.accuracy === 'number' ? last.accuracy : 0,
    timestamp: typeof last.timestamp === 'number' ? last.timestamp : Date.now(),
    mock: Boolean(last.mock),
  }
}

export async function getDeviceIntegrity(): Promise<DeviceIntegritySignal | null> {
  if (!isNativeFieldApp()) return null
  return fieldLocation.getIntegrity()
}

/** Plain-language, non-accusatory wording for HQ and the officer. */
export function integrityWarnings(signal: DeviceIntegritySignal | null): string[] {
  if (!signal) return []
  const warnings: string[] = []
  if (signal.mockLocationSetting || signal.lastFixMock) {
    warnings.push('Mock location is switched on. GPS evidence may not be accepted.')
  }
  if (signal.rooted || signal.testKeys) {
    warnings.push('This phone looks modified. Your leader can mark you present instead.')
  }
  if (signal.emulator) {
    warnings.push('This looks like a test phone, not a field device.')
  }
  if (signal.developerOptions || signal.adbEnabled) {
    warnings.push('Developer options are on. Location checks are less trusted.')
  }
  return warnings
}
