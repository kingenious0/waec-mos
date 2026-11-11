'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  Building2,
  CheckCircle2,
  Search,
  MapPin,
  Loader2,
  ChevronDown,
  LocateFixed,
} from 'lucide-react'
import type { ExamCenter } from '@/components/admin/FleetMap'

export interface DistrictOption {
  id: string
  name: string
  code: string
  regionId: string
}

export interface ExamCenterFormPayload {
  id?: string
  name: string
  code: string
  lat: number
  lng: number
  radius: number
  districtId: string
  supervisorContact: string
}

interface SchoolSuggestion {
  id: number
  name: string
  display: string
  lat: number
  lng: number
  address?: Record<string, string>
}

interface ExamCenterModalProps {
  isOpen: boolean
  mode: 'create' | 'edit'
  initialCenter?: ExamCenter | null
  districts: DistrictOption[]
  defaultRadius?: number
  onClose: () => void
  onSubmit: (payload: ExamCenterFormPayload) => Promise<void>
}

const NOISE_WORDS = new Set([
  'district',
  'municipal',
  'metropolitan',
  'borough',
  'assembly',
  'education',
  'constituency',
])

/**
 * Best-effort match of a geocoded address against the configured district
 * list, e.g. Nominatim's "Kumasi, Ashanti Region" → "Kumasi Metropolitan".
 */
function matchDistrictId(
  display: string,
  address: Record<string, string> | undefined,
  districts: DistrictOption[]
): string | null {
  if (districts.length === 0) return null
  const haystack = [display, ...Object.values(address || {})]
    .join(' ')
    .toLowerCase()
  if (!haystack.trim()) return null

  let best: { id: string; score: number } | null = null
  for (const d of districts) {
    const words = d.name
      .toLowerCase()
      .split(/[\s,-]+/)
      .filter((w) => w.length > 3 && !NOISE_WORDS.has(w))
    if (words.length === 0) continue
    let score = 0
    for (const w of words) {
      if (haystack.includes(w)) score += 1
    }
    if (score > 0 && (!best || score > best.score)) best = { id: d.id, score }
  }
  return best ? best.id : null
}

/** "Amaniampong SHS Center A" → "Amaniampong SHS" for fallback geocoding. */
function stripCenterSuffix(query: string): string {
  return query
    .replace(
      /\b(center|centre|hall|block|site|campus|assembly|gate|annex|form\s*[\d]+|[\d]+)\b.*$/i,
      ''
    )
    .replace(/\s+/g, ' ')
    .trim()
}

export function ExamCenterModal({
  isOpen,
  mode,
  initialCenter,
  districts,
  defaultRadius = 150,
  onClose,
  onSubmit,
}: ExamCenterModalProps) {
  const [mounted, setMounted] = useState(false)
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [lat, setLat] = useState('6.7028')
  const [lng, setLng] = useState('-1.6369')
  const [radius, setRadius] = useState(String(defaultRadius))
  const [districtId, setDistrictId] = useState('')
  const [supervisorContact, setSupervisorContact] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')

  // School search (Nominatim, Ghana-only)
  const [suggestions, setSuggestions] = useState<SchoolSuggestion[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [searchNotice, setSearchNotice] = useState('')
  const [districtAuto, setDistrictAuto] = useState(false)
  const [coordsAuto, setCoordsAuto] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  // Map refs
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const circleRef = useRef<any>(null)
  const leafletRef = useRef<any>(null)
  const flyTargetRef = useRef<{ lat: number; lng: number } | null>(null)
  const posRef = useRef({ lat: 6.6924, lng: -1.6241, radius: 150 })
  const lastPickedQueryRef = useRef('')
  const searchAbortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Keep the latest coordinates available to the async map initializer
  useEffect(() => {
    const la = Number(lat)
    const ln = Number(lng)
    const r = Number(radius)
    posRef.current = {
      lat: Number.isNaN(la) ? 6.6924 : la,
      lng: Number.isNaN(ln) ? -1.6241 : ln,
      radius: Number.isNaN(r) || r <= 0 ? defaultRadius : r,
    }
  }, [lat, lng, radius, defaultRadius])

  // Reset the form ONLY when the modal is opened for a different center/mode.
  // The dashboard polls /api/centers in the background and replaces the
  // `districts` array with a new reference on every poll — that must never
  // re-run this initializer, otherwise typed input gets wiped mid-edit.
  const initKeyRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isOpen) {
      initKeyRef.current = null
      lastPickedQueryRef.current = ''
      setSuggestions([])
      setSearchNotice('')
      setDistrictAuto(false)
      setCoordsAuto(false)
      setShowAdvanced(false)
      return
    }
    const initKey = `${mode}:${initialCenter?.id || 'create'}:${initialCenter?.name || ''}`
    if (initKeyRef.current === initKey) return
    initKeyRef.current = initKey

    setError('')
    setIsSubmitting(false)
    if (mode === 'edit' && initialCenter) {
      setName(initialCenter.name)
      setCode(initialCenter.code)
      setLat(String(initialCenter.lat))
      setLng(String(initialCenter.lng))
      setRadius(String(initialCenter.radius || defaultRadius))
      setDistrictId(initialCenter.districtId || districts[0]?.id || 'dist-kumasi-metro')
      setSupervisorContact(initialCenter.supervisorContact || '')
      setCoordsAuto(false)
    } else {
      setName('')
      setCode('')
      setLat('6.6924')
      setLng('-1.6241')
      setRadius(String(defaultRadius))
      setDistrictId(districts[0]?.id || 'dist-kumasi-metro')
      setSupervisorContact('')
      setCoordsAuto(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, mode, initialCenter])

  // Backfill the district selection once options arrive (fresh open only) —
  // intentionally excludes typed fields so polling never clears them.
  useEffect(() => {
    if (!isOpen || districtId || districts.length === 0) return
    setDistrictId(districts[0].id)
  }, [isOpen, districtId, districts])

  /* ------------------------------------------------------------------ */
  /* School search against OpenStreetMap Nominatim (Ghana only)          */
  /* ------------------------------------------------------------------ */
  const runGeocode = useCallback(async (query: string, signal: AbortSignal) => {
    const url =
      'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&countrycodes=gh&q=' +
      encodeURIComponent(query)
    const res = await fetch(url, { signal })
    if (!res.ok) throw new Error(`geocode ${res.status}`)
    const json = await res.json()
    return Array.isArray(json) ? json : []
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const query = name.trim()
    searchAbortRef.current?.abort()
    if (query.length < 3 || query === lastPickedQueryRef.current) {
      setSuggestions([])
      if (query.length < 3) setSearchNotice('')
      return
    }

    const controller = new AbortController()
    searchAbortRef.current = controller
    const timer = setTimeout(async () => {
      setIsSearching(true)
      setSearchNotice('')
      try {
        let results = await runGeocode(query, controller.signal)
        if (results.length === 0) {
          const cleaned = stripCenterSuffix(query)
          if (cleaned && cleaned !== query && cleaned.length >= 3) {
            results = await runGeocode(cleaned, controller.signal)
          }
        }
        if (controller.signal.aborted) return
        const mapped: SchoolSuggestion[] = results.map((r: any) => ({
          id: r.place_id,
          name: r.name || String(r.display_name).split(',')[0],
          display: r.display_name,
          lat: parseFloat(r.lat),
          lng: parseFloat(r.lon),
          address: r.address,
        }))
        setSuggestions(mapped)
        if (mapped.length === 0) {
          setSearchNotice(
            'No Ghana match found — drag the pin on the map to place it manually.'
          )
        }
      } catch (err: any) {
        if (err?.name === 'AbortError') return
        setSearchNotice('Search unavailable — place the pin on the map instead.')
      } finally {
        if (!controller.signal.aborted) setIsSearching(false)
      }
    }, 450)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [name, isOpen, runGeocode])

  const pickSchool = useCallback(
    (school: SchoolSuggestion) => {
      lastPickedQueryRef.current = name.trim()
      setLat(school.lat.toFixed(6))
      setLng(school.lng.toFixed(6))
      setCoordsAuto(true)
      flyTargetRef.current = { lat: school.lat, lng: school.lng }
      const matched = matchDistrictId(school.display, school.address, districts)
      if (matched) {
        setDistrictId(matched)
        setDistrictAuto(true)
      }
      setSuggestions([])
      setSearchNotice('')
    },
    [name, districts]
  )

  /* ------------------------------------------------------------------ */
  /* Embedded Leaflet map with draggable pin + live geofence circle      */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    if (!isOpen || !mounted) return
    let cancelled = false

    ;(async () => {
      const L = (await import('leaflet')).default
      if (cancelled || !containerRef.current || mapRef.current) return

      const map = L.map(containerRef.current, {
        center: [posRef.current.lat, posRef.current.lng],
        zoom: 15,
        zoomControl: true,
        attributionControl: false,
        scrollWheelZoom: true,
      })
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
      }).addTo(map)

      const pinIcon = L.divIcon({
        className: 'center-pin',
        html: `<div style="
          width:16px;height:16px;
          border-radius:50% 50% 50% 0;
          transform:rotate(-45deg);
          background:#F6D300;
          border:2px solid #0C0F17;
          box-shadow:0 0 12px rgba(246,211,0,0.75);
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 16],
      })

      const marker = L.marker([posRef.current.lat, posRef.current.lng], {
        icon: pinIcon,
        draggable: true,
      }).addTo(map)

      const circle = L.circle([posRef.current.lat, posRef.current.lng], {
        radius: posRef.current.radius,
        color: '#0284c7',
        weight: 2,
        opacity: 0.9,
        fillColor: '#0284c7',
        fillOpacity: 0.18,
        dashArray: '5, 5',
      }).addTo(map)

      const commit = (lla: number, ln: number) => {
        setLat(lla.toFixed(6))
        setLng(ln.toFixed(6))
        setCoordsAuto(false)
      }

      marker.on('dragend', () => {
        const p = marker.getLatLng()
        commit(p.lat, p.lng)
      })
      map.on('click', (e: any) => {
        marker.setLatLng(e.latlng)
        circle.setLatLng(e.latlng)
        commit(e.latlng.lat, e.latlng.lng)
      })

      leafletRef.current = L
      mapRef.current = map
      markerRef.current = marker
      circleRef.current = circle

      map.setView([posRef.current.lat, posRef.current.lng], 15)
      const fly = flyTargetRef.current
      if (fly) {
        flyTargetRef.current = null
        map.flyTo([fly.lat, fly.lng], 16, { duration: 0.9 })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen, mounted])

  // Tear the map down when the modal closes (container unmounts)
  useEffect(() => {
    if (isOpen) return
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
      markerRef.current = null
      circleRef.current = null
      leafletRef.current = null
    }
  }, [isOpen])

  // Keep pin + geofence circle in sync with typed/dragged values
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !circleRef.current) return
    const la = Number(lat)
    const ln = Number(lng)
    const r = Number(radius)
    if (!Number.isNaN(la) && !Number.isNaN(ln)) {
      markerRef.current.setLatLng([la, ln])
      circleRef.current.setLatLng([la, ln])
    }
    if (!Number.isNaN(r) && r > 0) {
      circleRef.current.setRadius(r)
    }
  }, [lat, lng, radius])

  if (!isOpen || !mounted) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const parsedLat = Number(lat)
    const parsedLng = Number(lng)
    const parsedRadius = Number(radius)

    if (!name.trim() || !code.trim()) {
      setError('Center name and index code are required.')
      return
    }
    if (Number.isNaN(parsedLat) || Number.isNaN(parsedLng)) {
      setError('Locate the center on the map or enter valid coordinates.')
      return
    }
    if (Number.isNaN(parsedRadius) || parsedRadius < 25) {
      setError('Geofence radius must be at least 25 meters.')
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        id: mode === 'edit' ? initialCenter?.id : undefined,
        name: name.trim(),
        code: code.trim(),
        lat: parsedLat,
        lng: parsedLng,
        radius: Math.round(parsedRadius),
        districtId,
        supervisorContact: supervisorContact.trim(),
      })
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to save examination center.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault()
      pickSchool(suggestions[0])
    }
  }

  const selectedDistrict = districts.find((d) => d.id === districtId)

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/85 p-3 sm:p-5 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl overflow-hidden rounded-3xl border border-[#22263C] bg-[#0E111D] text-slate-100 shadow-[0_25px_80px_rgba(0,0,0,0.95)] select-none font-sans max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-[#1E2B7B] border border-[#F6D300]/30 flex items-center justify-center text-[#F6D300]">
              <Building2 className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-white">
                {mode === 'edit' ? 'Edit Examination Center' : 'Register Examination Center'}
              </h2>
              <p className="text-xs text-slate-400">
                Search the school — location &amp; district fill in automatically
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-full bg-[#181D2E] text-slate-400 hover:text-white hover:bg-[#222942] transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-4">
          <div className="rounded-2xl border border-[#22263C] bg-[#121626] p-4 space-y-3.5">
            {error && (
              <div className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
                {error}
              </div>
            )}

            {/* CENTER NAME + LIVE SCHOOL SEARCH */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Center Name <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                  {isSearching ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Search className="size-3.5" />
                  )}
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  placeholder="e.g. Amaniampong SHS Center A"
                  className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] pl-9 pr-3 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-sky-400"
                />

                {suggestions.length > 0 && (
                  <ul className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-[#22263C] bg-[#121626] shadow-[0_20px_50px_rgba(0,0,0,0.85)] divide-y divide-[#1C2237]">
                    {suggestions.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          onClick={() => pickSchool(s)}
                          className="flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-[#181D2E] cursor-pointer"
                        >
                          <MapPin className="size-3.5 mt-0.5 shrink-0 text-sky-400" />
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-semibold text-white">
                              {s.name}
                            </span>
                            <span className="block truncate text-[10px] text-slate-500">
                              {s.display}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {searchNotice && (
                  <p className="mt-1.5 text-[10px] leading-relaxed text-amber-400/85">
                    {searchNotice}
                  </p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Index Code <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="050412"
                  className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3.5 py-2.5 text-xs text-[#F6D300] font-bold placeholder:text-slate-500 focus:outline-hidden focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                  <span>District</span>
                  {districtAuto && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-400">
                      AUTO-MATCHED
                    </span>
                  )}
                </label>
                <select
                  value={districtId}
                  onChange={(e) => {
                    setDistrictId(e.target.value)
                    setDistrictAuto(false)
                  }}
                  className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3.5 py-2.5 text-xs text-white focus:outline-hidden focus:border-sky-400 cursor-pointer"
                >
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                  {districts.length === 0 && (
                    <option value="dist-kumasi-metro">Kumasi Metropolitan</option>
                  )}
                </select>
              </div>
            </div>

            {/* EMBEDDED MAP: pin + live geofence preview */}
            <div className="overflow-hidden rounded-xl border border-[#22263C]">
              <div ref={containerRef} className="h-[230px] w-full bg-[#0A0D17]" />
              <div className="flex items-center justify-between gap-2 border-t border-[#1C2237] bg-[#0A0D17] px-3 py-2">
                <span className="flex items-center gap-1.5 text-[10px] text-slate-500">
                  <MapPin className="size-3 text-slate-500" />
                  Drag the pin or click the map to fine-tune
                </span>
                <span
                  className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold ${
                    coordsAuto
                      ? 'border border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                      : 'border border-[#22263C] bg-[#121626] text-slate-400'
                  }`}
                >
                  {coordsAuto ? 'AUTO-LOCATED' : 'PIN SET'}
                </span>
              </div>
            </div>

            {/* Collapsed fine-tune coordinates */}
            <div className="rounded-xl border border-[#1E243A] bg-[#0A0D17]/70 px-3 py-2">
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex w-full cursor-pointer items-center justify-between text-xs font-semibold text-slate-400 transition hover:text-slate-200"
              >
                <span className="flex items-center gap-1.5">
                  <LocateFixed className="size-3.5" />
                  <span>Fine-tune coordinates</span>
                </span>
                <ChevronDown
                  className={`size-3.5 transition-transform ${showAdvanced ? 'rotate-180' : ''}`}
                />
              </button>
              {showAdvanced && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                      Latitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={lat}
                      onChange={(e) => {
                        setLat(e.target.value)
                        setCoordsAuto(false)
                      }}
                      className="w-full rounded-lg border border-[#22263C] bg-[#0A0D17] px-3 py-2 text-xs text-white focus:outline-hidden focus:border-sky-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-semibold text-slate-500 mb-1">
                      Longitude
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={lng}
                      onChange={(e) => {
                        setLng(e.target.value)
                        setCoordsAuto(false)
                      }}
                      className="w-full rounded-lg border border-[#22263C] bg-[#0A0D17] px-3 py-2 text-xs text-white focus:outline-hidden focus:border-sky-400"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Radius (m)
                </label>
                <input
                  type="number"
                  min={25}
                  max={2000}
                  required
                  value={radius}
                  onChange={(e) => setRadius(e.target.value)}
                  className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3 py-2.5 text-xs text-sky-400 font-bold focus:outline-hidden focus:border-sky-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Center Supervisor Contact
                </label>
                <input
                  type="tel"
                  value={supervisorContact}
                  onChange={(e) => setSupervisorContact(e.target.value)}
                  placeholder="+233 24 000 0000"
                  className="w-full rounded-xl border border-[#22263C] bg-[#0A0D17] px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-sky-400"
                />
              </div>
            </div>

            {selectedDistrict && districtAuto && (
              <p className="text-[10px] text-slate-500">
                District auto-filled from the school&apos;s geocoded address — adjust above if
                needed.
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl border border-[#22263C] bg-[#121626] hover:bg-[#181D2E] text-xs font-semibold text-slate-300 hover:text-white transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-[#1E2B7B] hover:bg-[#28389E] border border-[#F6D300]/40 disabled:opacity-60 text-xs font-bold text-white shadow-lg transition cursor-pointer flex items-center gap-1.5"
            >
              <CheckCircle2 className="size-3.5 text-[#F6D300]" />
              <span>{isSubmitting ? 'Saving...' : mode === 'edit' ? 'Save Center Changes' : 'Register Center'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
