/**
 * Native field capability tests.
 * The duty rules are shared, so these tests cover the only native-specific
 * behaviour: honest detection mode and plain-language device warnings.
 */
import { describe, it, expect } from 'vitest'
import {
  detectionMode,
  integrityWarnings,
  isNativeFieldApp,
  type DeviceIntegritySignal,
} from '@/lib/field/native'

const cleanSignal = (overrides: Partial<DeviceIntegritySignal> = {}): DeviceIntegritySignal => ({
  mockLocationSetting: false,
  adbEnabled: false,
  developerOptions: false,
  rooted: false,
  emulator: false,
  testKeys: false,
  provider: 'device-local',
  evaluatedAt: Date.now(),
  lastFixMock: false,
  ...overrides,
})

describe('native detection mode', () => {
  it('reports web foreground detection outside a native WebView', () => {
    expect(isNativeFieldApp()).toBe(false)
    expect(detectionMode()).toBe('web-foreground')
  })
})

describe('device integrity warnings', () => {
  it('stays quiet on a clean device', () => {
    expect(integrityWarnings(cleanSignal())).toEqual([])
  })

  it('warns in plain language when mock location is on', () => {
    const warnings = integrityWarnings(cleanSignal({ mockLocationSetting: true }))
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/mock location/i)
  })

  it('warns when a fix itself came from a mock provider', () => {
    expect(integrityWarnings(cleanSignal({ lastFixMock: true }))[0]).toMatch(/mock location/i)
  })

  it('warns once about a modified phone', () => {
    const warnings = integrityWarnings(cleanSignal({ rooted: true, testKeys: true }))
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/modified/i)
  })

  it('warns about developer options without accusing the officer', () => {
    const warnings = integrityWarnings(cleanSignal({ developerOptions: true, adbEnabled: true }))
    expect(warnings).toHaveLength(1)
    expect(warnings[0]).toMatch(/developer options/i)
  })

  it('returns no warnings when no native signal is available', () => {
    expect(integrityWarnings(null)).toEqual([])
  })
})
