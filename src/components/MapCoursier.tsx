// src/components/MapCoursier.tsx
'use client'
import { useEffect, useRef } from 'react'

interface MapCoursierProps {
  position?: { lat: number; lng: number }
  livraison?: {
    depart: { lat: number; lng: number; label: string }
    arrivee: { lat: number; lng: number; label: string }
  }
  onPositionChange?: (lat: number, lng: number) => void
}

export default function MapCoursier({ position, livraison, onPositionChange }: MapCoursierProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const selfMarker = useRef<L.Marker | null>(null)
  const watchId = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return
    const initMap = async () => {
      const L = (await import('leaflet')).default
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })
      if (mapInstance.current) return
      const defaultCenter: [number, number] = position ? [position.lat, position.lng] : [12.3547, -1.5247]
      const map = L.map(mapRef.current!, { zoomControl: false, attributionControl: false })
      mapInstance.current = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
      L.control.zoom({ position: 'bottomright' }).addTo(map)
      const selfIcon = L.divIcon({
        html: `<div style="background:#E87722;width:40px;height:40px;border-radius:50%;border:4px solid white;box-shadow:0 3px 12px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:20px;">🛵</div>`,
        iconSize: [40, 40], iconAnchor: [20, 20], className: '',
      })
      selfMarker.current = L.marker(defaultCenter, { icon: selfIcon, zIndexOffset: 1000 }).addTo(map).bindPopup('<b>Ma position</b>')
      if (livraison) {
        const dIcon = L.divIcon({ html: `<div style="background:#22C55E;width:28px;height:28px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;font-size:14px;">▲</div>`, iconSize: [28, 28], iconAnchor: [14, 14], className: '' })
        L.marker([livraison.depart.lat, livraison.depart.lng], { icon: dIcon }).addTo(map).bindPopup(`<b>Départ</b><br>${livraison.depart.label}`)
        const aIcon = L.divIcon({ html: `<div style="background:#EF4444;width:28px;height:28px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25);display:flex;align-items:center;justify-content:center;font-size:14px;">▼</div>`, iconSize: [28, 28], iconAnchor: [14, 14], className: '' })
        L.marker([livraison.arrivee.lat, livraison.arrivee.lng], { icon: aIcon }).addTo(map).bindPopup(`<b>Destination</b><br>${livraison.arrivee.label}`)
        L.polyline([[defaultCenter[0], defaultCenter[1]], [livraison.depart.lat, livraison.depart.lng], [livraison.arrivee.lat, livraison.arrivee.lng]], { color: '#1A4FBF', weight: 3, opacity: 0.6, dashArray: '6, 10' }).addTo(map)
        map.fitBounds(L.latLngBounds([[defaultCenter[0], defaultCenter[1]], [livraison.depart.lat, livraison.depart.lng], [livraison.arrivee.lat, livraison.arrivee.lng]]).pad(0.2))
      } else {
        map.setView(defaultCenter, 14)
      }
      if (navigator.geolocation) {
        watchId.current = navigator.geolocation.watchPosition(
          (pos) => { selfMarker.current?.setLatLng([pos.coords.latitude, pos.coords.longitude]); onPositionChange?.(pos.coords.latitude, pos.coords.longitude) },
          (err) => console.warn('[MapCoursier] GPS:', err),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
        )
      }
    }
    initMap()
    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
      mapInstance.current?.remove(); mapInstance.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return <div ref={mapRef} className="w-full h-full" />
}
