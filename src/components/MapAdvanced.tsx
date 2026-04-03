import React, { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { mapService } from '@/services/map-service'

// Fix default icon issues with Webpack
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

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
  route?: any // Route data from mapService
  onLocationSelect?: (lat: number, lng: number, label: string) => void
  zoom?: number
}

const DEFAULT_CENTER: LatLngTuple = [12.3714, -1.5197] // Ouagadougou, Burkina Faso
const DEFAULT_ZOOM = 13

const RecenterAutomatically = ({ center, zoom }: { center: LatLngTuple; zoom: number }) => {
  const map = useMap()
  useEffect(() => {
    map.setView(center, zoom)
  }, [center, zoom, map])
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
      setMapCenter(bounds.getCenter().toArray() as LatLngTuple)
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
        if (results.length > 0) {
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

  const decodedPolyline = route?.geometry ? L.Polyline.decode(route.geometry) : []

  return (
    <MapContainer
      center={mapCenter}
      zoom={zoom}
      scrollWheelZoom={true}
      style={{ height: '100%', width: '100%' }}
      whenCreated={mapInstance => {
        mapRef.current = mapInstance
      }}
      onClick={handleMapClick}
    >
      <RecenterAutomatically center={mapCenter} zoom={zoom} />
      <TileLayer
        attribution=
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {depart && (
        <Marker position={[depart.lat, depart.lng]}>
          <Popup>{depart.label || 'Point de départ'}</Popup>
        </Marker>
      )}

      {arrivee && (
        <Marker position={[arrivee.lat, arrivee.lng]}>
          <Popup>{arrivee.label || 'Point d\'arrivée'}</Popup>
        </Marker>
      )}

      {coursier && (
        <Marker
          position={[coursier.lat, coursier.lng]}
          icon={L.icon({
            iconUrl: '/images/moto-marker.png', // Assurez-vous d\'avoir cette image
            iconSize: [32, 32],
            iconAnchor: [16, 32],
          })}
        >
          <Popup>{coursier.nom || 'Coursier'}</Popup>
        </Marker>
      )}

      {decodedPolyline.length > 0 && (
        <Polyline positions={decodedPolyline} color="#1a73e8" weight={5} />
      )}
    </MapContainer>
  )
}

export default MapAdvanced
