// src/components/MapAdvanced.tsx
'use client'
import { useEffect, useRef, useState } from 'react'
import { mapService } from '@/services/map-service'
import type { RouteResult } from '@/services/map-service'

interface Location {
  lat: number
  lng: number
  label?: string
}

interface CoursierLocation extends Location {
  nom?: string
}

interface MapAdvancedProps {
  depart?: Location
  arrivee?: Location
  coursier?: CoursierLocation
  route?: RouteResult
  onLocationSelect?: (lat: number, lng: number, label: string) => void
  zoom?: number
}

const DEFAULT_CENTER: [number, number] = [12.3714, -1.5197]
const DEFAULT_ZOOM = 13

export default function MapAdvanced({ depart, arrivee, coursier, route, onLocationSelect, zoom = DEFAULT_ZOOM }: MapAdvancedProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<L.Map | null>(null)
  const [, setReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return

    const initMap = async () => {
      const L = (await import('leaflet')).default
      await import('leaflet/dist/leaflet.css')

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      if (mapInstance.current) {
        mapInstance.current.remove()
        mapInstance.current = null
      }

      // Calculer le centre
      let center: [number, number] = DEFAULT_CENTER
      if (depart && arrivee) {
        center = [(depart.lat + arrivee.lat) / 2, (depart.lng + arrivee.lng) / 2]
      } else if (depart) {
        center = [depart.lat, depart.lng]
      } else if (coursier) {
        center = [coursier.lat, coursier.lng]
      }

      const map = L.map(mapRef.current!, { zoomControl: true, attributionControl: false })
      mapInstance.current = map
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
      map.setView(center, zoom)

      // Marqueur départ
      if (depart) {
        const departIcon = L.divIcon({
          html: `<div style="background:#22C55E;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:13px;color:white;font-weight:bold;">D</div>`,
          iconSize: [28, 28], iconAnchor: [14, 14], className: '',
        })
        L.marker([depart.lat, depart.lng], { icon: departIcon }).addTo(map)
          .bindPopup(`<b>Départ</b>${depart.label ? '<br>' + depart.label : ''}`)
      }

      // Marqueur arrivée
      if (arrivee) {
        const arriveeIcon = L.divIcon({
          html: `<div style="background:#EF4444;width:28px;height:28px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:13px;color:white;font-weight:bold;">A</div>`,
          iconSize: [28, 28], iconAnchor: [14, 14], className: '',
        })
        L.marker([arrivee.lat, arrivee.lng], { icon: arriveeIcon }).addTo(map)
          .bindPopup(`<b>Destination</b>${arrivee.label ? '<br>' + arrivee.label : ''}`)
      }

      // Marqueur coursier
      if (coursier) {
        const coursierIcon = L.divIcon({
          html: `<div style="background:#E87722;width:36px;height:36px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:18px;">🛵</div>`,
          iconSize: [36, 36], iconAnchor: [18, 18], className: '',
        })
        L.marker([coursier.lat, coursier.lng], { icon: coursierIcon, zIndexOffset: 1000 }).addTo(map)
          .bindPopup(`<b>${coursier.nom || 'Coursier'}</b>`)
      }

      // Polyline route
      if (route?.polyline?.length) {
        L.polyline(route.polyline as [number, number][], { color: '#1A4FBF', weight: 4, opacity: 0.7 }).addTo(map)
      }

      // Fit bounds si départ + arrivée
      if (depart && arrivee) {
        const points: [number, number][] = [[depart.lat, depart.lng], [arrivee.lat, arrivee.lng]]
        if (coursier) points.push([coursier.lat, coursier.lng])
        map.fitBounds(L.latLngBounds(points).pad(0.2))
      }

      // Click handler — corrigé : geocode retourne GeocodingResult (pas un tableau)
      if (onLocationSelect) {
        map.on('click', async (e: L.LeafletMouseEvent) => {
          try {
            const result = await mapService.geocode(`${e.latlng.lat},${e.latlng.lng}`)
            // result est un GeocodingResult, pas un tableau
            const address = result.address || `Point (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`
            onLocationSelect(e.latlng.lat, e.latlng.lng, address)
          } catch {
            onLocationSelect(e.latlng.lat, e.latlng.lng, `Point (${e.latlng.lat.toFixed(4)}, ${e.latlng.lng.toFixed(4)})`)
          }
        })
      }

      setReady(true)
    }

    initMap()

    return () => {
      mapInstance.current?.remove()
      mapInstance.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depart?.lat, depart?.lng, arrivee?.lat, arrivee?.lng, coursier?.lat, coursier?.lng])

  return <div ref={mapRef} className="w-full h-full" />
}
