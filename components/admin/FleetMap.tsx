'use client'

import React, { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { Plus, Minus, Crosshair } from 'lucide-react'

export interface OfficerCheckpoint {
  id: string
  action: string
  label: string
  time: string
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
}

export default function FleetMap({
  officers,
  centers,
  selectedOfficer,
  onSelectOfficer,
  focusTarget,
  activeSectorName = 'Ashanti Regional Zone',
}: FleetMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)
  const centersLayerRef = useRef<any>(null)
  const officersLayerRef = useRef<any>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapMode, setMapMode] = useState<'map' | 'satellite'>('map')

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

    return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
  }

  // Initialize Leaflet map once
  useEffect(() => {
    let isCancelled = false

    async function initMap() {
      if (!mapContainerRef.current) return
      const L = (await import('leaflet')).default
      if (isCancelled || !mapContainerRef.current || mapInstanceRef.current) return

      const map = L.map(mapContainerRef.current, {
        center: [6.6924, -1.6241],
        zoom: BASE_ZOOM,
        zoomControl: false,
        attributionControl: false,
      })

      tileLayerRef.current = createTileLayer(L, mapMode).addTo(map)
      centersLayerRef.current = L.layerGroup().addTo(map)
      officersLayerRef.current = L.layerGroup().addTo(map)

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

        // Auto-width pill (no fixed iconSize → no text overflowing the pill),
        // centered on the coordinate via translate.
        const centerIcon = L.divIcon({
          className: 'custom-center-marker',
          html: `
            <div style="
              transform: translate(-50%, -50%);
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
              <span style="overflow:hidden; text-overflow:ellipsis; max-width:180px;">${shortName}</span>
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
              ">${center.code}</span>
            </div>
          `,
          iconSize: [0, 0],
          iconAnchor: [0, 0],
        })

        L.marker([center.lat, center.lng], { icon: centerIcon, interactive: false }).addTo(group)
      })
    })
  }, [centers, mapLoaded])

  // Frame ALL centers on first load so newly registered centers (anywhere in
  // Ghana) are visible instead of staying outside the default Kumasi view.
  const didInitialFitRef = useRef(false)
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded || didInitialFitRef.current) return
    const valid = centers.filter(
      (c) => !Number.isNaN(c.lat) && !Number.isNaN(c.lng)
    )
    if (valid.length === 0) return
    didInitialFitRef.current = true
    import('leaflet').then((leafletModule) => {
      if (!mapInstanceRef.current) return
      const L = leafletModule.default
      const bounds = L.latLngBounds(valid.map((c) => [c.lat, c.lng]))
      mapInstanceRef.current.fitBounds(bounds, { padding: [70, 70], maxZoom: 15 })
    })
  }, [centers, mapLoaded])

  // Render / update Officer Markers & Active Corridor Trail without touching tile/center layers
  useEffect(() => {
    if (!mapInstanceRef.current || !officersLayerRef.current || !mapLoaded) return

    import('leaflet').then((leafletModule) => {
      if (!officersLayerRef.current) return
      const L = leafletModule.default
      const group = officersLayerRef.current
      group.clearLayers()

      officers.forEach((officer) => {
        const isSelected = selectedOfficer?.id === officer.id
        const isSos = officer.status === 'SOS'
        const isOnSite = officer.status === 'ON_SITE'
        const unitId = getOfficerUnitCode(officer)

        let markerHtml = ''

        if (isSos) {
          markerHtml = `
            <div class="relative flex items-center justify-center cursor-pointer">
              <div style="
                position: absolute;
                width: 38px;
                height: 38px;
                border-radius: 50%;
                background: rgba(239, 68, 68, 0.4);
                animation: ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite;
              "></div>
              <div style="
                background: #EF4444;
                color: #FFFFFF;
                border: 2px solid #FFFFFF;
                width: 26px;
                height: 26px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 900;
                font-size: 11px;
                box-shadow: 0 0 14px rgba(239, 68, 68, 0.8);
                position: relative;
                z-index: 2;
              ">
                !
              </div>
              <div style="
                position: absolute;
                top: 30px;
                background: #0C0F17;
                border: 1px solid #EF4444;
                color: #EF4444;
                padding: 2px 7px;
                border-radius: 5px;
                font-family: var(--font-sans), system-ui, -apple-system, sans-serif;
                font-size: 10px;
                font-weight: 800;
                white-space: nowrap;
                box-shadow: 0 4px 12px rgba(0,0,0,0.8);
                z-index: 3;
              ">
                U-${unitId} SOS
              </div>
            </div>
          `
        } else if (isSelected) {
          markerHtml = `
            <div class="relative flex items-center justify-center cursor-pointer">
              <div style="
                position: absolute;
                width: 44px;
                height: 44px;
                border-radius: 50%;
                background: rgba(246, 211, 0, 0.22);
                border: 1px solid rgba(246, 211, 0, 0.5);
                animation: pulse 2s infinite;
              "></div>
              <div style="
                background: #0C0F17;
                border: 1.5px solid #F6D300;
                color: #F6D300;
                padding: 3px 10px;
                border-radius: 9999px;
                font-family: var(--font-sans), system-ui, -apple-system, sans-serif;
                font-size: 11px;
                font-weight: 700;
                display: flex;
                align-items: center;
                gap: 6px;
                box-shadow: 0 0 16px rgba(246, 211, 0, 0.5);
                white-space: nowrap;
                position: relative;
                z-index: 2;
              ">
                <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#F6D300;"></span>
                U-${unitId} ${officer.name.split(' ')[0]}
              </div>
            </div>
          `
        } else if (isOnSite) {
          markerHtml = `
            <div class="relative flex items-center justify-center cursor-pointer group">
              <div style="
                background: #10B981;
                border: 2px solid #0C0F17;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                box-shadow: 0 0 8px #10B981;
              "></div>
            </div>
          `
        } else {
          markerHtml = `
            <div class="relative flex items-center justify-center cursor-pointer group">
              <div style="
                background: #38bdf8;
                border: 2px solid #0C0F17;
                width: 12px;
                height: 12px;
                border-radius: 50%;
                box-shadow: 0 0 8px #38bdf8;
              "></div>
            </div>
          `
        }

        const icon = L.divIcon({
          className: 'officer-marker',
          html: markerHtml,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        })

        L.marker([officer.lat, officer.lng], { icon })
          .addTo(group)
          .on('click', () => {
            onSelectOfficer(officer)
          })
      })

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
          ).addTo(group)
        }
      }
    })
  }, [officers, selectedOfficer, centers, mapLoaded, onSelectOfficer])

  useEffect(() => {
    if (!mapInstanceRef.current || !focusTarget) return
    mapInstanceRef.current.flyTo([focusTarget.lat, focusTarget.lng], focusTarget.zoom || 15, {
      duration: 1.2,
    })
  }, [focusTarget])

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn()
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut()
  const handleResetView = () => {
    const map = mapInstanceRef.current
    if (!map) return
    const valid = centers.filter((c) => !Number.isNaN(c.lat) && !Number.isNaN(c.lng))
    if (valid.length > 0) {
      import('leaflet').then((leafletModule) => {
        if (!mapInstanceRef.current) return
        const L = leafletModule.default
        map.fitBounds(L.latLngBounds(valid.map((c) => [c.lat, c.lng])), {
          padding: [70, 70],
          maxZoom: 15,
          animate: true,
        })
      })
    } else {
      map.flyTo([6.6924, -1.6241], BASE_ZOOM)
    }
  }

  return (
    <div className="relative size-full min-h-[300px] overflow-hidden bg-[#090A0F] select-none font-sans">
      <div ref={mapContainerRef} className="size-full z-0" />

      {/* Top-Left Floating Zone Status Pill */}
      <div className="absolute top-3.5 left-3.5 sm:top-4 sm:left-4 z-10 pointer-events-auto">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0C0F17]/90 border border-[#22263C] backdrop-blur-md shadow-xl text-xs font-sans">
          <span className="size-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_#34d399] animate-pulse" />
          <span className="font-semibold text-white tracking-tight">
            {activeSectorName}
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-emerald-400 font-bold">
            {officers.length} Officers
          </span>
        </div>
      </div>

      {/* Top-Right Map / Satellite Switcher */}
      <div className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 z-10 pointer-events-auto">
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

      {/* Bottom-Left Marker Legend — decodes what every dot / circle means */}
      <div className="absolute bottom-6 left-3.5 sm:left-4 z-10 hidden md:block pointer-events-none">
        <div className="flex flex-col gap-1.5 rounded-xl bg-[#0C0F17]/90 border border-[#22263C] px-3 py-2.5 backdrop-blur-md shadow-xl font-sans">
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500 mb-0.5">
            Map Legend
          </span>
          <LegendItem color="#10B981" label="Officer on-site" />
          <LegendItem color="#38bdf8" label="Officer en-route / pending" />
          <LegendItem color="#EF4444" label="SOS emergency" pulse />
          <LegendItem color="#F6D300" label="Selected officer" />
          <LegendItem color="#0284c7" label="Center geofence (radius)" dashed />
        </div>
      </div>

      {/* Bottom-Right Vertical Floating Tool Cluster */}
      <div className="absolute bottom-6 right-3.5 sm:bottom-6 sm:right-4 z-10 flex flex-col items-center gap-2 pointer-events-auto">
        <div className="flex flex-col rounded-xl bg-[#0C0F17]/90 border border-[#22263C] backdrop-blur-md shadow-2xl overflow-hidden divide-y divide-[#22263C]">
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

        <button
          type="button"
          onClick={handleResetView}
          aria-label="Center view"
          className="size-9 rounded-xl bg-[#0C0F17]/90 border border-[#22263C] text-slate-300 hover:text-white hover:bg-white/5 active:bg-white/10 flex items-center justify-center backdrop-blur-md shadow-2xl transition cursor-pointer"
          title="Recenter Map"
        >
          <Crosshair className="size-4" />
        </button>
      </div>
    </div>
  )
}

function LegendItem({
  color,
  label,
  pulse,
  dashed,
}: {
  color: string
  label: string
  pulse?: boolean
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
          className={`size-2.5 shrink-0 rounded-full ${pulse ? 'animate-ping' : ''}`}
          style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }}
        />
      )}
      <span>{label}</span>
    </div>
  )
}
