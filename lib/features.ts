/**
 * Feature Flags Configuration for WAEC MOS
 * Controls feature rollouts across V1 (MVP) and V2 releases.
 */

export const FEATURES = {
  // --- V1 Core Capabilities (Active) ---
  FIELD_GPS_GEOFENCE_CHECKIN: true,
  FIELD_EMERGENCY_SOS_HOLD: true,
  FIELD_OFFLINE_INDICATOR: true,
  FIELD_SHIFT_TIMER: true,
  FIELD_REAL_DEVICE_GPS: true,

  // --- V2 Scope (Deferred - preserved in codebase, gated from UI) ---
  FIELD_INCIDENT_REPORTING: false,       // Hides Incident Report button and filing modal
  FIELD_PHOTO_EVIDENCE_UPLOAD: false,    // Camera evidence capture and uploads
  FIELD_OFFLINE_INDEXED_DB_SYNC: false,  // Full local IndexedDB sync queue
  FIELD_SUPERVISOR_DIRECT_CHAT: false,   // In-app messaging with supervisor
  FIELD_MATERIALS_SCANNER: false,        // Tamper-evident barcode/QR scanner
} as const

export type FeatureFlag = keyof typeof FEATURES

/**
 * Checks whether a specific feature flag is currently active.
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURES[flag] ?? false
}
