'use client'

import React, { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import { MapPin, Crosshair } from 'lucide-react'

interface FieldMapProps {
  centerName?: string; centerCode?: string; centerLat?: number; centerLng?: number
  radiusMeters?: number; isInside?: boolean; distanceMeters?: number
}

export default function FieldMap({
  centerName = 'Prempeh College Center A',
  centerCode = '050102',
  centerLat = 6.7028,
  centerLng = -1.6369,
  radiusMeters = 150,
  isInside = true,
  distanceMeters = isInside ? 42 : 450,
}: FieldMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapInstanceRef = useRef<any>(null)

  const officerLat = isInside ? centerLat + 0.00028 : centerLat + 0.0028
  const officerLng = isInside ? centerLng + 0.00024 : centerLng + 0.0031

  const fitView = (map: any, L: any) => {
    if (!map || !L) return
    map.fitBounds(
      L.latLngBounds([[centerLat, centerLng], [officerLat, officerLng]]),
      { padding: [60, 60], maxZoom: isInside ? 17 : 16 }
    )
  }

  useEffect(() => {
    if (!containerRef.current) return
    let isCancelled = false
    let ro: ResizeObserver | null = null

    import('leaflet').then((m) => {
      if (isCancelled || !containerRef.current) return
      const L = m.default || m
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }

      const map = L.map(containerRef.current, {
        center: [centerLat, centerLng],
        zoom: 16,
        zoomControl: false,
        attributionControl: false,
      })
      mapInstanceRef.current = map

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        subdomains: ['a', 'b', 'c'],
      }).addTo(map)

      L.circle([centerLat, centerLng], {
        radius: radiusMeters,
        color: '#3B57F0',
        weight: 2,
        fillColor: '#3B57F0',
        fillOpacity: 0.16,
      }).addTo(map)

      const venueIcon = L.divIcon({
        className: 'custom-venue-pin',
        html: '<div style="width:20px;height:20px;border-radius:50%;background:#F6D300;border:3px solid #111420;box-shadow:0 2px 6px rgba(0,0,0,0.35);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      })
      L.marker([centerLat, centerLng], { icon: venueIcon }).addTo(map)

      const officerIcon = L.divIcon({
        className: 'custom-officer-dot',
        html: `<div style="position:relative;width:24px;height:24px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:24px;height:24px;border-radius:50%;background:rgba(59,87,240,0.28);"></div>
          <div style="width:12px;height:12px;border-radius:50%;background:#3B57F0;border:2px solid #FFFFFF;box-shadow:0 1px 4px rgba(0,0,0,0.3);"></div>
        </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12],
      })
      L.marker([officerLat, officerLng], { icon: officerIcon }).addTo(map)

      L.polyline([[centerLat, centerLng], [officerLat, officerLng]], {
        color: isInside ? '#10B981' : '#F59E0B',
        weight: 2.5,
        dashArray: isInside ? undefined : '6, 6',
      }).addTo(map)

      setTimeout(() => {
        if (!isCancelled && mapInstanceRef.current) {
          mapInstanceRef.current.invalidateSize()
          fitView(mapInstanceRef.current, L)
        }
      }, 100)

      if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
        ro = new ResizeObserver(() => mapInstanceRef.current?.invalidateSize())
        ro.observe(containerRef.current)
      }
    })

    return () => {
      isCancelled = true
      ro?.disconnect()
      mapInstanceRef.current?.remove()
      mapInstanceRef.current = null
    }
  }, [centerLat, centerLng, officerLat, officerLng, radiusMeters, isInside])

  const handleRecenter = () => {
    if (!mapInstanceRef.current) return
    import('leaflet').then((m) => {
      const L = m.default || m
      mapInstanceRef.current.invalidateSize()
      fitView(mapInstanceRef.current, L)
    })
  }

  return (
    <div className="relative w-full h-full min-h-[330px] flex-1 rounded-2xl overflow-hidden border border-[#1A2035] bg-[#E3E7EC] select-none shadow-inner">
      <div ref={containerRef} className="absolute inset-0 z-0 w-full h-full" />
      <div className="absolute top-3 left-3 z-[400] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0B0F1A]/90 border border-[#1E273E] text-xs font-semibold text-white shadow-lg backdrop-blur-md">
        <MapPin className="size-3.5 text-[#F6D300]" />
        <span>{centerName}</span>
        <span className="text-[10px] font-bold text-[#F6D300] bg-[#1A2035] px-1.5 py-0.5 rounded border border-[#27324B] tabular-nums">
          {centerCode}
        </span>
      </div>
      <div className="absolute bottom-3 left-3 z-[400] flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0B0F1A]/90 border border-[#1E273E] text-xs font-semibold text-white shadow-lg backdrop-blur-md tabular-nums">
        <span className={`size-2 rounded-full ${isInside ? 'bg-emerald-400' : 'bg-[#F6D300]'}`} />
        <span>{distanceMeters} m from centre</span>
      </div>
      <button
        type="button"
        onClick={handleRecenter}
        aria-label="Recenter map on venue and officer"
        title="Recenter"
        className="absolute bottom-3 right-3 z-[400] size-10 rounded-full bg-[#0B0F1A]/90 border border-[#1E273E] flex items-center justify-center text-[#F6D300] hover:text-white shadow-lg backdrop-blur-md transition cursor-pointer"
      ><Crosshair className="size-5" /></button>
    </div>
  )
}
