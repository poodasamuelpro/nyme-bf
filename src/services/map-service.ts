// src/services/map-service.ts
export type MapProvider = 'mapbox' | 'google' | 'osrm'

export interface RouteResult {
  distance: number
  duration: number
  polyline: Array<[number, number]>
  provider: MapProvider
}

export interface GeocodingResult {
  lat: number
  lng: number
  address: string
  provider: MapProvider
}

class MapService {
  private mapboxKey = process.env.NEXT_PUBLIC_MAPBOX_KEY || ''
  private googleKeys = (process.env.NEXT_PUBLIC_GOOGLE_KEYS || '').split(',').filter(Boolean)
  private googleKeyIndex = 0
  private mapboxRequestCount = 0
  private googleRequestCount = 0
  private mapboxLimitReached = false
  private googleLimitReached = false
  private readonly MAPBOX_LIMIT = 50000
  private readonly GOOGLE_LIMIT = 25000

  async getRoute(startLat: number, startLng: number, endLat: number, endLng: number): Promise<RouteResult> {
    if (!this.mapboxLimitReached && this.mapboxKey) {
      try {
        const r = await this.getRouteMapbox(startLat, startLng, endLat, endLng)
        if (++this.mapboxRequestCount >= this.MAPBOX_LIMIT) this.mapboxLimitReached = true
        return r
      } catch { /* fallthrough */ }
    }
    if (!this.googleLimitReached && this.googleKeys.length > 0) {
      try {
        const r = await this.getRouteGoogle(startLat, startLng, endLat, endLng)
        if (++this.googleRequestCount >= this.GOOGLE_LIMIT) this.googleLimitReached = true
        return r
      } catch { /* fallthrough */ }
    }
    return this.getRouteOSRM(startLat, startLng, endLat, endLng)
  }

  async geocode(address: string): Promise<GeocodingResult> {
    if (!this.mapboxLimitReached && this.mapboxKey) {
      try { return await this.geocodeMapbox(address) } catch { /* fallthrough */ }
    }
    if (!this.googleLimitReached && this.googleKeys.length > 0) {
      try { return await this.geocodeGoogle(address) } catch { /* fallthrough */ }
    }
    return { lat: 12.3547, lng: -1.5247, address, provider: 'osrm' }
  }

  private async getRouteMapbox(sLat: number, sLng: number, eLat: number, eLng: number): Promise<RouteResult> {
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${sLng},${sLat};${eLng},${eLat}`
    const params = new URLSearchParams({ access_token: this.mapboxKey, geometries: 'geojson', steps: 'false', language: 'fr' })
    const res = await fetch(`${url}?${params}`)
    if (!res.ok) throw new Error(`Mapbox ${res.status}`)
    const data = await res.json() as { routes: Array<{ distance: number; duration: number; geometry: { coordinates: Array<[number, number]> } }> }
    if (!data.routes?.length) throw new Error('no route')
    const route = data.routes[0]
    return { distance: route.distance / 1000, duration: Math.round(route.duration), polyline: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]), provider: 'mapbox' }
  }

  private async getRouteGoogle(sLat: number, sLng: number, eLat: number, eLng: number): Promise<RouteResult> {
    const key = this.googleKeys[this.googleKeyIndex++ % this.googleKeys.length]
    const params = new URLSearchParams({ origin: `${sLat},${sLng}`, destination: `${eLat},${eLng}`, key, mode: 'driving', language: 'fr' })
    const res = await fetch(`https://maps.googleapis.com/maps/api/directions/json?${params}`)
    if (!res.ok) throw new Error(`Google ${res.status}`)
    const data = await res.json() as { status: string; routes: Array<{ legs: Array<{ distance: { value: number }; duration: { value: number } }>; overview_polyline: { points: string } }> }
    if (data.status !== 'OK' || !data.routes?.length) throw new Error(data.status)
    const leg = data.routes[0].legs[0]
    return { distance: leg.distance.value / 1000, duration: leg.duration.value, polyline: this.decodePolyline(data.routes[0].overview_polyline.points), provider: 'google' }
  }

  private async getRouteOSRM(sLat: number, sLng: number, eLat: number, eLng: number): Promise<RouteResult> {
    const url = `https://router.project-osrm.org/route/v1/driving/${sLng},${sLat};${eLng},${eLat}?overview=full&geometries=geojson`
    const res = await fetch(url)
    if (!res.ok) throw new Error(`OSRM ${res.status}`)
    const data = await res.json() as { routes: Array<{ distance: number; duration: number; geometry: { coordinates: Array<[number, number]> } }> }
    if (!data.routes?.length) throw new Error('no route')
    const route = data.routes[0]
    return { distance: route.distance / 1000, duration: Math.round(route.duration), polyline: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]), provider: 'osrm' }
  }

  private async geocodeMapbox(address: string): Promise<GeocodingResult> {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`
    const params = new URLSearchParams({ access_token: this.mapboxKey, limit: '1', language: 'fr' })
    const res = await fetch(`${url}?${params}`)
    if (!res.ok) throw new Error(`Mapbox geocode ${res.status}`)
    const data = await res.json() as { features: Array<{ geometry: { coordinates: [number, number] }; place_name: string }> }
    if (!data.features?.length) throw new Error('no results')
    const [lng, lat] = data.features[0].geometry.coordinates
    return { lat, lng, address: data.features[0].place_name, provider: 'mapbox' }
  }

  private async geocodeGoogle(address: string): Promise<GeocodingResult> {
    const key = this.googleKeys[this.googleKeyIndex++ % this.googleKeys.length]
    const params = new URLSearchParams({ address, key, language: 'fr' })
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`)
    if (!res.ok) throw new Error(`Google geocode ${res.status}`)
    const data = await res.json() as { status: string; results: Array<{ geometry: { location: { lat: number; lng: number } }; formatted_address: string }> }
    if (data.status !== 'OK' || !data.results?.length) throw new Error(data.status)
    const r = data.results[0]
    return { lat: r.geometry.location.lat, lng: r.geometry.location.lng, address: r.formatted_address, provider: 'google' }
  }

  private decodePolyline(encoded: string): Array<[number, number]> {
    const points: Array<[number, number]> = []
    let index = 0, lat = 0, lng = 0
    while (index < encoded.length) {
      let result = 0, shift = 0, byte = 0
      do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5 } while (byte >= 0x20)
      lat += result & 1 ? ~(result >> 1) : result >> 1
      result = 0; shift = 0
      do { byte = encoded.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5 } while (byte >= 0x20)
      lng += result & 1 ? ~(result >> 1) : result >> 1
      points.push([lat / 1e5, lng / 1e5])
    }
    return points
  }

  resetMonthlyCounters() {
    if (new Date().getDate() === 1) {
      this.mapboxRequestCount = 0; this.googleRequestCount = 0
      this.mapboxLimitReached = false; this.googleLimitReached = false
    }
  }

  getStatus() {
    return {
      mapbox: { available: !this.mapboxLimitReached && !!this.mapboxKey, requestCount: this.mapboxRequestCount, limit: this.MAPBOX_LIMIT },
      google: { available: !this.googleLimitReached && this.googleKeys.length > 0, requestCount: this.googleRequestCount, limit: this.GOOGLE_LIMIT },
      osrm:   { available: true, requestCount: 0, limit: 'unlimited' },
    }
  }
}

export const mapService = new MapService()
