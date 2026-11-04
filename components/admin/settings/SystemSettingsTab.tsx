'use client'

import React, { useState } from 'react'
import {
  Shield,
  Bell,
  MapPin,
  Lock,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react'

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

const DEFAULT_SETTINGS: SystemSettingsConfig = {
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

interface SystemSettingsTabProps {
  onSave?: (settings: SystemSettingsConfig) => void
  onFeedback?: (msg: string) => void
}

export function SystemSettingsTab({ onSave, onFeedback }: SystemSettingsTabProps) {
  const [settings, setSettings] = useState<SystemSettingsConfig>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('waec_mos_system_settings')
        if (saved) return JSON.parse(saved)
      } catch {
        // fallback
      }
    }
    return DEFAULT_SETTINGS
  })

  const [isSaved, setIsSaved] = useState(false)

  const handleToggle = (key: keyof SystemSettingsConfig) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
    setIsSaved(false)
  }

  const handleChange = (key: keyof SystemSettingsConfig, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }))
    setIsSaved(false)
  }

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS)
    setIsSaved(false)
    if (onFeedback) {
      onFeedback('Settings reset to system defaults')
    }
  }

  const handleSave = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('waec_mos_system_settings', JSON.stringify(settings))
    }
    setIsSaved(true)
    if (onSave) onSave(settings)
    if (onFeedback) {
      onFeedback('System settings updated and synchronized across regional hub')
    }
    setTimeout(() => setIsSaved(false), 3000)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[#090A0F] text-foreground p-6 lg:p-10 select-none">
      <div className="max-w-4xl mx-auto space-y-8 pb-16">
        {/* Header Section */}
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-white">System settings</h1>
          <p className="text-sm text-zinc-400">
            Alert rules, map behaviour, and security for the Ashanti regional hub.
          </p>
        </div>

        {/* ========================================================= */}
        {/* SECTION 1: ALERT RULES */}
        {/* ========================================================= */}
        <div className="space-y-3">
          <div className="text-[11px] font-sans font-semibold tracking-wider text-muted-foreground uppercase">
            ALERT RULES
          </div>

          <div className="rounded-2xl border border-border/80 bg-[#0E1017] divide-y divide-border/60 overflow-hidden shadow-xs">
            {/* Row 1: SOS alerts */}
            <div className="p-4 sm:px-5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-white">SOS alerts</div>
                <div className="text-xs text-zinc-400">
                  Always on. Every SOS interrupts the screen and sounds an alarm.
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-[#10B981]/10 border border-[#10B981]/25 text-xs font-semibold text-[#10B981] shrink-0">
                Required
              </span>
            </div>

            {/* Row 2: Low battery */}
            <div className="p-4 sm:px-5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-white">Low battery</div>
                <div className="text-xs text-zinc-400">
                  Warn when an officer device drops below the threshold.
                </div>
              </div>
              <div className="relative shrink-0">
                <select
                  value={settings.lowBatteryThreshold}
                  onChange={(e) => handleChange('lowBatteryThreshold', e.target.value)}
                  className="appearance-none bg-[#141824] hover:bg-[#1A1F30] border border-border text-xs text-white font-medium rounded-xl px-3.5 py-2 pr-8 focus:outline-hidden focus:border-brand cursor-pointer transition"
                >
                  <option value="Below 15%">Below 15%</option>
                  <option value="Below 20%">Below 20%</option>
                  <option value="Below 25%">Below 25%</option>
                  <option value="Below 30%">Below 30%</option>
                </select>
                <ChevronDown className="size-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Row 3: Outside geofence */}
            <div className="p-4 sm:px-5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-white">Outside geofence</div>
                <div className="text-xs text-zinc-400">
                  Warn when an officer is beyond the centre perimeter during their shift.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.outsideGeofenceAlert}
                onClick={() => handleToggle('outsideGeofenceAlert')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  settings.outsideGeofenceAlert ? 'bg-[#3B82F6]' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    settings.outsideGeofenceAlert ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Row 4: Officer offline */}
            <div className="p-4 sm:px-5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-white">Officer offline</div>
                <div className="text-xs text-zinc-400">
                  Warn when no location update arrives.
                </div>
              </div>
              <div className="relative shrink-0">
                <select
                  value={settings.officerOfflineTimeout}
                  onChange={(e) => handleChange('officerOfflineTimeout', e.target.value)}
                  className="appearance-none bg-[#141824] hover:bg-[#1A1F30] border border-border text-xs text-white font-medium rounded-xl px-3.5 py-2 pr-8 focus:outline-hidden focus:border-brand cursor-pointer transition"
                >
                  <option value="After 1 minute">After 1 minute</option>
                  <option value="After 2 minutes">After 2 minutes</option>
                  <option value="After 5 minutes">After 5 minutes</option>
                  <option value="After 10 minutes">After 10 minutes</option>
                </select>
                <ChevronDown className="size-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 2: DELIVERY */}
        {/* ========================================================= */}
        <div className="space-y-3">
          <div className="text-[11px] font-sans font-semibold tracking-wider text-muted-foreground uppercase">
            DELIVERY
          </div>

          <div className="rounded-2xl border border-border/80 bg-[#0E1017] divide-y divide-border/60 overflow-hidden shadow-xs">
            {/* Row 1: In-app notifications */}
            <div className="p-4 sm:px-5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-white">In-app notifications</div>
                <div className="text-xs text-zinc-400">
                  Show alerts in the bell menu and as on-screen banners.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.inAppNotifications}
                onClick={() => handleToggle('inAppNotifications')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  settings.inAppNotifications ? 'bg-[#3B82F6]' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    settings.inAppNotifications ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Row 2: SOS alarm sound */}
            <div className="p-4 sm:px-5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-white">SOS alarm sound</div>
                <div className="text-xs text-zinc-400">
                  Play a repeating tone until the SOS is acknowledged.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.sosAlarmSound}
                onClick={() => handleToggle('sosAlarmSound')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  settings.sosAlarmSound ? 'bg-[#3B82F6]' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    settings.sosAlarmSound ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Row 3: SMS to regional controller */}
            <div className="p-4 sm:px-5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-white">SMS to regional controller</div>
                <div className="text-xs text-zinc-400">
                  Text the controller phone when an SOS is triggered.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.smsToController}
                onClick={() => handleToggle('smsToController')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  settings.smsToController ? 'bg-[#3B82F6]' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    settings.smsToController ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Row 4: Daily email summary */}
            <div className="p-4 sm:px-5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-white">Daily email summary</div>
                <div className="text-xs text-zinc-400">
                  End-of-shift digest of incidents and check-ins.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.dailyEmailSummary}
                onClick={() => handleToggle('dailyEmailSummary')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  settings.dailyEmailSummary ? 'bg-[#3B82F6]' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    settings.dailyEmailSummary ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 3: MAP AND GEOFENCES */}
        {/* ========================================================= */}
        <div className="space-y-3">
          <div className="text-[11px] font-sans font-semibold tracking-wider text-muted-foreground uppercase">
            MAP AND GEOFENCES
          </div>

          <div className="rounded-2xl border border-border/80 bg-[#0E1017] divide-y divide-border/60 overflow-hidden shadow-xs">
            {/* Row 1: Geofence radius */}
            <div className="p-4 sm:px-5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-white">Geofence radius</div>
                <div className="text-xs text-zinc-400">
                  Default perimeter around each exam centre.
                </div>
              </div>
              <div className="relative shrink-0">
                <select
                  value={settings.geofenceRadius}
                  onChange={(e) => handleChange('geofenceRadius', e.target.value)}
                  className="appearance-none bg-[#141824] hover:bg-[#1A1F30] border border-border text-xs text-white font-medium rounded-xl px-3.5 py-2 pr-8 focus:outline-hidden focus:border-brand cursor-pointer transition"
                >
                  <option value="100 m">100 m</option>
                  <option value="150 m">150 m</option>
                  <option value="200 m">200 m</option>
                  <option value="300 m">300 m</option>
                  <option value="500 m">500 m</option>
                </select>
                <ChevronDown className="size-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            {/* Row 2: Location refresh */}
            <div className="p-4 sm:px-5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-white">Location refresh</div>
                <div className="text-xs text-zinc-400">
                  How often the live map polls for new positions.
                </div>
              </div>
              <div className="relative shrink-0">
                <select
                  value={settings.locationRefreshInterval}
                  onChange={(e) => handleChange('locationRefreshInterval', e.target.value)}
                  className="appearance-none bg-[#141824] hover:bg-[#1A1F30] border border-border text-xs text-white font-medium rounded-xl px-3.5 py-2 pr-8 focus:outline-hidden focus:border-brand cursor-pointer transition"
                >
                  <option value="Every 5 s">Every 5 s</option>
                  <option value="Every 10 s">Every 10 s</option>
                  <option value="Every 30 s">Every 30 s</option>
                  <option value="Every 60 s">Every 60 s</option>
                </select>
                <ChevronDown className="size-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================= */}
        {/* SECTION 4: SECURITY */}
        {/* ========================================================= */}
        <div className="space-y-3">
          <div className="text-[11px] font-sans font-semibold tracking-wider text-muted-foreground uppercase">
            SECURITY
          </div>

          <div className="rounded-2xl border border-border/80 bg-[#0E1017] divide-y divide-border/60 overflow-hidden shadow-xs">
            {/* Row 1: Hide officer PINs */}
            <div className="p-4 sm:px-5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-white">Hide officer PINs</div>
                <div className="text-xs text-zinc-400">
                  Mask PINs in the directory until a controller chooses to reveal one.
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={settings.hideOfficerPins}
                onClick={() => handleToggle('hideOfficerPins')}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  settings.hideOfficerPins ? 'bg-[#3B82F6]' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out ${
                    settings.hideOfficerPins ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Row 2: Session timeout */}
            <div className="p-4 sm:px-5 flex items-center justify-between gap-4">
              <div className="space-y-0.5">
                <div className="text-sm font-semibold text-white">Session timeout</div>
                <div className="text-xs text-zinc-400">
                  Sign out controllers after inactivity.
                </div>
              </div>
              <div className="relative shrink-0">
                <select
                  value={settings.sessionTimeout}
                  onChange={(e) => handleChange('sessionTimeout', e.target.value)}
                  className="appearance-none bg-[#141824] hover:bg-[#1A1F30] border border-border text-xs text-white font-medium rounded-xl px-3.5 py-2 pr-8 focus:outline-hidden focus:border-brand cursor-pointer transition"
                >
                  <option value="15 minutes">15 minutes</option>
                  <option value="30 minutes">30 minutes</option>
                  <option value="1 hour">1 hour</option>
                  <option value="4 hours">4 hours</option>
                  <option value="Never">Never</option>
                </select>
                <ChevronDown className="size-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/60">
          <button
            type="button"
            onClick={handleReset}
            className="px-4 py-2 rounded-xl border border-slate-700 bg-[#121626] hover:bg-[#181D2E] text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer flex items-center gap-1.5"
          >
            <RotateCcw className="size-3.5 text-slate-400" />
            <span>Reset to defaults</span>
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] active:bg-[#1E40AF] text-white text-xs font-bold shadow-lg shadow-blue-900/30 transition cursor-pointer flex items-center gap-1.5"
          >
            {isSaved ? (
              <>
                <CheckCircle2 className="size-3.5 text-white" />
                <span>Saved!</span>
              </>
            ) : (
              <span>Save changes</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
