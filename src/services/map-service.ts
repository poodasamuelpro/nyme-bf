import type { LatLngTuple } from 'leaflet'
import axios from 'axios'

interface RouteData {
  distance: number
  duration: number
  geometry: string // Encoded polyline
}

interface GeocodeResult {
  label: string
  lat: number
  lng: number
}

class MapService {
  private googleApiKeys: string[]
  private mapboxApiKey: string
  private osrmUrl: string
  private currentGoogleKeyIndex: number = 0

  constructor() {
    this.googleApiKeys = process.env.NEXT_PUBLIC_GOOGLE_KEYS?.split(',') || []
    this.mapboxApiKey = process.env.NEXT_PUBLIC_MAPBOX_KEY || ''
    this.osrmUrl = process.env.NEXT_PUBLIC_OSRM_URL || 'https://router.project-osrm.org'
  }

  private getNextGoogleApiKey(): string | null {
    if (this.googleApiKeys.length === 0) return null
    const key = this.googleApiKeys[this.currentGoogleKeyIndex]
    this.currentGoogleKeyIndex = (this.currentGoogleKeyIndex + 1) % this.googleApiKeys.length
    return key
  }

  async getRoute(startLat: number, startLng: number, endLat: number, endLng: number): Promise<RouteData> {
    // Try Mapbox first
    if (this.mapboxApiKey) {
      try {
        const response = await axios.get(
          `https://api.mapbox.com/directions/v5/mapbox/driving/${startLng},${startLat};${endLng},${endLat}`,
          {
            params: {
              geometries: 'geojson',
              steps: false,
              access_token: this.mapboxApiKey,
            },
          }
        )
        const route = response.data.routes[0]
        if (route) {
          return {
            distance: route.distance / 1000, // km
            duration: route.duration / 60, // minutes
            geometry: this.encodePolyline(route.geometry.coordinates),
          }
        }
      } catch (error) {
        console.warn('Mapbox route failed, trying Google Maps:', error)
      }
    }

    // Try Google Maps
    if (this.googleApiKeys.length > 0) {
      let googleKey = this.getNextGoogleApiKey()
      while (googleKey) {
        try {
          const response = await axios.get(
            `https://maps.googleapis.com/maps/api/directions/json`,
            {
              params: {
                origin: `${startLat},${startLng}`,
                destination: `${endLat},${endLng}`,
                key: googleKey,
              },
            }
          )
          const route = response.data.routes[0]
          if (route) {
            return {
              distance: route.legs[0].distance.value / 1000,
              duration: route.legs[0].duration.value / 60,
              geometry: route.overview_polyline.points,
            }
          }
        } catch (error) {
          console.warn('Google Maps route failed, trying next key or OSRM:', error)
          googleKey = this.getNextGoogleApiKey()
          if (googleKey === this.googleApiKeys[0]) {
            googleKey = null
          }
        }
      }
    }

    // Fallback to OSRM
    try {
      const response = await axios.get(
        `${this.osrmUrl}/route/v1/driving/${startLng},${startLat};${endLng},${endLat}`,
        {
          params: {
            geometries: 'geojson',
            overview: 'full',
            steps: false,
          },
        }
      )
      const route = response.data.routes[0]
      if (route) {
        return {
          distance: route.distance / 1000,
          duration: route.duration / 60,
          geometry: this.encodePolyline(route.geometry.coordinates),
        }
      }
    } catch (error) {
      console.error('OSRM route failed:', error)
    }

    throw new Error('Unable to get route from any map service.')
  }

  async geocode(address: string): Promise<GeocodeResult[]> {
    // Try Mapbox first
    if (this.mapboxApiKey) {
      try {
        const response = await axios.get(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`,
          {
            params: {
              access_token: this.mapboxApiKey,
              limit: 5,
            },
          }
        )
        return response.data.features.map((feature: any) => ({
          label: feature.place_name,
          lat: feature.center[1],
          lng: feature.center[0],
        }))
      } catch (error) {
        console.warn('Mapbox geocode failed, trying Google Maps:', error)
      }
    }

    // Try Google Maps
    if (this.googleApiKeys.length > 0) {
      let googleKey = this.getNextGoogleApiKey()
      while (googleKey) {
        try {
          const response = await axios.get(
            `https://maps.googleapis.com/maps/api/geocode/json`,
            {
              params: {
                address: encodeURIComponent(address),
                key: googleKey,
              },
            }
          )
          return response.data.results.map((result: any) => ({
            label: result.formatted_address,
            lat: result.geometry.location.lat,
            lng: result.geometry.location.lng,
          }))
        } catch (error) {
          console.warn('Google Maps geocode failed, trying next key:', error)
          googleKey = this.getNextGoogleApiKey()
          if (googleKey === this.googleApiKeys[0]) {
            googleKey = null
          }
        }
      }
    }

    // Fallback to OpenStreetMap Nominatim
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/search`,
        {
          params: {
            q: address,
            format: 'json',
            limit: 5,
          },
        }
      )
      return response.data.map((result: any) => ({
        label: result.display_name,
        lat: parseFloat(result.lat),
        lng: parseFloat(result.lon),
      }))
    } catch (error) {
      console.error('Nominatim geocode failed:', error)
    }

    throw new Error('Unable to geocode address from any map service.')
  }

  private encodePolyline(coordinates: [number, number][]): string {
    let encoded = '';
    let prevLat = 0;
    let prevLng = 0;

    for (let i = 0; i < coordinates.length; i++) {
      const [lng, lat] = coordinates[i];
      const iLat = Math.round(lat * 1e5);
      const iLng = Math.round(lng * 1e5);

      let dLat = iLat - prevLat;
      let dLng = iLng - prevLng;

      prevLat = iLat;
      prevLng = iLng;

      encoded += this.encodeCoord(dLat);
      encoded += this.encodeCoord(dLng);
    }

    return encoded;
  }

  private encodeCoord(coord: number): string {
    coord = coord < 0 ? ~(coord << 1) : (coord << 1);
    let encoded = '';
    while (coord >= 0x20) {
      encoded += String.fromCharCode((0x20 | (coord & 0x1f)) + 63);
      coord >>= 5;
    }
    encoded += String.fromCharCode(coord + 63);
    return encoded;
  }
}

export const mapService = new MapService()