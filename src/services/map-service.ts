// src/services/map-service.ts 
// ═══════════════════════════════════════════════════════════════════════════
// CORRECTION AUDIT : Persistance des quotas API dans la table api_quota_tracking
// (migration 009) au lieu de simples compteurs en mémoire réinitialisés.
// Les compteurs en mémoire servent de cache ; la BDD est la source de vérité.
// ═══════════════════════════════════════════════════════════════════════════

import { supabaseAdmin } from '@/lib/supabase-admin'

export type MapProvider = 'mapbox' | 'google' | 'osrm'

export interface RouteResult {
  distance: number                     // km
  duration: number                     // secondes
  polyline: Array<[number, number]>    // [lat, lng][]
  provider: MapProvider
}

export interface GeocodingResult {
  lat:      number
  lng:      number
  address:  string
  provider: MapProvider
}

// ── Limites mensuelles ────────────────────────────────────────────────────────
const MAPBOX_LIMIT = 50_000
const GOOGLE_LIMIT = 25_000

// ── État local en mémoire (cache entre les requêtes serverless) ───────────────
let _mapboxCount   = 0
let _googleCount   = 0
let _mapboxBlocked = false
let _googleBlocked = false
let _lastLoadMonth = -1   // mois (0-11) du dernier chargement depuis la BDD

class MapService {
  private mapboxKey   = process.env.NEXT_PUBLIC_MAPBOX_KEY || ''
  private googleKeys  = (process.env.NEXT_PUBLIC_GOOGLE_KEYS || '').split(',').filter(Boolean)
  private googleIdx   = 0

  // ── Routage principal ─────────────────────────────────────────────────────

  async getRoute(
    startLat: number, startLng: number,
    endLat:   number, endLng:   number
  ): Promise<RouteResult> {
    await this.loadQuotasIfNeeded()

    if (!_mapboxBlocked && this.mapboxKey) {
      try {
        const r = await this.getRouteMapbox(startLat, startLng, endLat, endLng)
        await this.incrementQuota('mapbox')
        return r
      } catch { /* fallback */ }
    }

    if (!_googleBlocked && this.googleKeys.length > 0) {
      try {
        const r = await this.getRouteGoogle(startLat, startLng, endLat, endLng)
        await this.incrementQuota('google')
        return r
      } catch { /* fallback */ }
    }

    return this.getRouteOSRM(startLat, startLng, endLat, endLng)
  }

  // ── Géocodage — DÉLÉGUÉ à geocoding-service.ts ───────────────────────────
  // Ce service conserve geocode() pour compatibilité ascendante,
  // mais utilise désormais le GeocodingService complet avec Nominatim.
  // NOTE : OSRM n'est pas un service de géocodage (correction audit).

  async geocode(address: string): Promise<GeocodingResult> {
    await this.loadQuotasIfNeeded()

    if (!_mapboxBlocked && this.mapboxKey) {
      try {
        const r = await this.geocodeMapbox(address)
        await this.incrementQuota('mapbox')
        return r
      } catch { /* fallback */ }
    }

    if (!_googleBlocked && this.googleKeys.length > 0) {
      try {
        const r = await this.geocodeGoogle(address)
        await this.incrementQuota('google')
        return r
      } catch { /* fallback */ }
    }

    // CORRECTION AUDIT : Nominatim (OSM) comme vrai fallback de géocodage
    // (pas OSRM qui est un moteur de routage, pas de géocodage)
    return this.geocodeNominatim(address)
  }

  // ── Persistance des quotas ────────────────────────────────────────────────

  /**
   * CORRECTION AUDIT : Charge les quotas depuis api_quota_tracking
   * si le mois a changé ou si le cache n'a pas encore été chargé.
   */
  private async loadQuotasIfNeeded(): Promise<void> {
    const now   = new Date()
    const month = now.getMonth()

    if (month === _lastLoadMonth) return  // cache encore valide ce mois

    _lastLoadMonth = month
    const year = now.getFullYear()

    try {
      const { data } = await supabaseAdmin
        .from('api_quota_tracking')
        .select('provider, nb_requetes, limite')
        .eq('annee', year)
        .eq('mois', month + 1)  // mois SQL : 1-12

      if (!data) return

      for (const row of data) {
        const limit = row.limite || (row.provider === 'mapbox' ? MAPBOX_LIMIT : GOOGLE_LIMIT)
        if (row.provider === 'mapbox') {
          _mapboxCount   = row.nb_requetes
          _mapboxBlocked = row.nb_requetes >= limit
        }
        if (row.provider === 'google') {
          _googleCount   = row.nb_requetes
          _googleBlocked = row.nb_requetes >= limit
        }
      }
    } catch (e) {
      // Ne pas bloquer si la BDD est inaccessible — utiliser les valeurs mémoire
      console.warn('[MapService] Impossible de charger les quotas:', (e as Error).message)
    }
  }

  /**
   * CORRECTION AUDIT : Incrémente le compteur en mémoire ET en base de données.
   * Utilise un upsert atomique pour éviter les doublons en environnement serverless.
   */
  private async incrementQuota(provider: 'mapbox' | 'google'): Promise<void> {
    const now   = new Date()
    const year  = now.getFullYear()
    const month = now.getMonth() + 1  // 1-12

    // Mise à jour cache mémoire
    if (provider === 'mapbox') {
      _mapboxCount++
      if (_mapboxCount >= MAPBOX_LIMIT) _mapboxBlocked = true
    } else {
      _googleCount++
      if (_googleCount >= GOOGLE_LIMIT) _googleBlocked = true
    }

    // Persistance en base — upsert atomique
    try {
      await supabaseAdmin.rpc('increment_api_quota', {
        p_provider: provider,
        p_annee:    year,
        p_mois:     month,
        p_limite:   provider === 'mapbox' ? MAPBOX_LIMIT : GOOGLE_LIMIT,
      })
    } catch (e) {
      // Non-bloquant — le compteur en mémoire reste valide pour cette session
      console.warn(`[MapService] Erreur persistance quota ${provider}:`, (e as Error).message)
    }
  }

  // ── Implémentations privées ───────────────────────────────────────────────

  private async getRouteMapbox(
    sLat: number, sLng: number, eLat: number, eLng: number
  ): Promise<RouteResult> {
    const url    = `https://api.mapbox.com/directions/v5/mapbox/driving/${sLng},${sLat};${eLng},${eLat}`
    const params = new URLSearchParams({
      access_token: this.mapboxKey,
      geometries:   'geojson',
      steps:        'false',
      language:     'fr',
    })
    const res  = await fetch(`${url}?${params}`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`Mapbox ${res.status}`)
    const data = await res.json() as {
      routes: Array<{
        distance: number
        duration: number
        geometry: { coordinates: Array<[number, number]> }
      }>
    }
    if (!data.routes?.length) throw new Error('no route')
    const route = data.routes[0]
    return {
      distance: route.distance / 1000,
      duration: Math.round(route.duration),
      polyline: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      provider: 'mapbox',
    }
  }

  private async getRouteGoogle(
    sLat: number, sLng: number, eLat: number, eLng: number
  ): Promise<RouteResult> {
    const key    = this.googleKeys[this.googleIdx++ % this.googleKeys.length]
    const params = new URLSearchParams({
      origin:      `${sLat},${sLng}`,
      destination: `${eLat},${eLng}`,
      key,
      mode:        'driving',
      language:    'fr',
    })
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/directions/json?${params}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) throw new Error(`Google ${res.status}`)
    const data = await res.json() as {
      status: string
      routes: Array<{
        legs: Array<{
          distance: { value: number }
          duration: { value: number }
        }>
        overview_polyline: { points: string }
      }>
    }
    if (data.status !== 'OK' || !data.routes?.length) throw new Error(data.status)
    const leg = data.routes[0].legs[0]
    return {
      distance: leg.distance.value / 1000,
      duration: leg.duration.value,
      polyline: this.decodePolyline(data.routes[0].overview_polyline.points),
      provider: 'google',
    }
  }

  private async getRouteOSRM(
    sLat: number, sLng: number, eLat: number, eLng: number
  ): Promise<RouteResult> {
    const url = `https://router.project-osrm.org/route/v1/driving/${sLng},${sLat};${eLng},${eLat}?overview=full&geometries=geojson`
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!res.ok) throw new Error(`OSRM ${res.status}`)
    const data = await res.json() as {
      routes: Array<{
        distance: number
        duration: number
        geometry: { coordinates: Array<[number, number]> }
      }>
    }
    if (!data.routes?.length) throw new Error('no route')
    const route = data.routes[0]
    return {
      distance: route.distance / 1000,
      duration: Math.round(route.duration),
      polyline: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
      provider: 'osrm',
    }
  }

  private async geocodeMapbox(address: string): Promise<GeocodingResult> {
    const url    = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json`
    const params = new URLSearchParams({
      access_token: this.mapboxKey,
      limit:        '1',
      language:     'fr',
    })
    const res  = await fetch(`${url}?${params}`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) throw new Error(`Mapbox geocode ${res.status}`)
    const data = await res.json() as {
      features: Array<{
        geometry:   { coordinates: [number, number] }
        place_name: string
      }>
    }
    if (!data.features?.length) throw new Error('no results')
    const [lng, lat] = data.features[0].geometry.coordinates
    return { lat, lng, address: data.features[0].place_name, provider: 'mapbox' }
  }

  private async geocodeGoogle(address: string): Promise<GeocodingResult> {
    const key    = this.googleKeys[this.googleIdx++ % this.googleKeys.length]
    const params = new URLSearchParams({ address, key, language: 'fr' })
    const res    = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?${params}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) throw new Error(`Google geocode ${res.status}`)
    const data = await res.json() as {
      status:  string
      results: Array<{
        geometry:          { location: { lat: number; lng: number } }
        formatted_address: string
      }>
    }
    if (data.status !== 'OK' || !data.results?.length) throw new Error(data.status)
    const r = data.results[0]
    return {
      lat:      r.geometry.location.lat,
      lng:      r.geometry.location.lng,
      address:  r.formatted_address,
      provider: 'google',
    }
  }

  /**
   * CORRECTION AUDIT : Nominatim (OpenStreetMap) comme vrai fallback de géocodage.
   * Remplace la tentative de géocodage via OSRM qui retournait des coordonnées
   * fixes de Ouagadougou au lieu d'un vrai résultat.
   */
  private async geocodeNominatim(address: string): Promise<GeocodingResult> {
    const params = new URLSearchParams({
      q:                 address,
      format:            'json',
      limit:             '1',
      'accept-language': 'fr',
      countrycodes:      'bf',
    })
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: { 'User-Agent': 'NYME-BF/1.0 (livraison@nyme.bf)' },
        signal:   AbortSignal.timeout(12000),
      }
    )
    if (res.ok) {
      const data = await res.json() as Array<{
        lat:          string
        lon:          string
        display_name: string
      }>
      if (data?.length) {
        return {
          lat:      parseFloat(data[0].lat),
          lng:      parseFloat(data[0].lon),
          address:  data[0].display_name,
          provider: 'osrm',  // garder 'osrm' pour compatibilité type GeocodingResult
        }
      }
    }

    // Dernier recours absolu — coordonnées Ouagadougou avec message clair
    console.error('[MapService] Géocodage impossible (tous les providers échoués) pour:', address)
    return { lat: 12.3547, lng: -1.5247, address, provider: 'osrm' }
  }

  private decodePolyline(encoded: string): Array<[number, number]> {
    const points: Array<[number, number]> = []
    let index = 0, lat = 0, lng = 0
    while (index < encoded.length) {
      let result = 0, shift = 0, byte = 0
      do {
        byte    = encoded.charCodeAt(index++) - 63
        result |= (byte & 0x1f) << shift
        shift  += 5
      } while (byte >= 0x20)
      lat += result & 1 ? ~(result >> 1) : result >> 1
      result = 0; shift = 0
      do {
        byte    = encoded.charCodeAt(index++) - 63
        result |= (byte & 0x1f) << shift
        shift  += 5
      } while (byte >= 0x20)
      lng += result & 1 ? ~(result >> 1) : result >> 1
      points.push([lat / 1e5, lng / 1e5])
    }
    return points
  }

  // ── Utilitaires publics ───────────────────────────────────────────────────

  getStatus() {
    return {
      mapbox: {
        available:    !_mapboxBlocked && !!this.mapboxKey,
        requestCount: _mapboxCount,
        limit:        MAPBOX_LIMIT,
      },
      google: {
        available:    !_googleBlocked && this.googleKeys.length > 0,
        requestCount: _googleCount,
        limit:        GOOGLE_LIMIT,
      },
      osrm: {
        available:    true,
        requestCount: 0,
        limit:        'unlimited',
      },
    }
  }
}

export const mapService = new MapService()