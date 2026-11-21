/**
 * Emergency SOS interaction rules.
 *
 * These guard the HCI decisions behind the redesigned officer trigger:
 * a fast 1s hold, clamped progress, and plain-language feedback.
 */
import { describe, it, expect } from 'vitest'
import {
  SOS_HOLD_MS,
  sosCountdownLabel,
  sosHoldProgress,
  sosResultLabel,
} from '@/lib/field/sos'

describe('emergency SOS gesture', () => {
  it('uses a quick one-second hold', () => {
    expect(SOS_HOLD_MS).toBe(1000)
  })

  it('clamps hold progress between zero and one', () => {
    expect(sosHoldProgress(-5)).toBe(0)
    expect(sosHoldProgress(0)).toBe(0)
    expect(sosHoldProgress(Number.NaN)).toBe(0)
    expect(sosHoldProgress(500)).toBe(0.5)
    expect(sosHoldProgress(1000)).toBe(1)
    expect(sosHoldProgress(5000)).toBe(1)
  })

  it('shows a plain countdown while holding', () => {
    expect(sosCountdownLabel(0)).toBe('Keep holding… 1.0s')
    expect(sosCountdownLabel(0.5)).toBe('Keep holding… 0.5s')
    expect(sosCountdownLabel(1)).toBe('Sending now')
  })

  it('tells the officer exactly what happened', () => {
    expect(sosResultLabel(false)).toContain('Regional Command')
    expect(sosResultLabel(true)).toContain('back online')
  })
})
