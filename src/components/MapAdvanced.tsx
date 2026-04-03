import React, { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet'
import L, { LatLngTuple } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { mapService } from '@/services/map-service'
import polyline from '@mapbox/polyline'

// Fix default icon issues with Webpack
if (typeof window !== 'undefined') {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

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
  route?: any
  onLocationSelect?: (lat: number, lng: number, label: string) => void
  zoom?: number
}

const DEFAULT_CENTER: LatLngTuple = [12.3714, -1.5197]
const DEFAULT_ZOOM = 13

// Composant pour recentrer la carte
const RecenterAutomatically = ({ center, zoom }: { center: LatLngTuple; zoom: number }) => {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom)
  }, [center, zoom, map])
  return null
}

// Composant pour gérer les événements de clic (Remplace onClick sur MapContainer)
const MapEvents = ({ onClick }: { onClick: (e: L.LeafletMouseEvent) => void }) => {
  useMapEvents({
    click: onClick,
  })
  return null
}

const MapAdvanced: React.FC<MapAdvancedProps> = ({
  depart,
  arrivee,
  coursier,
  route,
  onLocationSelect,
  zoom = DEFAULT_ZOOM,
}) => {
  const [mapCenter, setMapCenter] = useState<LatLngTuple>(DEFAULT_CENTER)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (depart && arrivee) {
      const bounds = L.latLngBounds([depart.lat, depart.lng], [arrivee.lat, arrivee.lng])
      const center = bounds.getCenter()
      setMapCenter([center.lat, center.lng])
    } else if (depart) {
      setMapCenter([depart.lat, depart.lng])
    } else if (coursier) {
      setMapCenter([coursier.lat, coursier.lng])
    }
  }, [depart, arrivee, coursier])

  const handleMapClick = async (e: L.LeafletMouseEvent) => {
    if (onLocationSelect) {
      try {
        const results = await mapService.geocode(`${e.latlng.lat},${e.latlng.lng}`)
        if (results && results.length > 0) {
          onLocationSelect(e.latlng.lat, e.latlng.lng, results[0].label)
        } else {
          onLocationSelect(e.latlng.lat, e.latlng.lng, `Lat: ${e.latlng.lat.toFixed(4)}, Lng: ${e.latlng.lng.toFixed(4)}`)
        }
      } catch (error) {
        console.error("Error during reverse geocoding:", error)
        onLocationSelect(e.latlng.lat, e.latlng.lng, `Lat: ${e.latlng.lat.toFixed(4)}, Lng: ${e.latlng.lng.toFixed(4)}`)
      }
    }
  }

  // @ts-ignore - Polyline decode peut retourner des types variés selon la version
  const decodedPolyline: LatLngTuple[] = route?.geometry ? polyline.decode(route.geometry) : []

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <MapContainer
        center={mapCenter}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        ref={mapRef}
      >
        {/* Gestionnaire d'événements interne */}
        <MapEvents onClick={handleMapClick} />
        
        <RecenterAutomatically center={mapCenter} zoom={zoom} />
        
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {depart && (
          <Marker position={[depart.lat, depart.lng]}>
            <Popup>{depart.label || 'Point de départ'}</Popup>
          </Marker>
        )}

        {arrivee && (
          <Marker position={[arrivee.lat, arrivee.lng]}>
            <Popup>{arrivee.label || "Point d'arrivée"}</Popup>
          </Marker>
        )}

        {coursier && (
          <Marker position={[coursier.lat, coursier.lng]}>
            <Popup>{coursier.nom || 'Coursier'}</Popup>
          </Marker>
        )}

        {decodedPolyline.length > 0 && (
          <Polyline positions={decodedPolyline} color="#1a73e8" weight={5} />
        )}
      </MapContainer>
    </div>
  )
}

export default MapAdvanced
