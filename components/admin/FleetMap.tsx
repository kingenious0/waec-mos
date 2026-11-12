'use client'

import React, { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { Plus, Minus, Crosshair, Users, Layers, Map as MapIcon, Satellite, Check } from 'lucide-react'

export interface OfficerCheckpoint {
  id: string
  action: string
  label: string
  time: string
  iso?: string | null
  tone: 'critical' | 'ok' | 'info'
}

export interface FleetOfficer {
  id: string
  name: string
  phone: string
  staffId: string
  group: string
  isLeader?: boolean
  accountStatus?: string
  assignedCenter: string
  centerCode: string
  centerRadius?: number
  status: 'ON_SITE' | 'PENDING' | 'SOS'
  assignmentStatus?: string
  verifiedTime?: string
  distanceFromDatum: number | null // meters, null if no telemetry ping yet
  battery: number | null
  speedKmh?: number | null
  accuracyMeters?: number | null
  lastPingAt?: string | null
  hasLiveTelemetry?: boolean
  isOnline?: boolean
  lat: number
  lng: number
  sosDetails?: string
  sosIncidentId?: string
  sosIncidentNumber?: string
  sosStatus?: string
  checkpoints?: OfficerCheckpoint[]
}

export interface ExamCenter {
  id?: string
  name: string
  code: string
  lat: number
  lng: number
  radius: number
  depotLocked: boolean
  totalMonitors: number
  onSiteMonitors?: number
  openIncidentsCount?: number
  supervisorContact?: string
  districtId?: string
  districtName?: string
  regionName?: string
}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }
  return value.replace(/[&<>"']/g, (ch) => entities[ch])
}

/**
 * The point with the most other points within ~40 km. Used to frame a tight,
 * readable default view when centers are spread far apart (e.g. Kumasi vs
 * Winneba) — fitting everything just zooms out to a useless country view.
 */
function densestCluster<T extends { lat: number; lng: number }>(points: T[]): T {
  let best = points[0]
  let bestCount = -1
  for (const p of points) {
    let count = 0
    for (const q of points) {
      const dx = (q.lng - p.lng) * 111.32 * Math.cos((p.lat * Math.PI) / 180)
      const dy = (q.lat - p.lat) * 110.57
      if (Math.hypot(dx, dy) <= 40) count++
    }
    if (count > bestCount) {
      bestCount = count
      best = p
    }
  }
  return best
}

/** Telemetry older than 5 minutes renders as a grey hollow dot. */
const STALE_TELEMETRY_MS = 5 * 60 * 1000
function isTelemetryStale(officer: Pick<FleetOfficer, 'lastPingAt'>): boolean {
  if (!officer.lastPingAt) return true
  const ts = Date.parse(officer.lastPingAt)
  if (Number.isNaN(ts)) return true
  return Date.now() - ts > STALE_TELEMETRY_MS
}

export function getOfficerUnitCode(officer: Pick<FleetOfficer, 'staffId' | 'name' | 'id'>): string {
  const parts = (officer.staffId || '').split('-').filter(Boolean)
  const tail = parts[parts.length - 1]
  if (tail && /^\d+$/.test(tail)) {
    return tail
  }
  const initials = (officer.name || '')
    .split(' ')
    .filter(Boolean)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
  return initials || officer.id.slice(-2).toUpperCase()
}

interface FleetMapProps {
  officers: FleetOfficer[]
  centers: ExamCenter[]
  selectedOfficer: FleetOfficer | null
  onSelectOfficer: (officer: FleetOfficer | null) => void
  onCallOfficer: (phone: string) => void
  onNavigate: (lat: number, lng: number) => void
  focusTarget: { lat: number; lng: number; zoom?: number } | null
  activeSectorName?: string
  statusFilter?: 'all' | 'onsite' | 'enroute' | 'sos'
  onStatusFilterChange?: (filter: 'all' | 'onsite' | 'enroute' | 'sos') => void
}

export default function FleetMap({
  officers,
  centers,
  selectedOfficer,
  onSelectOfficer,
  focusTarget,
  activeSectorName = 'Ashanti Regional Zone',
  statusFilter = 'all',
  onStatusFilterChange,
}: FleetMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)
  const centersLayerRef = useRef<any>(null)
  const officersLayerRef = useRef<any>(null)
  const trailLayerRef = useRef<any>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapMode, setMapMode] = useState<'map' | 'satellite'>('map')
  const [legendOpen, setLegendOpen] = useState(false)
  const [layersOpen, setLayersOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const update = () => setIsDesktop(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  // Default framing is intentionally tight: exam centres sit close together
  // across Kumasi, so a wider view just scatters the labels off-screen.
  const BASE_ZOOM = 14
  const SATELLITE_MIN_ZOOM = 15

  const createTileLayer = (L: any, mode: 'map' | 'satellite') => {
    if (mode === 'satellite') {
      return L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: '&copy; Esri, Maxar, Earthstar Geographics',
        }
      )
    }

    // CARTO dark matter tiles — matches the console's dark theme
    return L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c', 'd'],
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>',
    })
  }

  // Initialize Leaflet map once
  useEffect(() => {
    let isCancelled = false

    async function initMap() {
      if (!mapContainerRef.current) return
      const L = (await import('leaflet')).default
      await import('leaflet.markercluster')
      if (isCancelled || !mapContainerRef.current || mapInstanceRef.current) return

      const map = L.map(mapContainerRef.current, {
        center: [6.6924, -1.6241],
        zoom: BASE_ZOOM,
        zoomControl: false,
        attributionControl: false,
      })

      tileLayerRef.current = createTileLayer(L, mapMode).addTo(map)
      centersLayerRef.current = L.layerGroup().addTo(map)

      // Officer markers cluster when they overlap; unclustered from zoom 15 up
      // so a selected officer's label is always visible after the fly-to.
      officersLayerRef.current = L.markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        maxClusterRadius: 45,
        disableClusteringAtZoom: 15,
        iconCreateFunction: (cluster: any) =>
          L.divIcon({
            html: `<div style="
              width: 40px; height: 40px; border-radius: 9999px;
              background: rgba(10, 13, 23, 0.92);
              border: 1.5px solid rgba(56, 189, 248, 0.5);
              color: #E2E8F0;
              display: flex; align-items: center; justify-content: center;
              font-family: var(--font-sans), system-ui, sans-serif;
              font-size: 12px; font-weight: 800;
              box-shadow: 0 4px 14px rgba(0,0,0,0.6);
            ">${cluster.getChildCount()}</div>`,
            className: 'waec-cluster-icon',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
          }),
      })
      map.addLayer(officersLayerRef.current)
      trailLayerRef.current = L.layerGroup().addTo(map)

      mapInstanceRef.current = map
      setMapLoaded(true)
    }

    initMap()

    return () => {
      isCancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
      centersLayerRef.current = null
      officersLayerRef.current = null
      trailLayerRef.current = null
      setMapLoaded(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Handle Map / Satellite mode toggle without rebuilding map
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return
    import('leaflet').then((leafletModule) => {
      if (!mapInstanceRef.current) return
      const L = leafletModule.default
      if (tileLayerRef.current) {
        mapInstanceRef.current.removeLayer(tileLayerRef.current)
      }
      tileLayerRef.current = createTileLayer(L, mapMode).addTo(mapInstanceRef.current)

      // Satellite imagery reads much better a notch closer in — nudge the
      // view tighter when switching, but never yank a zoomed-out map back.
      const targetZoom = mapMode === 'satellite' ? SATELLITE_MIN_ZOOM : BASE_ZOOM
      if (mapInstanceRef.current.getZoom() < targetZoom) {
        mapInstanceRef.current.setZoom(targetZoom, { animate: true })
      }
    })
  }, [mapMode, mapLoaded])

  // Render / update Examination Center geofence circles smoothly when centers change
  useEffect(() => {
    if (!mapInstanceRef.current || !centersLayerRef.current || !mapLoaded) return
    import('leaflet').then((leafletModule) => {
      if (!centersLayerRef.current) return
      const L = leafletModule.default
      const group = centersLayerRef.current
      group.clearLayers()

      centers.forEach((center) => {
        if (Number.isNaN(center.lat) || Number.isNaN(center.lng)) return

        if (!isDesktop) {
          // Mobile: small yellow pin + dashed yellow geofence, no name pills
          L.circle([center.lat, center.lng], {
            radius: center.radius,
            color: '#F6D300',
            weight: 1.5,
            opacity: 0.85,
            fillColor: '#F6D300',
            fillOpacity: 0.08,
            dashArray: '6, 7',
          }).addTo(group)

          const pinIcon = L.divIcon({
            className: 'custom-center-marker',
            html: `<div style="
              width: 14px; height: 14px; border-radius: 50%;
              background: #F6D300; border: 2.5px solid #0C0F17;
              box-shadow: 0 0 0 1px rgba(246,211,0,0.6), 0 2px 6px rgba(0,0,0,0.6);
            "></div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          })
          const pin = L.marker([center.lat, center.lng], { icon: pinIcon })
          pin.on('click', () => {
            mapInstanceRef.current?.flyTo([center.lat, center.lng], 16, { duration: 0.8 })
          })
          pin.addTo(group)
          return
        }

        const hasBreach = (center.openIncidentsCount || 0) > 0
        const color = hasBreach ? '#EF4444' : '#38bdf8'

        L.circle([center.lat, center.lng], {
          radius: center.radius,
          color,
          weight: 2,
          opacity: 0.9,
          fillColor: color,
          fillOpacity: 0.2,
          dashArray: '5, 5',
        }).addTo(group)

        const shortName =
          center.name.length > 28 ? `${center.name.slice(0, 27).trimEnd()}…` : center.name

        // Auto-width pill: `width: max-content` is critical — Leaflet sets the
        // icon wrapper to width:0 (iconSize [0,0]), which otherwise collapses
        // the flex row and squeezes the name span out of existence.
        const centerIcon = L.divIcon({
          className: 'custom-center-marker',
          html: `
            <div style="
              transform: translate(-50%, -50%);
              width: max-content;
              display: flex;
              align-items: center;
              gap: 6px;
              background: rgba(10, 13, 23, 0.92);
              border: 1px solid ${hasBreach ? 'rgba(239, 68, 68, 0.55)' : 'rgba(56, 189, 248, 0.35)'};
              color: #E2E8F0;
              padding: 4px 9px;
              border-radius: 9999px;
              font-family: var(--font-sans), system-ui, -apple-system, sans-serif;
              font-size: 11px;
              font-weight: 700;
              white-space: nowrap;
              box-shadow: 0 6px 18px rgba(0,0,0,0.55);
              backdrop-filter: blur(6px);
            ">
              <span style="
                display:inline-block; width:7px; height:7px; border-radius:50%;
                background:${hasBreach ? '#EF4444' : '#38bdf8'};
                box-shadow: 0 0 7px ${hasBreach ? '#EF4444' : '#38bdf8'};
                flex-shrink: 0;
              "></span>
              <span style="flex-shrink: 0;">${escapeHtml(shortName)}</span>
              <span style="
                color:${hasBreach ? '#FCA5A5' : '#38bdf8'};
                background:${hasBreach ? 'rgba(239,68,68,0.12)' : 'rgba(56,189,248,0.12)'};
                border:1px solid ${hasBreach ? 'rgba(239,68,68,0.3)' : 'rgba(56,189,248,0.28)'};
                border-radius:6px;
                padding:1px 5px;
                font-size:9px;
                font-weight:800;
                letter-spacing:0.05em;
                flex-shrink:0;
              ">${escapeHtml(center.code)}</span>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        })

        // Clicking a center flies straight into it
        const marker = L.marker([center.lat, center.lng], { icon: centerIcon })
        marker.on('click', () => {
          mapInstanceRef.current?.flyTo([center.lat, center.lng], 16, { duration: 0.8 })
        })
        marker.addTo(group)
      })
    })
  }, [centers, mapLoaded, isDesktop])

  // Frame the map sensibly on first load: fit the bounds of the dominant
  // region (the region most centers belong to — effectively the user's
  // region), never outlier centers or officers. If centers are spread too far
  // apart within that region, tighten onto the densest cluster instead.
  const getValidCenters = () =>
    centers.filter((c) => !Number.isNaN(c.lat) && !Number.isNaN(c.lng))

  const frameDefaultView = async (animate: boolean) => {
    const map = mapInstanceRef.current
    if (!map) return
    const L = (await import('leaflet')).default
    if (!mapInstanceRef.current) return

    const valid = getValidCenters()
    if (valid.length === 0) {
      map.setView([6.6924, -1.6241], BASE_ZOOM, { animate })
      return
    }

    // Dominant region = the one holding the most centers (e.g. Ashanti) —
    // outliers in other regions (Winneba, etc.) stay out of the initial frame.
    const byRegion = new Map<string, typeof valid>()
    for (const c of valid) {
      const key = (c.regionName || 'Other').trim()
      const bucket = byRegion.get(key)
      if (bucket) bucket.push(c)
      else byRegion.set(key, [c])
    }
    const dominant = [...byRegion.values()].sort((a, b) => b.length - a.length)[0]
    const target = dominant.length >= 1 ? dominant : valid

    const padding: [number, number] = [70, 70]
    const bounds = L.latLngBounds(target.map((c) => [c.lat, c.lng]))
    const fitZoom = Math.min(map.getBoundsZoom(bounds, false, padding), 15)

    if (fitZoom >= 11 || target.length === 1) {
      map.fitBounds(bounds, { padding, maxZoom: 15, animate })
    } else {
      const hub = densestCluster(target)
      map.setView([hub.lat, hub.lng], BASE_ZOOM, { animate })
    }
  }

  const didInitialFitRef = useRef(false)
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || didInitialFitRef.current) return
    if (getValidCenters().length === 0) return
    didInitialFitRef.current = true
    void frameDefaultView(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centers, mapLoaded])

  // Track how many centers are inside the current viewport so we can offer a
  // "Show all" chip when some are parked outside the tight default view.
  const [viewStats, setViewStats] = useState({ visible: 0, total: 0 })
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map || !mapLoaded) return
    let disposed = false
    let handler: (() => void) | null = null

    import('leaflet').then((leafletModule) => {
      if (disposed || !mapInstanceRef.current) return
      const L = leafletModule.default
      handler = () => {
        const m = mapInstanceRef.current
        if (!m) return
        const valid = centers.filter((c) => !Number.isNaN(c.lat) && !Number.isNaN(c.lng))
        const bounds = m.getBounds()
        const visible = valid.filter((c) => bounds.contains(L.latLng(c.lat, c.lng))).length
        setViewStats({ visible, total: valid.length })
      }
      map.on('moveend', handler)
      handler()
    })

    return () => {
      disposed = true
      if (handler) map.off('moveend', handler)
    }
  }, [centers, mapLoaded])

  // Render / update Officer Markers & Active Corridor Trail without touching tile/center layers
  useEffect(() => {
    if (!mapInstanceRef.current || !officersLayerRef.current || !mapLoaded) return

    import('leaflet').then((leafletModule) => {
      if (!officersLayerRef.current) return
      const L = leafletModule.default
      const group = officersLayerRef.current
      group.clearLayers()

      // 14px status dots with a white ring; grey hollow when telemetry is stale.
      const visibleOfficers = officers.filter((officer) => {
        if (statusFilter === 'onsite') return officer.status === 'ON_SITE'
        if (statusFilter === 'enroute') return officer.status === 'PENDING'
        if (statusFilter === 'sos') return officer.status === 'SOS'
        return true
      })
      const markers: any[] = []
      visibleOfficers.forEach((officer) => {
        const isSelected = selectedOfficer?.id === officer.id
        const isSos = officer.status === 'SOS'
        const isOnSite = officer.status === 'ON_SITE'
        const stale = isTelemetryStale(officer)
        const unitId = getOfficerUnitCode(officer)
        const firstName = escapeHtml((officer.name || '').split(' ')[0] || '')
        const labelText = escapeHtml(`U-${unitId} `) + firstName

        let dotStyle =
          'background:#38bdf8;border:2px solid #FFFFFF;box-shadow:0 0 8px rgba(56,189,248,0.6);'
        if (isSos) {
          dotStyle = 'background:#EF4444;border:2px solid #FFFFFF;box-shadow:0 0 10px rgba(239,68,68,0.8);'
        } else if (stale) {
          // Grey hollow dot — telemetry older than 5 minutes
          dotStyle = 'background:#0C0F17;border:2px solid #94A3B8;box-shadow:none;'
        } else if (isOnSite) {
          dotStyle = 'background:#10B981;border:2px solid #FFFFFF;box-shadow:0 0 8px rgba(16,185,129,0.6);'
        }

        const labelBorder = isSelected
          ? 'border-color:#F6D300;color:#F6D300;box-shadow:0 0 16px rgba(246,211,0,0.45);'
          : isSos
          ? 'border-color:rgba(239,68,68,0.6);color:#FCA5A5;'
          : 'border-color:#22263C;color:#E2E8F0;'

        const markerHtml = `
          <div style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
            <div class="waec-officer-label${isSelected ? ' is-selected' : ''}" style="
              position:absolute; bottom:100%; left:50%; transform:translateX(-50%); margin-bottom:7px;
              background:#0C0F17; border:1px solid; padding:3px 9px; border-radius:9999px;
              font-family: var(--font-sans), system-ui, -apple-system, sans-serif;
              font-size:11px; font-weight:700; white-space:nowrap; z-index:5;
              ${labelBorder}
            ">${labelText}</div>
            <div style="position:relative;width:14px;height:14px;">
              ${
                isSos
                  ? `<div style="
                      position:absolute; inset:-7px; border-radius:50%;
                      background:rgba(239,68,68,0.45);
                      animation:ping 1.2s cubic-bezier(0,0,0.2,1) infinite;
                    "></div>`
                  : ''
              }
              <div style="width:14px;height:14px;border-radius:50%;position:relative;z-index:2;${dotStyle}"></div>
            </div>
          </div>
        `

        const icon = L.divIcon({
          className: 'waec-officer-marker',
          html: markerHtml,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })

        const marker = L.marker([officer.lat, officer.lng], { icon })
        marker.on('click', () => onSelectOfficer(officer))
        markers.push(marker)
      })

      group.addLayers(markers)

      // Corridor trail for the selected officer
      const trail = trailLayerRef.current
      if (trail) {
        trail.clearLayers()
        if (selectedOfficer) {
          const matchingCenter =
            centers.find(
              (c) => c.code === selectedOfficer.centerCode || c.name === selectedOfficer.assignedCenter
            ) || centers[0]

          if (matchingCenter) {
            L.polyline(
              [
                [selectedOfficer.lat, selectedOfficer.lng],
                [matchingCenter.lat, matchingCenter.lng],
              ],
              {
                color: selectedOfficer.status === 'SOS' ? '#ef4444' : '#bef264',
                weight: 2.5,
                opacity: 0.85,
                dashArray: '6, 8',
              }
            ).addTo(trail)
          }
        }
      }
    })
  }, [officers, selectedOfficer, centers, mapLoaded, onSelectOfficer, statusFilter])

  // Selecting an officer flies straight to them (zoom 15). Skip the very
  // first auto-selection on load so the region framing isn't yanked.
  const didInitialSelectionRef = useRef(false)
  useEffect(() => {
    const id = selectedOfficer?.id || null
    if (!id) return
    if (!didInitialSelectionRef.current) {
      didInitialSelectionRef.current = true
      return
    }
    if (!mapInstanceRef.current || !selectedOfficer) return
    mapInstanceRef.current.flyTo([selectedOfficer.lat, selectedOfficer.lng], 15, {
      duration: 0.9,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOfficer?.id])

  useEffect(() => {
    if (!mapInstanceRef.current || !focusTarget) return
    mapInstanceRef.current.flyTo([focusTarget.lat, focusTarget.lng], focusTarget.zoom || 15, {
      duration: 1.2,
    })
  }, [focusTarget])

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn()
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut()
  const handleResetView = () => {
    void frameDefaultView(true)
  }
  const handleShowAllCenters = () => {
    const map = mapInstanceRef.current
    if (!map) return
    const valid = getValidCenters()
    if (valid.length === 0) return
    import('leaflet').then((leafletModule) => {
      if (!mapInstanceRef.current) return
      const L = leafletModule.default
      mapInstanceRef.current.fitBounds(L.latLngBounds(valid.map((c) => [c.lat, c.lng])), {
        padding: [70, 70],
        maxZoom: 15,
        animate: true,
      })
    })
  }

  const handleFitAllOfficers = () => {
    const map = mapInstanceRef.current
    if (!map) return
    const valid = officers.filter((o) => !Number.isNaN(o.lat) && !Number.isNaN(o.lng))
    if (valid.length === 0) return
    import('leaflet').then((leafletModule) => {
      if (!mapInstanceRef.current) return
      const L = leafletModule.default
      mapInstanceRef.current.fitBounds(L.latLngBounds(valid.map((o) => [o.lat, o.lng])), {
        padding: [70, 70],
        maxZoom: 15,
        animate: true,
      })
    })
  }

  return (
    <div className="relative size-full min-h-[300px] overflow-hidden bg-[#090A0F] select-none font-sans">
      <div ref={mapContainerRef} className="size-full z-0" />

      {/* Mobile status filter chips */}
      <div className="lg:hidden absolute top-3 left-3 right-3 z-20 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {(
          [
            { id: 'all', label: `All ${officers.length}` },
            { id: 'onsite', label: `On site ${officers.filter((o) => o.status === 'ON_SITE').length}` },
            { id: 'enroute', label: `En route ${officers.filter((o) => o.status === 'PENDING').length}` },
            { id: 'sos', label: `SOS ${officers.filter((o) => o.status === 'SOS').length}` },
          ] as const
        ).map((chip) => {
          const isActive = statusFilter === chip.id
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onStatusFilterChange?.(chip.id)}
              className={`h-9 shrink-0 rounded-full border px-4 text-xs font-semibold transition cursor-pointer whitespace-nowrap backdrop-blur-md ${
                isActive
                  ? 'border-indigo-400/70 bg-indigo-500/25 text-indigo-200'
                  : 'border-[#2A3048] bg-[#0C0F17]/85 text-slate-300'
              }`}
            >
              {chip.label}
            </button>
          )
        })}
      </div>

      {/* Top-Left Floating Zone Status Pill — desktop only */}
      <div className="hidden lg:block absolute top-3.5 left-3.5 sm:top-4 sm:left-4 z-10 pointer-events-auto">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0C0F17]/90 border border-[#22263C] backdrop-blur-md shadow-xl text-xs font-sans">
          <span className="size-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_#34d399] animate-pulse" />
          <span className="font-semibold text-white tracking-tight">
            {activeSectorName}
          </span>
        </div>
      </div>

      {/* Top-Right Map / Satellite Switcher — desktop only (mobile uses Layers) */}
      <div className="hidden lg:block absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-10 pointer-events-auto">
        <div className="flex items-center rounded-full bg-[#0C0F17]/90 border border-[#22263C] p-1 backdrop-blur-md shadow-xl text-xs font-sans">
          <button
            type="button"
            onClick={() => setMapMode('map')}
            className={`px-3 py-1 rounded-full text-xs transition cursor-pointer ${
              mapMode === 'map'
                ? 'bg-[#1E2B7B] text-white font-bold shadow-xs'
                : 'text-slate-400 hover:text-white font-medium'
            }`}
          >
            Map
          </button>
          <button
            type="button"
            onClick={() => setMapMode('satellite')}
            className={`px-3 py-1 rounded-full text-xs transition cursor-pointer ${
              mapMode === 'satellite'
                ? 'bg-[#1E2B7B] text-white font-bold shadow-xs'
                : 'text-slate-400 hover:text-white font-medium'
            }`}
          >
            Satellite
          </button>
        </div>
      </div>

      {/* Bottom-Left Legend — collapsed into a button that opens a popover */}
      <div className="absolute bottom-6 left-3.5 sm:left-4 z-20 hidden md:block">
        {legendOpen && (
          <button
            type="button"
            aria-label="Close legend"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setLegendOpen(false)}
          />
        )}
        {legendOpen && (
          <div className="absolute bottom-full left-0 mb-2 z-20 flex flex-col gap-1.5 rounded-xl bg-[#0C0F17]/95 border border-[#22263C] px-3 py-2.5 backdrop-blur-md shadow-2xl font-sans w-52">
            <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-0.5">
              Map Legend
            </span>
            <LegendItem color="#10B981" label="Officer on site" />
            <LegendItem color="#38bdf8" label="Officer en route" />
            <LegendSosItem />
            <LegendStaleItem />
            <LegendItem color="#F6D300" label="Selected officer" />
            <LegendItem color="#38bdf8" label="Center geofence (radius)" dashed />
            <div className="flex items-center gap-2 text-[10px] font-medium text-slate-300 whitespace-nowrap">
              <span className="size-4 shrink-0 rounded-full border border-sky-400/50 bg-[#0C0F17] flex items-center justify-center text-[8px] font-extrabold text-sky-300">
                5
              </span>
              <span>Clustered officers</span>
            </div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setLegendOpen((v) => !v)}
          aria-expanded={legendOpen}
          className="relative z-20 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#0C0F17]/90 border border-[#22263C] backdrop-blur-md shadow-xl text-[11px] font-sans font-semibold text-slate-300 hover:text-white hover:border-slate-600 transition cursor-pointer"
        >
          <span className="flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            <span className="size-1.5 rounded-full bg-sky-400" />
            <span className="size-1.5 rounded-full bg-rose-500" />
          </span>
          Legend
        </button>
      </div>

      {/* Bottom-Center "centers outside view" chip — appears only when some
          centers are parked outside the tight default framing */}
      {viewStats.total > 0 && viewStats.visible < viewStats.total && (
        <div className="hidden md:block absolute bottom-6 left-1/2 -translate-x-1/2 z-10 pointer-events-auto">
          <button
            type="button"
            onClick={handleShowAllCenters}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0C0F17]/90 border border-sky-500/30 backdrop-blur-md shadow-xl text-[11px] font-sans cursor-pointer hover:border-sky-400/60 hover:bg-[#0C0F17] transition"
          >
            <span className="size-1.5 rounded-full bg-sky-400 shrink-0 shadow-[0_0_6px_#38bdf8]" />
            <span className="text-slate-300 font-medium whitespace-nowrap">
              {viewStats.visible} of {viewStats.total} centers in view
            </span>
            <span className="text-sky-400 font-bold whitespace-nowrap">Show all</span>
          </button>
        </div>
      )}

      {/* Bottom-Right Vertical Floating Tool Cluster */}
      <div className="absolute bottom-6 right-3.5 sm:bottom-6 sm:right-4 z-10 flex flex-col items-center gap-2 pointer-events-auto">
        <div className="hidden lg:flex flex-col rounded-xl bg-[#0C0F17]/90 border border-[#22263C] backdrop-blur-md shadow-2xl overflow-hidden divide-y divide-[#22263C]">
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label="Zoom in"
            className="p-2.5 text-slate-300 hover:text-white hover:bg-white/5 active:bg-white/10 transition cursor-pointer"
            title="Zoom in"
          >
            <Plus className="size-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            aria-label="Zoom out"
            className="p-2.5 text-slate-300 hover:text-white hover:bg-white/5 active:bg-white/10 transition cursor-pointer"
            title="Zoom out"
          >
            <Minus className="size-4" />
          </button>
        </div>

        {/* Layers — dark map / satellite */}
        <div className="relative">
          {layersOpen && (
            <>
              <button
                type="button"
                aria-label="Close layers"
                className="fixed inset-0 z-20 cursor-default"
                onClick={() => setLayersOpen(false)}
              />
              <div className="absolute right-full bottom-0 mr-2 z-30 w-44 overflow-hidden rounded-2xl border border-[#22263C] bg-[#0F121E] shadow-2xl py-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setMapMode('map')
                    setLayersOpen(false)
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-slate-200 hover:bg-white/5 hover:text-white transition cursor-pointer"
                >
                  <MapIcon className="size-4 shrink-0 text-slate-400" />
                  <span className="flex-1 text-left">Dark map</span>
                  {mapMode === 'map' && <Check className="size-4 text-indigo-300" />}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMapMode('satellite')
                    setLayersOpen(false)
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-medium text-slate-200 hover:bg-white/5 hover:text-white transition cursor-pointer"
                >
                  <Satellite className="size-4 shrink-0 text-slate-400" />
                  <span className="flex-1 text-left">Satellite</span>
                  {mapMode === 'satellite' && <Check className="size-4 text-indigo-300" />}
                </button>
              </div>
            </>
          )}
          <button
            type="button"
            onClick={() => setLayersOpen((v) => !v)}
            aria-label="Map layers"
            title="Map layers"
            aria-expanded={layersOpen}
            className="size-11 rounded-xl bg-[#0C0F17]/90 border border-[#22263C] text-slate-300 hover:text-white hover:bg-white/5 active:bg-white/10 flex items-center justify-center backdrop-blur-md shadow-2xl transition cursor-pointer"
          >
            <Layers className="size-4.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleFitAllOfficers}
          aria-label="Fit all officers"
          className="size-11 rounded-xl bg-[#0C0F17]/90 border border-[#22263C] text-slate-300 hover:text-white hover:bg-white/5 active:bg-white/10 flex items-center justify-center backdrop-blur-md shadow-2xl transition cursor-pointer"
          title="Fit all officers"
        >
          <Users className="size-4.5" />
        </button>

        <button
          type="button"
          onClick={handleResetView}
          aria-label="Center view"
          className="size-11 rounded-xl bg-[#0C0F17]/90 border border-[#22263C] text-slate-300 hover:text-white hover:bg-white/5 active:bg-white/10 flex items-center justify-center backdrop-blur-md shadow-2xl transition cursor-pointer"
          title="Recenter Map"
        >
          <Crosshair className="size-4.5" />
        </button>
      </div>
    </div>
  )
}

function LegendItem({
  color,
  label,
  dashed,
}: {
  color: string
  label: string
  dashed?: boolean
}) {
  return (
    <div className="flex items-center gap-2 text-[10px] font-medium text-slate-300 whitespace-nowrap">
      {dashed ? (
        <span
          className="size-3 shrink-0 rounded-full border-2 border-dashed"
          style={{ borderColor: color }}
        />
      ) : (
        <span
          className="size-2.5 shrink-0 rounded-full border border-white/70"
          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
        />
      )}
      <span>{label}</span>
    </div>
  )
}

function LegendSosItem() {
  return (
    <div className="flex items-center gap-2 text-[10px] font-medium text-slate-300 whitespace-nowrap">
      <span className="relative flex size-2.5 shrink-0 items-center justify-center">
        <span className="absolute inline-flex size-full rounded-full bg-status-sos opacity-60 animate-ping" />
        <span className="relative inline-flex size-2.5 rounded-full border border-white/70 bg-status-sos" />
      </span>
      <span>SOS emergency</span>
    </div>
  )
}

function LegendStaleItem() {
  return (
    <div className="flex items-center gap-2 text-[10px] font-medium text-slate-300 whitespace-nowrap">
      <span
        className="size-2.5 shrink-0 rounded-full border-2 border-slate-400 bg-transparent"
        title="Telemetry older than 5 minutes"
      />
      <span>Stale telemetry (&gt;5 min)</span>
    </div>
  )
}
