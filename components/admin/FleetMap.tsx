'use client'

import React, { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import {
  Phone,
  Navigation,
  Battery,
  ShieldAlert,
  CheckCircle2,
  Clock,
  MapPin,
  X,
  AlertTriangle,
  ZoomIn,
  ZoomOut,
  Maximize2,
  ExternalLink,
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
}

export default function FleetMap({
  officers,
  centers,
  selectedOfficer,
  onSelectOfficer,
  onCallOfficer,
  onNavigate,
  focusTarget,
}: FleetMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const markersRef = useRef<{ [id: string]: any }>({})
  const [mapLoaded, setMapLoaded] = useState(false)

  // Initialize Leaflet Map
  useEffect(() => {
    let map: any = null

    async function initMap() {
      if (!mapContainerRef.current) return

      // Dynamic import to avoid SSR issues
      const L = (await import('leaflet')).default

      if (mapInstanceRef.current) return

      map = L.map(mapContainerRef.current, {
        center: [6.6924, -1.6241], // Kumasi, Ghana
        zoom: 13,
        zoomControl: false,
        attributionControl: false,
      })

      // ESRI World Dark Gray Canvas (100% Free, No Watermark, Dark Tactical)
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 16,
        attribution: '&copy; Esri, HERE, Garmin, OpenStreetMap contributors',
      }).addTo(map)

      // Add 150m Center Geofences (translucent navy fill and amber border)
      centers.forEach((center) => {
        // Outer 150m Geofence circle
        L.circle([center.lat, center.lng], {
          radius: center.radius,
          color: '#F6D300', // Amber/Gold border
          weight: 1.5,
          opacity: 0.9,
          fillColor: '#1E2B7B', // Translucent WAEC Navy fill
          fillOpacity: 0.28,
          dashArray: '5, 5',
        }).addTo(map)

        // Center datum marker with dark tactical styling (offset above datum)
        const centerIcon = L.divIcon({
          className: 'custom-center-marker',
          html: `
            <div style="
              background: rgba(17, 19, 31, 0.94);
              border: 1px solid #22263C;
              color: #F6D300;
              padding: 2px 7px;
              border-radius: 5px;
              font-family: ui-monospace, monospace;
              font-size: 10px;
              font-weight: 700;
              white-space: nowrap;
              box-shadow: 0 4px 14px rgba(0,0,0,0.7);
              display: flex;
              align-items: center;
              gap: 4px;
            ">
              <span style="display:inline-block; width:5px; height:5px; border-radius:50%; background:#F6D300; box-shadow: 0 0 6px #F6D300;"></span>
              ${center.name} (${center.code})
            </div>
          `,
          iconSize: [140, 20],
          iconAnchor: [70, 22],
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

  // Update Officer Markers when officers change
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
        let markerHtml = ''

        if (officer.status === 'SOS') {
          // Flashing Crimson Red SOS Marker (⚠️)
          markerHtml = `
            <div class="relative flex items-center justify-center cursor-pointer">
              <div style="
                position: absolute;
                width: 38px;
                height: 38px;
                border-radius: 50%;
                background: rgba(239, 68, 68, 0.45);
                animation: ping 1.2s cubic-bezier(0, 0, 0.2, 1) infinite;
              "></div>
              <div style="
                background: #EF4444;
                color: #FFFFFF;
                border: 2px solid #FFFFFF;
                width: 30px;
                height: 30px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 900;
                font-size: 13px;
                box-shadow: 0 0 16px rgba(239, 68, 68, 0.8);
                position: relative;
                z-index: 2;
              ">
                ⚠️
              </div>
              <div style="
                position: absolute;
                top: 34px;
                background: #11131F;
                border: 1px solid #EF4444;
                color: #EF4444;
                padding: 2px 7px;
                border-radius: 5px;
                font-family: ui-monospace, monospace;
                font-size: 10px;
                font-weight: 800;
                white-space: nowrap;
                box-shadow: 0 4px 12px rgba(0,0,0,0.7);
                z-index: 3;
              ">
                SOS: ${officer.name}
              </div>
            </div>
          `
        } else if (officer.status === 'ON_SITE') {
          // Emerald Verified Marker (✓)
          markerHtml = `
            <div class="relative flex items-center justify-center cursor-pointer">
              <div style="
                background: #10B981;
                color: #090A0F;
                border: 2px solid #34D399;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 900;
                font-size: 11px;
                box-shadow: 0 0 10px rgba(16, 185, 129, 0.5);
              ">
                ✓
              </div>
              <div style="
                position: absolute;
                top: 26px;
                background: #11131F;
                border: 1px solid #22263C;
                color: #E2E8F0;
                padding: 1px 6px;
                border-radius: 4px;
                font-family: ui-monospace, monospace;
                font-size: 9px;
                font-weight: 600;
                white-space: nowrap;
                box-shadow: 0 2px 8px rgba(0,0,0,0.6);
              ">
                ${officer.name}
              </div>
            </div>
          `
        } else {
          // Amber Pending / En route Marker (•)
          markerHtml = `
            <div class="relative flex items-center justify-center cursor-pointer">
              <div style="
                background: #EAB308;
                color: #090A0F;
                border: 2px solid #FDE047;
                width: 22px;
                height: 22px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 900;
                font-size: 13px;
                box-shadow: 0 0 10px rgba(234, 179, 8, 0.45);
              ">
                •
              </div>
              <div style="
                position: absolute;
                top: 24px;
                background: #11131F;
                border: 1px solid #22263C;
                color: #FDE047;
                padding: 1px 6px;
                border-radius: 4px;
                font-family: ui-monospace, monospace;
                font-size: 9px;
                font-weight: 600;
                white-space: nowrap;
                box-shadow: 0 2px 8px rgba(0,0,0,0.6);
              ">
                ${officer.name} (${officer.distanceFromDatum}m)
              </div>
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
    })
  }, [officers, mapLoaded, onSelectOfficer])

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
    <div className="relative size-full min-h-[300px] overflow-hidden bg-[#090A0F]">
      {/* Real Interactive Leaflet Container */}
      <div ref={mapContainerRef} className="size-full z-0" />

      {/* Map Controls */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-1.5">
        <button
          onClick={handleZoomIn}
          aria-label="Zoom in"
          className="size-8 rounded-lg bg-[#11131F]/90 hover:bg-[#1A1F36] border border-[#22263C] text-slate-300 hover:text-white flex items-center justify-center transition shadow-lg cursor-pointer"
        >
          <ZoomIn className="size-4" />
        </button>
        <button
          onClick={handleZoomOut}
          aria-label="Zoom out"
          className="size-8 rounded-lg bg-[#11131F]/90 hover:bg-[#1A1F36] border border-[#22263C] text-slate-300 hover:text-white flex items-center justify-center transition shadow-lg cursor-pointer"
        >
          <ZoomOut className="size-4" />
        </button>
        <button
          onClick={handleResetView}
          aria-label="Reset Kumasi view"
          className="size-8 rounded-lg bg-[#11131F]/90 hover:bg-[#1A1F36] border border-[#22263C] text-slate-300 hover:text-white flex items-center justify-center transition shadow-lg cursor-pointer"
          title="Reset to Kumasi Fleet Overview"
        >
          <Maximize2 className="size-3.5" />
        </button>
      </div>

      {/* Map Legend Overlay */}
      <div className="absolute bottom-3 left-3 z-10 p-2.5 rounded-xl bg-[#11131F]/90 border border-[#22263C] backdrop-blur-md text-[11px] font-mono text-slate-300 flex flex-wrap items-center gap-3.5 shadow-xl">
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[#10B981] shadow-[0_0_6px_#10B981]" />
          <span>Verified On-Site (≤150m)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-[#EAB308] shadow-[0_0_6px_#EAB308]" />
          <span>En Route (&gt;150m)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-[#EF4444] animate-pulse shadow-[0_0_8px_#EF4444]" />
          <span className="text-[#EF4444] font-bold">Active SOS Alert</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-4 h-2 rounded border border-dashed border-[#F6D300] bg-[#1E2B7B]/40" />
          <span>150m Geofence</span>
        </div>
      </div>

      {/* Docked Tactical Officer Popover Inspector */}
      {selectedOfficer && (
        <div className="absolute top-14 left-3 z-20 w-80 p-4 rounded-xl bg-[#11131F]/95 border border-[#22263C] shadow-2xl text-slate-200 backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-start justify-between border-b border-[#22263C] pb-2.5">
            <div className="flex items-center gap-2">
              <span
                className={`size-2.5 rounded-full ${
                  selectedOfficer.status === 'SOS'
                    ? 'bg-[#EF4444] animate-ping'
                    : selectedOfficer.status === 'ON_SITE'
                    ? 'bg-[#10B981]'
                    : 'bg-[#EAB308]'
                }`}
              />
              <span className="font-bold text-sm text-white font-mono">{selectedOfficer.name}</span>
              {selectedOfficer.isLeader && (
                <span className="text-[10px] font-bold text-[#F6D300] bg-[#F6D300]/10 px-1.5 py-0.5 rounded border border-[#F6D300]/40">
                  ★ LEADER
                </span>
              )}
            </div>
            <button
              onClick={() => onSelectOfficer(null)}
              className="text-slate-400 hover:text-white transition cursor-pointer p-0.5"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="mt-3 space-y-2 text-xs text-slate-300 font-mono">
            <div className="flex justify-between">
              <span className="text-slate-500">Center:</span>
              <span className="text-white font-semibold truncate max-w-[170px]">{selectedOfficer.assignedCenter}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Center Code:</span>
              <span className="text-[#F6D300] font-medium">{selectedOfficer.centerCode}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Roster Group:</span>
              <span className="text-blue-400 font-bold">{selectedOfficer.group}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Battery:</span>
              <span
                className={`flex items-center gap-1 font-bold ${
                  selectedOfficer.battery < 30 ? 'text-[#EF4444]' : 'text-[#10B981]'
                }`}
              >
                <Battery className="size-3.5" />
                {selectedOfficer.battery}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Datum Dist:</span>
              <span
                className={`font-bold ${
                  selectedOfficer.distanceFromDatum <= 150 ? 'text-[#10B981]' : 'text-[#EAB308]'
                }`}
              >
                {selectedOfficer.distanceFromDatum}m away
              </span>
            </div>
            {selectedOfficer.verifiedTime && (
              <div className="flex justify-between">
                <span className="text-slate-500">Verified:</span>
                <span className="text-slate-300">{selectedOfficer.verifiedTime}</span>
              </div>
            )}
            {selectedOfficer.status === 'SOS' && (
              <div className="p-2.5 rounded-lg bg-[#EF4444]/15 border border-[#EF4444]/60 text-[11px] text-red-200 font-medium mt-2">
                <div className="font-bold text-[#EF4444] flex items-center gap-1 mb-0.5">
                  <AlertTriangle className="size-3 text-[#EF4444]" />
                  <span>CRITICAL EMERGENCY SOS</span>
                </div>
                {selectedOfficer.sosDetails || 'Immediate assistance requested!'}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="mt-4 grid grid-cols-2 gap-2 pt-2 border-t border-[#22263C]">
            <button
              onClick={() => onCallOfficer(selectedOfficer.phone)}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-[#1E2B7B] hover:bg-[#28389E] text-white font-semibold text-xs transition shadow-sm cursor-pointer"
            >
              <Phone className="size-3.5" />
              <span>Call Phone</span>
            </button>
            <button
              onClick={() => onNavigate(selectedOfficer.lat, selectedOfficer.lng)}
              className="flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg bg-[#1A1F36] hover:bg-[#222847] border border-[#22263C] text-slate-200 font-semibold text-xs transition cursor-pointer"
            >
              <Navigation className="size-3.5 text-blue-400" />
              <span>Google Maps</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
