'use client'
import React, { useEffect, useRef, useState, useMemo } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import L, { LatLngTuple } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { mapService } from '@/services/map-service'
import polyline from '@mapbox/polyline'

if (typeof window !== 'undefined') {
  // @ts-ignore
  delete L.Icon.Default.prototype._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  })
}

interface Location { lat: number; lng: number; label?: string }
interface MapAdvancedProps {
  depart?: Location; arrivee?: Location; coursier?: Location & { nom?: string };
  route?: any; onLocationSelect?: (lat: number, lng: number, label: string) => void; zoom?: number;
}

const RecenterAutomatically = ({ center, zoom }: { center: LatLngTuple; zoom: number }) => {
  const map = useMap()
  useEffect(() => { map.setView(center, zoom) }, [center, zoom, map])
  return null
}

const MapClickHandler = ({ onClick }: { onClick?: (e: L.LeafletMouseEvent) => void }) => {
  const map = useMap()
  useEffect(() => {
    if (!onClick) return
    map.on('click', onClick)
    return () => { map.off('click', onClick) }
  }, [map, onClick])
  return null
}

const MapAdvanced: React.FC<MapAdvancedProps> = ({ depart, arrivee, coursier, route, onLocationSelect, zoom = 13 }) => {
  const [mapCenter, setMapCenter] = useState<LatLngTuple>([12.3714, -1.5197])
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    if (depart) setMapCenter([depart.lat, depart.lng])
    else if (coursier) setMapCenter([coursier.lat, coursier.lng])
  }, [depart, coursier])

  const handleMapClick = async (e: L.LeafletMouseEvent) => {
    if (!onLocationSelect) return
    const results = await mapService.geocode(`${e.latlng.lat},${e.latlng.lng}`)
    const address = results[0]?.address || `Point (${e.latlng.lat.toFixed(4)})`
    onLocationSelect(e.latlng.lat, e.latlng.lng, address)
  }

  const polylinePoints = useMemo(() => {
    if (!route) return []
    if (Array.isArray(route.polyline)) return route.polyline
    if (typeof route.geometry === 'string') return polyline.decode(route.geometry)
    return []
  }, [route])

  return (
    <MapContainer center={mapCenter} zoom={zoom} scrollWheelZoom style={{ height: '100%', width: '100%' }} ref={mapRef}>
      <MapClickHandler onClick={handleMapClick} />
      <RecenterAutomatically center={mapCenter} zoom={zoom} />
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {depart && <Marker position={[depart.lat, depart.lng]}><Popup>{depart.label || 'Départ'}</Popup></Marker>}
      {arrivee && <Marker position={[arrivee.lat, arrivee.lng]}><Popup>{arrivee.label || 'Arrivée'}</Popup></Marker>}
      {polylinePoints.length > 0 && <Polyline positions={polylinePoints} color="#1a73e8" weight={5} />}
    </MapContainer>
  )
}

export default MapAdvanced
