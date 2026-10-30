'use client'

import React, { useEffect, useRef, useState } from 'react'
import 'leaflet/dist/leaflet.css'
import { Crosshair, Layers, MapPin, Navigation } from 'lucide-react'

interface FieldMapProps {
  centerName: string
  centerCode: string
  centerLat?: number
  centerLng?: number
  radiusMeters?: number
  isInside: boolean
  officerName: string
}

export default function FieldMap({
  centerName = 'Prempeh College Center A',
  centerCode = '050102',
  centerLat = 6.7028,
  centerLng = -1.6369,
  radiusMeters = 150,
  isInside = true,
  officerName = 'Kofi Mensah',
}: FieldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)
  const tileLayerRef = useRef<any>(null)
  const officerMarkerRef = useRef<any>(null)
  const bearingLineRef = useRef<any>(null)
  const [mapMode, setMapMode] = useState<'map' | 'satellite'>('map')
  const [mapReady, setMapReady] = useState(false)

  // Officer Coordinates:
  // Inside: ~42m away (offset ~0.00035 deg)
  // Outside: ~450m away (offset ~0.0038 deg)
  const officerLat = isInside ? centerLat + 0.00028 : centerLat - 0.0034
  const officerLng = isInside ? centerLng + 0.00022 : centerLng - 0.0028

  // Helper: Tile Layer Generator
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
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    })
  }

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current) return
    let isCancelled = false

    import('leaflet').then((leafletModule) => {
      if (isCancelled || !containerRef.current) return
      const L = leafletModule.default || leafletModule

      // If map already initialized, clear it
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }

      // Create Leaflet Map Instance
      const map = L.map(containerRef.current, {
        center: [centerLat, centerLng],
        zoom: 17,
        zoomControl: false,
        attributionControl: false,
      })

      mapInstanceRef.current = map

      // Base Tile Layer
      const baseTiles = createTileLayer(L, mapMode)
      baseTiles.addTo(map)
      tileLayerRef.current = baseTiles

      // 150m Perimeter Circle
      L.circle([centerLat, centerLng], {
        radius: radiusMeters,
        color: '#F6D300',
        weight: 2,
        dashArray: '5, 4',
        fillColor: '#1E2B7B',
        fillOpacity: 0.22,
      }).addTo(map)

      // Center Datum Marker
      const centerIcon = L.divIcon({
        className: 'custom-center-marker',
        html: `
          <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -100%);">
            <div style="background:#0F172A; border:1.5px solid #F6D300; border-radius:6px; padding:2px 8px; box-shadow:0 4px 12px rgba(0,0,0,0.4); display:flex; align-items:center; gap:4px; white-space:nowrap;">
              <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:#F6D300;"></span>
              <span style="font-size:10px; font-weight:700; color:#FFFFFF; font-family:Inter,system-ui,sans-serif;">${centerName}</span>
            </div>
            <div style="width:2px; height:10px; background:#F6D300;"></div>
            <div style="width:10px; height:10px; border-radius:50%; background:#F6D300; border:2px solid #0F172A; box-shadow:0 0 10px #F6D300;"></div>
          </div>
        `,
        iconSize: [0, 0],
      })

      L.marker([centerLat, centerLng], { icon: centerIcon }).addTo(map)

      // Officer Location Marker
      const updateOfficerMarker = () => {
        const distLabel = isInside ? '42m' : '450m'
        const badgeBg = isInside ? '#059669' : '#D97706'
        const pulseColor = isInside ? '#10B981' : '#F59E0B'

        const officerIcon = L.divIcon({
          className: 'custom-officer-marker',
          html: `
            <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -50%);">
              <div style="background:#0F172A; border:1px solid ${pulseColor}; border-radius:6px; padding:2px 6px; box-shadow:0 4px 10px rgba(0,0,0,0.5); display:flex; align-items:center; gap:4px; margin-bottom:4px; white-space:nowrap;">
                <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${badgeBg};"></span>
                <span style="font-size:9px; font-weight:700; color:#F8FAFC; font-family:Inter,system-ui,sans-serif;">You • ${distLabel}</span>
              </div>
              <div style="position:relative; display:flex; align-items:center; justify-content:center;">
                <div style="position:absolute; width:24px; height:24px; border-radius:50%; background:${pulseColor}; opacity:0.35; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
                <div style="width:14px; height:14px; border-radius:50%; background:#2563EB; border:2.5px solid #FFFFFF; box-shadow:0 0 8px rgba(37,99,235,0.8);"></div>
              </div>
            </div>
          `,
          iconSize: [0, 0],
        })

        if (officerMarkerRef.current) {
          officerMarkerRef.current.setLatLng([officerLat, officerLng])
          officerMarkerRef.current.setIcon(officerIcon)
        } else {
          officerMarkerRef.current = L.marker([officerLat, officerLng], { icon: officerIcon }).addTo(map)
        }

        // Bearing line
        if (bearingLineRef.current) {
          bearingLineRef.current.setLatLngs([
            [centerLat, centerLng],
            [officerLat, officerLng],
          ])
          bearingLineRef.current.setStyle({
            color: isInside ? '#10B981' : '#F59E0B',
          })
        } else {
          bearingLineRef.current = L.polyline(
            [
              [centerLat, centerLng],
              [officerLat, officerLng],
            ],
            {
              color: isInside ? '#10B981' : '#F59E0B',
              weight: 2,
              dashArray: '4, 4',
              opacity: 0.8,
            }
          ).addTo(map)
        }
      }

      updateOfficerMarker()
      setMapReady(true)

      // Fit bounds nicely to include center and officer
      map.fitBounds(
        L.latLngBounds([
          [centerLat, centerLng],
          [officerLat, officerLng],
        ]).pad(0.4),
        { animate: false }
      )
    })

    return () => {
      isCancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [centerLat, centerLng, radiusMeters])

  // Update Officer position when `isInside` toggles
  useEffect(() => {
    if (!mapInstanceRef.current || !mapReady) return
    import('leaflet').then((leafletModule) => {
      const L = leafletModule.default || leafletModule
      const distLabel = isInside ? '42m' : '450m'
      const badgeBg = isInside ? '#059669' : '#D97706'
      const pulseColor = isInside ? '#10B981' : '#F59E0B'

      const officerIcon = L.divIcon({
        className: 'custom-officer-marker',
        html: `
          <div style="display:flex; flex-direction:column; align-items:center; transform: translate(-50%, -50%);">
            <div style="background:#0F172A; border:1px solid ${pulseColor}; border-radius:6px; padding:2px 6px; box-shadow:0 4px 10px rgba(0,0,0,0.5); display:flex; align-items:center; gap:4px; margin-bottom:4px; white-space:nowrap;">
              <span style="display:inline-block; width:6px; height:6px; border-radius:50%; background:${badgeBg};"></span>
              <span style="font-size:9px; font-weight:700; color:#F8FAFC; font-family:Inter,system-ui,sans-serif;">You • ${distLabel}</span>
            </div>
            <div style="position:relative; display:flex; align-items:center; justify-content:center;">
              <div style="position:absolute; width:24px; height:24px; border-radius:50%; background:${pulseColor}; opacity:0.35; animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="width:14px; height:14px; border-radius:50%; background:#2563EB; border:2.5px solid #FFFFFF; box-shadow:0 0 8px rgba(37,99,235,0.8);"></div>
            </div>
          </div>
        `,
        iconSize: [0, 0],
      })

      if (officerMarkerRef.current) {
        officerMarkerRef.current.setLatLng([officerLat, officerLng])
        officerMarkerRef.current.setIcon(officerIcon)
      }

      if (bearingLineRef.current) {
        bearingLineRef.current.setLatLngs([
          [centerLat, centerLng],
          [officerLat, officerLng],
        ])
        bearingLineRef.current.setStyle({
          color: isInside ? '#10B981' : '#F59E0B',
        })
      }

      // Smooth pan to fit both
      mapInstanceRef.current.flyToBounds(
        L.latLngBounds([
          [centerLat, centerLng],
          [officerLat, officerLng],
        ]).pad(0.35),
        { duration: 0.8 }
      )
    })
  }, [isInside, officerLat, officerLng, centerLat, centerLng, mapReady])

  // Toggle Map / Satellite
  const handleToggleMapMode = (newMode: 'map' | 'satellite') => {
    if (newMode === mapMode || !mapInstanceRef.current) return
    import('leaflet').then((leafletModule) => {
      const L = leafletModule.default || leafletModule
      if (tileLayerRef.current) {
        mapInstanceRef.current.removeLayer(tileLayerRef.current)
      }
      const newLayer = createTileLayer(L, newMode)
      newLayer.addTo(mapInstanceRef.current)
      tileLayerRef.current = newLayer
      setMapMode(newMode)
    })
  }

  // Recenter on Officer
  const handleRecenter = () => {
    if (!mapInstanceRef.current) return
    mapInstanceRef.current.flyTo([officerLat, officerLng], 18, { duration: 0.7 })
  }

  return (
    <div className="relative w-full h-full overflow-hidden select-none">
      {/* Real Leaflet Map Container */}
      <div ref={containerRef} className="absolute inset-0 w-full h-full z-0 bg-[#0A0D18]" />

      {/* Floating Controls: Top-Right Map / Satellite Switcher */}
      <div className="absolute top-3 right-3 z-[400] flex items-center p-1 rounded-xl bg-slate-900/90 border border-slate-700/80 shadow-lg backdrop-blur-md">
        <button
          type="button"
          onClick={() => handleToggleMapMode('map')}
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
            mapMode === 'map'
              ? 'bg-[#1E2B7B] text-white shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          Map
        </button>
        <button
          type="button"
          onClick={() => handleToggleMapMode('satellite')}
          className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition-all ${
            mapMode === 'satellite'
              ? 'bg-[#1E2B7B] text-white shadow-sm'
              : 'text-slate-300 hover:text-white'
          }`}
        >
          Satellite
        </button>
      </div>

      {/* Floating Recenter Button: Bottom-Right */}
      <button
        type="button"
        onClick={handleRecenter}
        title="Recenter to My Location"
        className="absolute bottom-3 right-3 z-[400] size-8 rounded-xl bg-slate-900/90 border border-slate-700/80 text-slate-200 hover:text-white flex items-center justify-center shadow-lg backdrop-blur-md hover:bg-slate-800 transition active:scale-95 cursor-pointer"
      >
        <Crosshair className="size-4 text-[#F6D300]" />
      </button>

      {/* Center Label Chip: Bottom-Left */}
      <div className="absolute bottom-3 left-3 z-[400] flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/90 border border-slate-700/80 shadow-md backdrop-blur-md">
        <span className="size-2 rounded-full bg-[#F6D300]" />
        <span className="text-[10px] font-medium text-slate-200">150m Perimeter Zone</span>
      </div>
    </div>
  )
}
