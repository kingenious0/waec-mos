'use client'

import React, { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import {
  Compass,
  Plus,
  Minus,
  Crosshair,
  Layers,
  Search,
  SlidersHorizontal,
} from 'lucide-react'

export interface FleetOfficer {
  id: string
  name: string
  phone: string
  staffId: string
  group: string
  isLeader?: boolean
  assignedCenter: string
  centerCode: string
  status: 'ON_SITE' | 'PENDING' | 'SOS'
  verifiedTime?: string
  distanceFromDatum: number // meters
  battery: number
  lat: number
  lng: number
  sosDetails?: string
}

export interface ExamCenter {
  name: string
  code: string
  lat: number
  lng: number
  radius: number // 150m
  depotLocked: boolean
  totalMonitors: number
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
  onCallOfficer,
  onNavigate,
  focusTarget,
  activeSectorName = 'Ashanti Metro Zone',
}: FleetMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)
  const markersRef = useRef<{ [id: string]: any }>({})
  const trailPolylineRef = useRef<any>(null)
  const [mapLoaded, setMapLoaded] = useState(false)
  const [mapMode, setMapMode] = useState<'map' | 'satellite'>('map')

  // Helper to create Real Leaflet OSM map or Satellite tiles (No API key needed)
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

    // Real OpenStreetMap (OSM) Standard Tile Layer
    return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      subdomains: ['a', 'b', 'c'],
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
  }

  // Initialize Leaflet Map
  useEffect(() => {
    let map: any = null

    async function initMap() {
      if (!mapContainerRef.current) return

      const L = (await import('leaflet')).default
      if (mapInstanceRef.current) return

      map = L.map(mapContainerRef.current, {
        center: [6.6924, -1.6241], // Kumasi, Ghana
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      })

      // Real Leaflet OSM Layer
      tileLayerRef.current = createTileLayer(L, mapMode).addTo(map)

      // Add Center Geofences & Polygon Zones
      centers.forEach((center) => {
        // Geofence Circle
        L.circle([center.lat, center.lng], {
          radius: center.radius,
          color: '#0284c7', // Sky blue border
          weight: 2,
          opacity: 0.9,
          fillColor: '#0284c7',
          fillOpacity: 0.2,
          dashArray: '5, 5',
        }).addTo(map)

        // Center Marker Pill (Clean sans-serif)
        const centerIcon = L.divIcon({
          className: 'custom-center-marker',
          html: `
            <div style="
              background: rgba(12, 15, 23, 0.95);
              border: 1px solid rgba(56, 189, 248, 0.4);
              color: #38bdf8;
              padding: 2px 8px;
              border-radius: 6px;
              font-family: var(--font-sans), system-ui, -apple-system, sans-serif;
              font-size: 10px;
              font-weight: 700;
              white-space: nowrap;
              box-shadow: 0 4px 14px rgba(0,0,0,0.8);
              display: flex;
              align-items: center;
              gap: 5px;
            ">
              <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#38bdf8; box-shadow: 0 0 6px #38bdf8;"></span>
              ${center.name.split(' School')[0].split(' College')[0]} (${center.code})
            </div>
          `,
          iconSize: [140, 20],
          iconAnchor: [70, 24],
        })

        L.marker([center.lat, center.lng], { icon: centerIcon, interactive: false }).addTo(map)
      })

      mapInstanceRef.current = map
      setMapLoaded(true)
    }

    initMap()

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [centers])

  // Handle Map / Satellite mode change dynamically
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return
    import('leaflet').then((leafletModule) => {
      const L = leafletModule.default
      if (tileLayerRef.current) {
        mapInstanceRef.current.removeLayer(tileLayerRef.current)
      }
      tileLayerRef.current = createTileLayer(L, mapMode).addTo(mapInstanceRef.current)
    })
  }, [mapMode, mapLoaded])

  // Update Officer Markers & Active Corridor Trail
  useEffect(() => {
    if (!mapInstanceRef.current || !mapLoaded) return
    const map = mapInstanceRef.current

    import('leaflet').then((leafletModule) => {
      const L = leafletModule.default

      // Clear previous markers
      Object.values(markersRef.current).forEach((marker: any) => {
        map.removeLayer(marker)
      })
      markersRef.current = {}

      // Add each officer as a tactical marker
      officers.forEach((officer) => {
        const isSelected = selectedOfficer?.id === officer.id
        const isSos = officer.status === 'SOS'
        const isOnSite = officer.status === 'ON_SITE'
        const unitId = officer.id.replace('off-', '').padStart(2, '0')

        let markerHtml = ''

        if (isSos) {
          // SOS Pulsing Beacon Marker
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
                ⚠️
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
          // Selected Unit Active Marker (with golden/radar ring and unit pill)
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
          // Emerald Verified Dot Marker
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
          // In Transit Cyan / Amber Marker
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

        const marker = L.marker([officer.lat, officer.lng], { icon })
          .addTo(map)
          .on('click', () => {
            onSelectOfficer(officer)
          })

        markersRef.current[officer.id] = marker
      })

      // Add Dotted Trail Line if an officer is selected
      if (trailPolylineRef.current) {
        map.removeLayer(trailPolylineRef.current)
        trailPolylineRef.current = null
      }

      if (selectedOfficer) {
        const matchingCenter = centers.find(
          (c) => c.code === selectedOfficer.centerCode || c.name === selectedOfficer.assignedCenter
        ) || centers[0]

        if (matchingCenter) {
          const latlngs: [number, number][] = [
            [selectedOfficer.lat, selectedOfficer.lng],
            [matchingCenter.lat, matchingCenter.lng],
          ]

          trailPolylineRef.current = L.polyline(latlngs, {
            color: selectedOfficer.status === 'SOS' ? '#ef4444' : '#bef264', // Lime / Cyan dashed route
            weight: 2.5,
            opacity: 0.85,
            dashArray: '6, 8',
          }).addTo(map)
        }
      }
    })
  }, [officers, selectedOfficer, centers, mapLoaded, onSelectOfficer])

  // Handle Focus Target Changes
  useEffect(() => {
    if (!mapInstanceRef.current || !focusTarget) return
    mapInstanceRef.current.flyTo(
      [focusTarget.lat, focusTarget.lng],
      focusTarget.zoom || 15,
      { duration: 1.2 }
    )
  }, [focusTarget])

  const handleZoomIn = () => mapInstanceRef.current?.zoomIn()
  const handleZoomOut = () => mapInstanceRef.current?.zoomOut()
  const handleResetView = () => mapInstanceRef.current?.flyTo([6.6924, -1.6241], 13)

  return (
    <div className="relative size-full min-h-[300px] overflow-hidden bg-[#090A0F] select-none font-sans">
      {/* Real Interactive Leaflet Container */}
      <div ref={mapContainerRef} className="size-full z-0" />

      {/* --- Google Maps Style: Top-Left Floating Zone Status Pill --- */}
      <div className="absolute top-3.5 left-3.5 sm:top-4 sm:left-4 z-10 pointer-events-auto">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0C0F17]/90 border border-[#22263C] backdrop-blur-md shadow-xl text-xs font-sans">
          <span className="size-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_#34d399] animate-pulse" />
          <span className="font-semibold text-white tracking-tight">
            {activeSectorName || 'Ashanti Regional Zone'}
          </span>
          <span className="text-slate-600">•</span>
          <span className="text-emerald-400 font-bold">
            {officers.length || 48} Active
          </span>
        </div>
      </div>

      {/* --- Google Maps Style: Top-Right Map / Satellite Switcher --- */}
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

      {/* --- Google Maps Style: Bottom-Right Vertical Floating Tool Cluster --- */}
      <div className="absolute bottom-6 right-3.5 sm:bottom-6 sm:right-4 z-10 flex flex-col items-center gap-2 pointer-events-auto">
        {/* Zoom In / Out Buttons Stack */}
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

        {/* Center / Location Target Crosshair Button */}
        <button
          type="button"
          onClick={handleResetView}
          aria-label="Center view"
          className="size-9 rounded-xl bg-[#0C0F17]/90 border border-[#22263C] text-slate-300 hover:text-white hover:bg-white/5 active:bg-white/10 flex items-center justify-center backdrop-blur-md shadow-2xl transition cursor-pointer"
          title="Recenter to Kumasi Center"
        >
          <Crosshair className="size-4" />
        </button>
      </div>
    </div>
  )
}
