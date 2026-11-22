/**
 * Native field capability bridge.
 *
 * Web and APK share every duty rule. The only difference is how location is
 * obtained: browsers stream fixes while the tab is open, the Android APK runs
 * a foreground service and streams fixes even when the app is backgrounded.
 * Nothing in here fabricates a position or a device check.
 */
import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core'

export type DetectionMode = 'web-foreground' | 'native-background'

export interface NativePosition {
  latitude: number
  longitude: number
  accuracy: number
  timestamp: number
  mock: boolean
}

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
  getLastKnown(): Promise<Partial<NativePosition>>
  getIntegrity(): Promise<DeviceIntegritySignal>
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
