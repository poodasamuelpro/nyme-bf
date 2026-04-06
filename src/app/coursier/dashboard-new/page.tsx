// src/app/coursier/dashboard-new/page.tsx
// ✅ CORRECTION BUILD : zéro `typeof google` — types définis localement
// ✅ Carte : Google Maps → OpenStreetMap → Mapbox (3 fallbacks automatiques)
// ✅ Photo profil header, Paramètres complets (profil/documents/sécurité)
// ✅ Types de course : Standard / Urgente / Planifiée
// ✅ Vérification rôle coursier stricte
// ✅ Responsive mobile = app pure (pas de header/footer site)
// ✅ GPS envoi position vers Supabase toutes les 5s quand disponible
// ✅ Contre-proposition de prix depuis l'UI
'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Utilisateur, Coursier, Livraison, Wallet, Notification, TransactionWallet } from '@/lib/supabase'
import toast from 'react-hot-toast'
import {
  Bell, ChevronRight, MapPin, RefreshCw, Phone,
  TrendingUp, CheckCircle, Star, AlertTriangle, ArrowDown,
  ArrowUpRight, ChevronDown, X, Camera, Shield, Save, Eye, EyeOff,
  Upload, FileText,
} from 'lucide-react'

type Tab = 'missions' | 'en_cours' | 'gains' | 'profil'

// ── Types Google Maps définis localement — pas besoin de @types/google.maps ─
type GMapsSize    = object
type GMapsPoint   = object
type GMapsMarker  = { setMap: (m: GMapsMapInst | null) => void; addListener: (e: string, cb: () => void) => void }
type GMapsInfo    = { open: (map: GMapsMapInst, m: GMapsMarker) => void }
type GMapsMapInst = { setMapTypeId: (t: string) => void; setOptions: (o: object) => void }
type GMapsLib     = {
  Map:        new (el: HTMLElement, opts: object) => GMapsMapInst
  Marker:     new (opts: object) => GMapsMarker
  InfoWindow: new (opts: object) => GMapsInfo
  Size:       new (w: number, h: number) => GMapsSize
  Point:      new (x: number, y: number) => GMapsPoint
}
type WinWithGoogle = Window & { google?: { maps: GMapsLib } }

// ─────────────────────────────────────────────────────────────────────────────

const STATUT_CONFIG: Record<string, {
  label: string; emoji: string; color: string; bg: string; text: string;
  next?: string; nextLabel?: string; nextColor?: string
}> = {
  acceptee:         { label: 'Acceptée',         emoji: '✅', color: '#3b82f6', bg: '#eff6ff', text: '#1e40af', next: 'en_rout_depart',   nextLabel: '🛵 En route vers le colis', nextColor: '#8b5cf6' },
  en_rout_depart:   { label: 'En route (colis)',  emoji: '🛵', color: '#8b5cf6', bg: '#f5f3ff', text: '#5b21b6', next: 'colis_recupere',    nextLabel: '📦 Colis récupéré',         nextColor: '#6366f1' },
  colis_recupere:   { label: 'Colis récupéré',   emoji: '📦', color: '#6366f1', bg: '#eef2ff', text: '#3730a3', next: 'en_route_arrivee', nextLabel: '🚀 En route livraison',      nextColor: '#f97316' },
  en_route_arrivee: { label: 'En livraison',      emoji: '🚀', color: '#f97316', bg: '#fff7ed', text: '#9a3412', next: 'livree',           nextLabel: '✅ Confirmer livraison',      nextColor: '#22c55e' },
  livree:           { label: 'Livrée',            emoji: '🎉', color: '#22c55e', bg: '#f0fdf4', text: '#166534' },
  annulee:          { label: 'Annulée',           emoji: '❌', color: '#ef4444', bg: '#fef2f2', text: '#991b1b' },
}

const TYPE_BADGE: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  standard:   { label: 'Standard',  emoji: '⚡', color: '#1a56db', bg: '#eff6ff' },
  urgente:    { label: 'Urgente',   emoji: '🚨', color: '#dc2626', bg: '#fef2f2' },
  programmee: { label: 'Planifiée', emoji: '📅', color: '#7c3aed', bg: '#f5f3ff' },
  immediate:  { label: 'Standard',  emoji: '⚡', color: '#1a56db', bg: '#eff6ff' },
}

const fPrice = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
const fDate  = (d: string) => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d))

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT CARTE UNIVERSELLE COURSIER
// ─────────────────────────────────────────────────────────────────────────────
function CoursierMap({
  userLat, userLng, courses, satellite = false
}: {
  userLat: number | null; userLng: number | null
  courses: Livraison[]; satellite?: boolean
}) {
  const mapRef     = useRef<HTMLDivElement>(null)
  const gMapRef    = useRef<GMapsMapInst | null>(null)
  const leafMapRef = useRef<unknown>(null)
  const markersRef = useRef<GMapsMarker[]>([])
  const [engine, setEngine] = useState<'google' | 'leaflet' | 'mapbox' | 'error' | null>(null)
  const [ready, setReady]   = useState(false)

  const lat = userLat ?? 12.3714
  const lng = userLng ?? -1.5197

  const svgB64 = (svg: string) => 'data:image/svg+xml;base64,' + btoa(svg)

  const DARK_STYLES = [
    { elementType: 'geometry',             stylers: [{ color: '#1e293b' }] },
    { elementType: 'labels.text.stroke',   stylers: [{ color: '#1e293b' }] },
    { elementType: 'labels.text.fill',     stylers: [{ color: '#94a3b8' }] },
    { featureType: 'road',     elementType: 'geometry', stylers: [{ color: '#334155' }] },
    { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#475569' }] },
    { featureType: 'water',    elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
    { featureType: 'poi',      stylers: [{ visibility: 'off' }] },
  ]

  const initGoogle = useCallback(() => {
    const win = window as WinWithGoogle
    if (!mapRef.current || !win.google) return
    try {
      const G = win.google.maps
      const map = new G.Map(mapRef.current, {
        center: { lat, lng },
        zoom: 14,
        mapTypeId: satellite ? 'hybrid' : 'roadmap',
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        styles: satellite ? [] : DARK_STYLES,
      })
      gMapRef.current = map

      if (userLat && userLng) {
        new G.Marker({
          position: { lat: userLat, lng: userLng }, map,
          icon: {
            url: svgB64('<svg width="36" height="36" viewBox="0 0 36 36" xmlns="http://www.w3.org/2000/svg"><circle cx="18" cy="18" r="16" fill="#f97316" opacity="0.25"/><circle cx="18" cy="18" r="10" fill="#f97316" stroke="white" stroke-width="2.5"/></svg>'),
            scaledSize: new G.Size(36, 36), anchor: new G.Point(18, 18),
          },
        })
      }

      courses.slice(0, 10).forEach(c => {
        if (!c.depart_lat || !c.depart_lng) return
        const m = new G.Marker({
          position: { lat: c.depart_lat, lng: c.depart_lng }, map,
          icon: {
            url: svgB64('<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="9" r="8" fill="#22c55e" stroke="white" stroke-width="2"/></svg>'),
            scaledSize: new G.Size(18, 18), anchor: new G.Point(9, 9),
          },
        })
        const info = new G.InfoWindow({ content: `<div style="font-size:12px;font-weight:600;padding:4px 6px">📦 ${fPrice(c.prix_calcule)}</div>` })
        m.addListener('click', () => info.open(map, m))
        markersRef.current.push(m)
      })

      setEngine('google'); setReady(true)
    } catch { initLeaflet() }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, satellite, userLat, userLng, courses])

  const initLeaflet = useCallback(() => {
    if (!mapRef.current || typeof window === 'undefined') return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((mapRef.current as any)._leaflet_id) return

    import('leaflet').then(L => {
      if (!mapRef.current) return
      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView([lat, lng], 14)
      leafMapRef.current = map
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map)

      if (userLat && userLng) {
        const icon = L.divIcon({
          html: `<div style="background:#f97316;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(249,115,22,0.5)"></div>`,
          iconSize: [20, 20], className: '',
        })
        L.marker([userLat, userLng], { icon }).addTo(map).bindPopup('🛵 Votre position')
      }

      courses.slice(0, 10).forEach(c => {
        if (!c.depart_lat || !c.depart_lng) return
        const icon = L.divIcon({
          html: `<div style="background:#22c55e;width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(34,197,94,0.5)"></div>`,
          iconSize: [14, 14], className: '',
        })
        L.marker([c.depart_lat, c.depart_lng], { icon }).addTo(map).bindPopup(`📦 ${fPrice(c.prix_calcule)}`)
      })

      setEngine('leaflet'); setReady(true)
    }).catch(() => initMapbox())
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, userLat, userLng, courses])

  const initMapbox = useCallback(() => {
    if (!mapRef.current) return
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
    if (!token) { setEngine('error'); return }

    const link = document.createElement('link')
    link.rel  = 'stylesheet'
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.css'
    document.head.appendChild(link)

    const script = document.createElement('script')
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v2.15.0/mapbox-gl.js'
    script.onload = () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapboxgl = (window as any).mapboxgl
        mapboxgl.accessToken = token
        const map = new mapboxgl.Map({
          container: mapRef.current,
          style: satellite ? 'mapbox://styles/mapbox/satellite-streets-v12' : 'mapbox://styles/mapbox/dark-v11',
          center: [lng, lat],
          zoom: 13,
        })
        if (userLat && userLng) {
          new mapboxgl.Marker({ color: '#f97316' }).setLngLat([userLng, userLat]).addTo(map)
        }
        courses.slice(0, 10).forEach(c => {
          if (!c.depart_lat || !c.depart_lng) return
          new mapboxgl.Marker({ color: '#22c55e' }).setLngLat([c.depart_lng, c.depart_lat]).addTo(map)
        })
        leafMapRef.current = map
        setEngine('mapbox'); setReady(true)
      } catch { setEngine('error') }
    }
    script.onerror = () => setEngine('error')
    document.head.appendChild(script)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, satellite, userLat, userLng, courses])

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return
    const win = window as WinWithGoogle
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    if (apiKey) {
      if (win.google?.maps) { initGoogle(); return }
      if (!document.getElementById('gmaps-script')) {
        const s  = document.createElement('script')
        s.id     = 'gmaps-script'
        s.src    = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&language=fr&region=BF`
        s.async  = true; s.defer = true
        s.onload  = initGoogle
        s.onerror = initLeaflet
        document.head.appendChild(s)
      } else {
        const t = setInterval(() => {
          if ((window as WinWithGoogle).google?.maps) { clearInterval(t); initGoogle() }
        }, 100)
        setTimeout(() => { clearInterval(t); if (!gMapRef.current) initLeaflet() }, 5000)
      }
    } else {
      initLeaflet()
    }

    return () => {
      markersRef.current.forEach(m => { try { m.setMap(null) } catch {} })
      markersRef.current = []
      if (leafMapRef.current) {
        try { (leafMapRef.current as { remove: () => void }).remove() } catch {}
        leafMapRef.current = null
      }
      gMapRef.current = null
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (engine !== 'google' || !gMapRef.current) return
    gMapRef.current.setMapTypeId(satellite ? 'hybrid' : 'roadmap')
    gMapRef.current.setOptions({ styles: satellite ? [] : DARK_STYLES })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satellite, engine])

  if (engine === 'error') return (
    <div className="w-full h-full flex flex-col items-center justify-center" style={{ background: '#1e293b' }}>
      <MapPin size={28} className="text-gray-500 mb-2" />
      <p className="text-gray-400 text-sm font-semibold">Carte indisponible</p>
      <p className="text-gray-500 text-xs mt-1">Configurez une clé Maps dans Vercel</p>
    </div>
  )

  return (
    <>
      {engine === 'leaflet' && <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />}
      <div ref={mapRef} className="w-full h-full" style={{ opacity: ready ? 1 : 0.5, transition: 'opacity 0.3s' }} />
      {process.env.NODE_ENV === 'development' && engine && (
        <div className="absolute bottom-14 left-3 z-20 text-[10px] px-2 py-0.5 rounded-full font-bold"
          style={{ background: engine === 'google' ? '#1a56db' : engine === 'mapbox' ? '#6366f1' : '#334155', color: 'white' }}>
          {engine === 'google' ? '🗺️ Google' : engine === 'mapbox' ? '🗺️ Mapbox' : '🗺️ OSM'}
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL PARAMÈTRES COURSIER
// ─────────────────────────────────────────────────────────────────────────────
function ParametresCoursier({
  user, coursier, wallet, onClose, onUpdate
}: {
  user: Utilisateur; coursier: Coursier | null; wallet: Wallet | null
  onClose: () => void; onUpdate: (u: Utilisateur) => void
}) {
  const [section, setSection] = useState<'profil' | 'documents' | 'securite'>('profil')
  const [form, setForm] = useState({ nom: user.nom, telephone: user.telephone || '', whatsapp: user.whatsapp || '' })
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [showPw, setShowPw]       = useState(false)
  const [saving, setSaving]       = useState(false)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const saveProfile = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('utilisateurs').update({
        nom: form.nom.trim(), telephone: form.telephone.trim(),
        whatsapp: form.whatsapp.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id)
      if (error) throw error
      toast.success('Profil mis à jour ✅')
      onUpdate({ ...user, nom: form.nom.trim(), telephone: form.telephone.trim(), whatsapp: form.whatsapp.trim() || null })
    } catch { toast.error('Erreur mise à jour') } finally { setSaving(false) }
  }

  const changePw = async () => {
    if (pwForm.next.length < 6) { toast.error('Minimum 6 caractères'); return }
    if (pwForm.next !== pwForm.confirm) { toast.error('Mots de passe différents'); return }
    setSaving(true)
    try {
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email: user.email!, password: pwForm.current })
      if (loginErr) throw new Error('Mot de passe actuel incorrect')
      await supabase.auth.updateUser({ password: pwForm.next })
      toast.success('Mot de passe modifié ✅')
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') } finally { setSaving(false) }
  }

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5 Mo'); return }
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `avatars/${user.id}/avatar.${ext}`
      const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (error) throw error
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('utilisateurs').update({ avatar_url: publicUrl }).eq('id', user.id)
      toast.success('Photo mise à jour ✅')
      onUpdate({ ...user, avatar_url: publicUrl })
    } catch { toast.error('Erreur upload') } finally { setUploading(false) }
  }

  const docs = [
    { label: 'CNI recto',          url: coursier?.cni_recto_url },
    { label: 'CNI verso',          url: coursier?.cni_verso_url },
    { label: 'Permis de conduire', url: coursier?.permis_url },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-hidden flex flex-col">

        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-black text-gray-900 text-lg">Paramètres Coursier</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={14} className="text-gray-600" />
          </button>
        </div>

        {/* Photo profil */}
        <div className="flex flex-col items-center pt-5 pb-3 border-b border-gray-50">
          <div className="relative">
            {user.avatar_url
              ? <img src={user.avatar_url} alt={user.nom} className="w-20 h-20 rounded-full object-cover border-4 border-white" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.1)' }} />
              : <div className="w-20 h-20 rounded-full flex items-center justify-center text-white font-black text-3xl" style={{ background: 'linear-gradient(135deg, #f97316, #22c55e)' }}>{user.nom.charAt(0).toUpperCase()}</div>
            }
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-white shadow-lg" style={{ background: '#f97316' }}>
              {uploading ? <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Camera size={13} />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />
          </div>
          <p className="font-bold text-gray-900 mt-2">{user.nom}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
              coursier?.statut_verification === 'verifie' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {coursier?.statut_verification === 'verifie' ? '✅ Vérifié' : '⏳ En attente'}
            </span>
            {wallet && <span className="text-xs text-gray-500 font-semibold">{fPrice(wallet.solde)}</span>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex px-4 py-2 gap-1 border-b border-gray-100">
          {[
            { id: 'profil'    as const, emoji: '👤', label: 'Profil' },
            { id: 'documents' as const, emoji: '📋', label: 'Documents' },
            { id: 'securite'  as const, emoji: '🔒', label: 'Sécurité' },
          ].map(m => (
            <button key={m.id} onClick={() => setSection(m.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all"
              style={section === m.id ? { background: '#f97316', color: 'white' } : { color: '#6b7280' }}>
              <span>{m.emoji}</span>{m.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {section === 'profil' && (
            <>
              {[
                { key: 'nom' as const,       label: 'Nom complet', type: 'text', ph: 'Votre nom complet' },
                { key: 'telephone' as const, label: 'Téléphone',   type: 'tel',  ph: '+226 70 00 00 00' },
                { key: 'whatsapp' as const,  label: 'WhatsApp',    type: 'tel',  ph: '+226 70 00 00 00' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">{f.label}</label>
                  <input type={f.type} value={form[f.key]} placeholder={f.ph}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-gray-900 text-sm outline-none focus:border-orange-400 transition-colors" />
                </div>
              ))}
              <button onClick={saveProfile} disabled={saving}
                className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-all"
                style={{ background: '#f97316' }}>
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                {saving ? 'Sauvegarde...' : 'Enregistrer'}
              </button>
            </>
          )}

          {section === 'documents' && (
            <div className="space-y-3">
              <div className="bg-amber-50 rounded-2xl p-4">
                <p className="text-amber-800 text-xs font-semibold">Documents vérifiés par l'équipe NYME sous 24-48h.</p>
              </div>
              {docs.map((d, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: d.url ? '#f0fdf4' : '#f9fafb' }}>
                      {d.url ? <CheckCircle size={18} className="text-green-500" /> : <FileText size={18} className="text-gray-400" />}
                    </div>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{d.label}</p>
                      <p className="text-xs text-gray-400">{d.url ? 'Soumis ✅' : 'Non soumis'}</p>
                    </div>
                  </div>
                  <Link href="/coursier/verification" className="px-3 py-1.5 rounded-xl text-xs font-bold text-orange-600 bg-orange-50">
                    {d.url ? 'Modifier' : 'Soumettre'}
                  </Link>
                </div>
              ))}
              <Link href="/coursier/verification"
                className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-bold text-sm text-white active:scale-[0.98] transition-all"
                style={{ background: '#f97316' }}>
                <Upload size={14} />Gérer tous mes documents
              </Link>
            </div>
          )}

          {section === 'securite' && (
            <>
              <div className="bg-amber-50 rounded-2xl p-3.5">
                <p className="text-amber-800 text-xs font-semibold flex items-center gap-2"><Shield size={13} />Modification du mot de passe</p>
              </div>
              {[
                { key: 'current' as const, label: 'Mot de passe actuel' },
                { key: 'next'    as const, label: 'Nouveau mot de passe' },
                { key: 'confirm' as const, label: 'Confirmer le nouveau' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">{f.label}</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} value={pwForm[f.key]}
                      onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full pl-4 pr-11 py-3 rounded-2xl border border-gray-200 text-sm outline-none focus:border-orange-400 transition-colors" placeholder="••••••••" />
                    {f.key === 'current' && (
                      <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                        {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={changePw} disabled={saving}
                className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60" style={{ background: '#f97316' }}>
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Shield size={14} />}
                Modifier le mot de passe
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD COURSIER PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function CoursierDashboard() {
  const router = useRouter()
  const [user,               setUser]               = useState<Utilisateur | null>(null)
  const [coursier,           setCoursier]           = useState<Coursier | null>(null)
  const [tab,                setTab]                = useState<Tab>('missions')
  const [disponible,         setDisponible]         = useState(false)
  const [coursesDisponibles, setCoursesDisponibles] = useState<Livraison[]>([])
  const [coursesEnCours,     setCoursesEnCours]     = useState<Livraison[]>([])
  const [wallet,             setWallet]             = useState<Wallet | null>(null)
  const [transactions,       setTransactions]       = useState<TransactionWallet[]>([])
  const [notifications,      setNotifications]      = useState<Notification[]>([])
  const [loading,            setLoading]            = useState(true)
  const [toggling,           setToggling]           = useState(false)
  const [userLat,            setUserLat]            = useState<number | null>(null)
  const [userLng,            setUserLng]            = useState<number | null>(null)
  const [mapExpanded,        setMapExpanded]        = useState(false)
  const [satellite,          setSatellite]          = useState(false)
  const [showParams,         setShowParams]         = useState(false)
  const [showAllMissions,    setShowAllMissions]    = useState(false)

  // GPS : envoi position vers Supabase
  const gpsIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const watchIdRef     = useRef<number | null>(null)
  const userIdRef      = useRef<string | null>(null)

  // Contre-proposition
  const [propositionInputs, setPropositionInputs] = useState<Record<string, string>>({})
  const [proposantId,       setProposantId]       = useState<string | null>(null)
  const [propositionLoading, setPropositionLoading] = useState<string | null>(null)

  // ── Envoi GPS vers Supabase ─────────────────────────────────────────────
  const sendGpsToSupabase = useCallback(async (
    uid: string, lat: number, lng: number, speed: number | null
  ) => {
    try {
      await supabase.from('localisation_coursier').insert({
        coursier_id: uid,
        livraison_id: null,
        latitude: lat,
        longitude: lng,
        vitesse: speed ? Math.round(speed * 3.6 * 100) / 100 : 0, // m/s → km/h
      })
      await supabase.from('coursiers').update({
        lat_actuelle: lat,
        lng_actuelle: lng,
        derniere_activite: new Date().toISOString(),
      }).eq('id', uid)
    } catch { /* silencieux — l'app ne doit pas crasher si GPS échoue */ }
  }, [])

  // ── Démarrer le tracking GPS ──────────────────────────────────────────
  const startGpsTracking = useCallback((uid: string) => {
    if (!navigator.geolocation) return

    // Position initiale immédiate
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLat(pos.coords.latitude)
        setUserLng(pos.coords.longitude)
        sendGpsToSupabase(uid, pos.coords.latitude, pos.coords.longitude, pos.coords.speed)
      },
      () => {}
    )

    // Watch continu
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lng, speed } = pos.coords
        setUserLat(lat)
        setUserLng(lng)
        sendGpsToSupabase(uid, lat, lng, speed)
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
    )

    // Envoi forcé toutes les 5s (même sans mouvement)
    if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current)
    gpsIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        pos => sendGpsToSupabase(uid, pos.coords.latitude, pos.coords.longitude, pos.coords.speed),
        () => {}
      )
    }, 5000)
  }, [sendGpsToSupabase])

  // ── Arrêter le tracking GPS ───────────────────────────────────────────
  const stopGpsTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current)
      gpsIntervalRef.current = null
    }
  }, [])

  const loadCoursesDisponibles = useCallback(async () => {
    const { data } = await supabase.from('livraisons')
      .select('*, client:client_id(id, nom, telephone, avatar_url)')
      .eq('statut', 'en_attente').is('coursier_id', null)
      .order('created_at', { ascending: false }).limit(20)
    setCoursesDisponibles((data || []) as unknown as Livraison[])
  }, [])

  const loadCoursesEnCours = useCallback(async (uid: string) => {
    const { data } = await supabase.from('livraisons')
      .select('*, client:client_id(id, nom, telephone, avatar_url)')
      .eq('coursier_id', uid).not('statut', 'in', '("livree","annulee")')
      .order('created_at', { ascending: false })
    setCoursesEnCours((data || []) as unknown as Livraison[])
  }, [])

  const loadWallet = useCallback(async (uid: string) => {
    const { data } = await supabase.from('wallets').select('*').eq('user_id', uid).single()
    setWallet(data as Wallet | null)
    const { data: txs } = await supabase.from('transactions_wallet').select('*')
      .eq('user_id', uid).order('created_at', { ascending: false }).limit(50)
    setTransactions((txs || []) as TransactionWallet[])
  }, [])

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.push('/coursier/login'); return }

        const { data: u } = await supabase.from('utilisateurs').select('*').eq('id', session.user.id).single()
        if (!u || u.role !== 'coursier') {
          await supabase.auth.signOut(); router.push('/coursier/login'); return
        }
        setUser(u as Utilisateur)
        userIdRef.current = session.user.id

        const { data: c } = await supabase.from('coursiers').select('*').eq('id', session.user.id).single()
        if (c) {
          setCoursier(c as Coursier)
          const isDisponible = c.statut === 'disponible'
          setDisponible(isDisponible)
          // Démarrer GPS si déjà disponible
          if (isDisponible) startGpsTracking(session.user.id)
        }

        const { data: notifs } = await supabase.from('notifications').select('*')
          .eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(30)
        setNotifications((notifs || []) as Notification[])

        await Promise.all([
          loadCoursesDisponibles(),
          loadCoursesEnCours(session.user.id),
          loadWallet(session.user.id),
        ])

        // Position initiale (sans tracking)
        navigator.geolocation?.getCurrentPosition(
          pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude) },
          () => {}
        )

        const channel = supabase.channel(`coursier-${session.user.id}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'livraisons' }, () => {
            loadCoursesDisponibles()
            loadCoursesEnCours(session.user.id)
          })
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` }, p => {
            setNotifications(prev => [p.new as Notification, ...prev])
            toast((p.new as Notification).titre || '🔔 Notification', { icon: '🔔' })
          })
          .subscribe()

        setLoading(false)
        return () => {
          supabase.removeChannel(channel)
          stopGpsTracking()
        }
      } catch { setLoading(false) }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Cleanup GPS au démontage
  useEffect(() => {
    return () => { stopGpsTracking() }
  }, [stopGpsTracking])

  const toggleDisponible = async () => {
    if (!user || toggling) return
    setToggling(true)
    try {
      if (!disponible) {
        navigator.geolocation.getCurrentPosition(
          async pos => {
            await supabase.from('coursiers').update({
              statut: 'disponible',
              lat_actuelle: pos.coords.latitude, lng_actuelle: pos.coords.longitude,
              derniere_activite: new Date().toISOString(),
            }).eq('id', user.id)
            setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude)
            setDisponible(true)
            // Démarrer le tracking GPS
            startGpsTracking(user.id)
            toast.success('✅ En ligne — GPS actif')
            setToggling(false)
          },
          async () => {
            await supabase.from('coursiers').update({ statut: 'disponible' }).eq('id', user.id)
            setDisponible(true)
            startGpsTracking(user.id)
            toast('En ligne sans GPS précis', { icon: '⚠️' })
            setToggling(false)
          }
        )
      } else {
        stopGpsTracking()
        await supabase.from('coursiers').update({ statut: 'hors_ligne' }).eq('id', user.id)
        setDisponible(false)
        toast('Hors ligne — GPS arrêté', { icon: '🔴' })
        setToggling(false)
      }
    } catch { setToggling(false) }
  }

  const accepterCourse = async (l: Livraison) => {
    if (!user) return
    try {
      const res = await fetch('/api/coursier/livraisons/accepter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ livraison_id: l.id, coursier_id: user.id }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || 'Erreur serveur') }
      toast.success('🎉 Course acceptée !')
      await Promise.all([loadCoursesDisponibles(), loadCoursesEnCours(user.id)])
      setTab('en_cours')
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
  }

  // Contre-proposition de prix
  const handleProposerPrix = async (livraisonId: string) => {
    if (!user) return
    const montantStr = propositionInputs[livraisonId]
    const montant = parseFloat(montantStr)
    if (!montant || montant < 500) { toast.error('Montant minimum 500 XOF'); return }

    setPropositionLoading(livraisonId)
    try {
      const res = await fetch('/api/coursier/livraisons/accepter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          livraison_id: livraisonId,
          coursier_id: user.id,
          action: 'proposer_prix',
          montant_propose: montant,
        }),
      })
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.message || 'Erreur') }
      toast.success('✅ Proposition envoyée ! Le client peut accepter.')
      setProposantId(null)
      setPropositionInputs(prev => { const n = { ...prev }; delete n[livraisonId]; return n })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur envoi proposition')
    } finally {
      setPropositionLoading(null)
    }
  }

  const updateStatut = async (livraisonId: string, newStatut: string) => {
    if (!user) return
    try {
      const res = await fetch('/api/coursier/livraisons/statut', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ livraison_id: livraisonId, statut: newStatut, coursier_id: user.id }),
      })
      if (!res.ok) throw new Error('Erreur mise à jour statut')
      if (newStatut === 'livree') { toast.success('🎉 Livraison confirmée !'); await loadWallet(user.id) }
      else toast.success('✅ Statut mis à jour')
      await loadCoursesEnCours(user.id)
    } catch { toast.error('Erreur statut') }
  }

  const isVerifie   = coursier?.statut_verification === 'verifie'
  const unreadCount = notifications.filter(n => !n.lu).length
  const gainsDuJour = transactions
    .filter(tx => new Date(tx.created_at).toDateString() === new Date().toDateString() && tx.type === 'gain' && tx.status === 'completed')
    .reduce((s, tx) => s + tx.montant, 0)
  const missionsVisible = showAllMissions ? coursesDisponibles : coursesDisponibles.slice(0, 4)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="text-5xl animate-bounce">🛵</div>
        <div className="w-7 h-7 border-2 border-white/20 border-t-orange-400 rounded-full animate-spin" />
        <p className="text-white/40 text-sm font-medium">Chargement...</p>
      </div>
    </div>
  )

  return (
    <>
      {showParams && user && (
        <ParametresCoursier
          user={user} coursier={coursier} wallet={wallet}
          onClose={() => setShowParams(false)}
          onUpdate={u => setUser(u)}
        />
      )}

      <div className="min-h-screen flex flex-col" style={{ background: '#f8fafc' }}>

        {/* ── HEADER ── */}
        <header className="sticky top-0 z-40 text-white" style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)', boxShadow: '0 2px 20px rgba(0,0,0,0.25)' }}>
          <div className="max-w-2xl mx-auto px-4 flex items-center justify-between h-14">
            <div className="flex items-center gap-2.5">
              <span className="text-xl">🛵</span>
              <div>
                <p className="font-bold text-sm text-white leading-none">{user?.nom?.split(' ')[0]} 👋</p>
                <p className="text-white/40 text-[10px]">Coursier NYME</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Toggle disponibilité */}
              <button onClick={toggleDisponible} disabled={toggling || !isVerifie}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs transition-all
                  ${disponible ? 'bg-green-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/15'}
                  ${!isVerifie ? 'opacity-40 cursor-not-allowed' : ''}`}>
                {toggling
                  ? <div className="w-3 h-3 border-2 border-current/30 border-t-current rounded-full animate-spin" />
                  : <span className={`w-1.5 h-1.5 rounded-full ${disponible ? 'bg-white animate-pulse' : 'bg-white/40'}`} />
                }
                <span className="hidden sm:inline">{disponible ? 'En ligne' : 'Hors ligne'}</span>
              </button>

              {/* Notifs */}
              <button className="relative w-9 h-9 rounded-xl hover:bg-white/10 flex items-center justify-center transition-colors">
                <Bell size={17} className="text-white/70" />
                {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unreadCount}</span>}
              </button>

              {/* Photo profil */}
              <button onClick={() => setShowParams(true)} className="shrink-0">
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt={user.nom} className="w-8 h-8 rounded-full object-cover border-2 border-white/20" />
                  : <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: 'linear-gradient(135deg, #f97316, #22c55e)' }}>
                      {user?.nom?.charAt(0).toUpperCase()}
                    </div>
                }
              </button>
            </div>
          </div>

          {/* Tabs desktop */}
          <div className="hidden sm:flex max-w-2xl mx-auto px-4 border-t border-white/10">
            {([
              ['missions', '🔍 Missions'],
              ['en_cours', `🚀 En cours${coursesEnCours.length > 0 ? ` (${coursesEnCours.length})` : ''}`],
              ['gains',    '💰 Gains'],
              ['profil',   '👤 Profil'],
            ] as const).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t as Tab)}
                className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap
                  ${tab === t ? 'border-orange-400 text-orange-400' : 'border-transparent text-white/40 hover:text-white/70'}`}>
                {label}
              </button>
            ))}
          </div>
        </header>

        {/* Bannière vérification */}
        {!isVerifie && (
          <div className="bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle size={14} />
              <span className="font-medium">Dossier en vérification — missions bloquées</span>
            </div>
            <Link href="/coursier/verification" className="text-xs underline font-bold">Compléter →</Link>
          </div>
        )}

        <main className="flex-1 max-w-2xl mx-auto w-full px-0 sm:px-4 pb-24">

          {/* ══ MISSIONS ══ */}
          {tab === 'missions' && (
            <div>
              {/* Carte */}
              <div className={`relative transition-all duration-300 overflow-hidden ${mapExpanded ? 'h-[55vh]' : 'h-48 sm:h-60'}`} style={{ background: '#1e293b' }}>
                <CoursierMap userLat={userLat} userLng={userLng} courses={coursesDisponibles} satellite={satellite} />

                <div className="absolute top-3 left-3 right-3 z-10 flex items-center gap-2">
                  <div className="rounded-xl px-3 py-2 flex items-center gap-2 flex-1" style={{ background: 'rgba(15,23,42,0.85)', backdropFilter: 'blur(8px)' }}>
                    <div className={`w-2 h-2 rounded-full ${disponible ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
                    <span className="text-xs font-semibold text-white truncate">{disponible ? 'Disponible — GPS actif' : 'Hors ligne'}</span>
                    {coursier && (
                      <div className="flex items-center gap-1 ml-1">
                        <Star size={11} className="text-yellow-400 fill-yellow-400" />
                        <span className="text-xs text-white/70 font-medium">{(coursier as Coursier & { note_moyenne?: number }).note_moyenne || '5.0'}</span>
                      </div>
                    )}
                  </div>
                  <button onClick={() => setSatellite(!satellite)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${satellite ? 'bg-blue-600 text-white' : 'text-white'}`}
                    style={!satellite ? { background: 'rgba(15,23,42,0.85)' } : {}}>
                    {satellite ? '🛰️' : '🗺️'}
                  </button>
                  <button onClick={() => setMapExpanded(!mapExpanded)} className="p-2 rounded-xl text-white" style={{ background: 'rgba(15,23,42,0.85)' }}>
                    {mapExpanded ? <ChevronDown size={14} /> : <ArrowUpRight size={14} />}
                  </button>
                </div>

                <div className="absolute bottom-3 left-3 right-3 z-10">
                  <div className="rounded-2xl px-4 py-3 grid grid-cols-4 gap-2" style={{ background: 'rgba(15,23,42,0.9)', backdropFilter: 'blur(8px)' }}>
                    {[
                      { label: 'Dispo',     val: String(coursesDisponibles.length),    color: '#22c55e' },
                      { label: 'En cours',  val: String(coursesEnCours.length),        color: '#f97316' },
                      { label: 'Total',     val: String(coursier?.total_courses || 0), color: '#8b5cf6' },
                      { label: "Auj.",      val: gainsDuJour > 0 ? `${Math.round(gainsDuJour / 1000)}k` : '0', color: '#eab308' },
                    ].map(s => (
                      <div key={s.label} className="text-center">
                        <p className="text-sm font-black" style={{ color: s.color }}>{s.val}</p>
                        <p className="text-[9px] text-white/40 font-medium">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="px-4 sm:px-0 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-black text-gray-900 text-lg">Courses disponibles</h2>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{coursesDisponibles.length} mission(s)</span>
                    <button onClick={loadCoursesDisponibles} className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                      <RefreshCw size={13} className="text-gray-600" />
                    </button>
                  </div>
                </div>

                {!disponible && isVerifie && (
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
                    <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-bold text-amber-800">Vous êtes hors ligne</p>
                      <p className="text-xs text-amber-600">Activez votre statut pour accepter des missions</p>
                    </div>
                    <button onClick={toggleDisponible} disabled={toggling}
                      className="px-3 py-1.5 rounded-xl text-white text-xs font-bold shrink-0 transition-colors" style={{ background: '#22c55e' }}>
                      {toggling ? '...' : 'Activer'}
                    </button>
                  </div>
                )}

                {coursesDisponibles.length === 0 ? (
                  <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                    <div className="text-5xl mb-3">🔍</div>
                    <h3 className="font-bold text-gray-700 text-lg">Aucune course disponible</h3>
                    <p className="text-gray-400 text-sm mt-1">Les nouvelles missions apparaissent en temps réel</p>
                  </div>
                ) : (
                  <>
                    {missionsVisible.map(l => {
                      const typeCfg = TYPE_BADGE[l.type] || TYPE_BADGE.standard
                      const isProposing = proposantId === l.id
                      return (
                        <div key={l.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                          <div className="px-4 pt-4 pb-2">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold" style={{ background: typeCfg.bg, color: typeCfg.color }}>
                                  {typeCfg.emoji} {typeCfg.label}{l.type === 'urgente' ? ' +30%' : ''}
                                </span>
                                <p className="text-2xl font-black text-gray-900 mt-1.5">{fPrice(l.prix_calcule)}</p>
                                <p className="text-xs text-gray-400">
                                  {l.distance_km ? `${l.distance_km} km` : ''}
                                  {l.duree_estimee ? ` · ~${l.duree_estimee} min` : ''}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-400">{fDate(l.created_at)}</p>
                                <p className="text-xs text-gray-500 font-medium mt-1">→ {l.destinataire_nom}</p>
                              </div>
                            </div>

                            <div className="space-y-1.5 mb-2">
                              <div className="flex items-start gap-2"><div className="w-3 h-3 rounded-full bg-green-500 shrink-0 mt-0.5" /><p className="text-sm text-gray-700 leading-snug">{l.depart_adresse}</p></div>
                              <div className="ml-1.5 w-0.5 h-2 bg-gray-200 rounded" />
                              <div className="flex items-start gap-2"><div className="w-3 h-3 rounded-full bg-red-500 shrink-0 mt-0.5" /><p className="text-sm text-gray-700 leading-snug">{l.arrivee_adresse}</p></div>
                            </div>

                            {l.instructions && (
                              <div className="mb-2 rounded-xl p-2.5 bg-yellow-50 border border-yellow-100">
                                <p className="text-xs text-yellow-700">💬 {l.instructions}</p>
                              </div>
                            )}

                            {/* Formulaire contre-proposition */}
                            {isProposing && (
                              <div className="mb-2 flex gap-2">
                                <div className="relative flex-1">
                                  <input
                                    type="number"
                                    placeholder="Votre prix (XOF)"
                                    value={propositionInputs[l.id] || ''}
                                    onChange={e => setPropositionInputs(prev => ({ ...prev, [l.id]: e.target.value }))}
                                    className="w-full px-3 py-2 border border-orange-300 rounded-xl text-sm outline-none focus:border-orange-500 pr-12"
                                    min={500}
                                  />
                                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">XOF</span>
                                </div>
                                <button
                                  onClick={() => handleProposerPrix(l.id)}
                                  disabled={propositionLoading === l.id}
                                  className="px-4 py-2 bg-orange-500 text-white rounded-xl font-bold text-sm hover:bg-orange-600 disabled:opacity-50 transition-colors"
                                >
                                  {propositionLoading === l.id ? '...' : 'Envoyer'}
                                </button>
                                <button
                                  onClick={() => setProposantId(null)}
                                  className="px-3 py-2 bg-gray-100 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-200 transition-colors"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="px-4 pb-4 flex gap-2">
                            <button
                              onClick={() => accepterCourse(l)}
                              disabled={!disponible || !isVerifie}
                              className="flex-1 py-3 rounded-xl font-bold text-sm text-white transition-all active:scale-95 disabled:opacity-40"
                              style={{ background: disponible && isVerifie ? '#22c55e' : '#9ca3af' }}
                            >
                              ✅ Accepter
                            </button>
                            {/* Bouton contre-proposition */}
                            {disponible && isVerifie && (
                              <button
                                onClick={() => setProposantId(isProposing ? null : l.id)}
                                className={`px-4 py-3 rounded-xl font-bold text-sm transition-all active:scale-95 ${
                                  isProposing
                                    ? 'bg-orange-100 text-orange-700 border-2 border-orange-300'
                                    : 'bg-gray-100 text-gray-600 hover:bg-orange-50 hover:text-orange-600'
                                }`}
                              >
                                💬
                              </button>
                            )}
                            <Link href={`/client/suivi/${l.id}`}
                              className="w-12 flex items-center justify-center rounded-xl bg-gray-100 hover:bg-gray-200 text-sm transition-colors">
                              🗺️
                            </Link>
                          </div>
                        </div>
                      )
                    })}

                    {coursesDisponibles.length > 4 && (
                      <button
                        onClick={() => setShowAllMissions(!showAllMissions)}
                        className="w-full py-3 rounded-2xl border-2 border-dashed border-gray-300 text-gray-500 font-semibold text-sm hover:border-gray-400 transition-colors"
                      >
                        {showAllMissions ? 'Voir moins' : `Voir les ${coursesDisponibles.length - 4} autres missions`}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* ══ EN COURS ══ */}
          {tab === 'en_cours' && (
            <div className="px-4 sm:px-0 pt-4 space-y-4">
              <h2 className="text-xl font-black text-gray-900">Missions en cours</h2>

              {coursesEnCours.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                  <div className="text-5xl mb-3">🛵</div>
                  <h3 className="font-bold text-gray-700 text-lg">Aucune mission en cours</h3>
                  <button onClick={() => setTab('missions')} className="mt-4 px-6 py-3 rounded-xl font-bold text-sm text-white transition-colors" style={{ background: '#f97316' }}>
                    Voir les missions →
                  </button>
                </div>
              ) : coursesEnCours.map(l => {
                const cfg = STATUT_CONFIG[l.statut]
                const progress = l.statut === 'acceptee' ? 20
                  : l.statut === 'en_rout_depart' ? 40
                  : l.statut === 'colis_recupere' ? 60
                  : l.statut === 'en_route_arrivee' ? 80 : 100
                return (
                  <div key={l.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 1px 12px rgba(0,0,0,0.06)' }}>
                    <div className="h-1.5 bg-gray-100">
                      <div className="h-full rounded-full transition-all duration-500" style={{ background: cfg?.color || '#f97316', width: `${progress}%` }} />
                    </div>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">{cfg?.emoji || '📦'}</span>
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{cfg?.label}</p>
                            <p className="text-xs text-gray-400">{fDate(l.created_at)}</p>
                          </div>
                        </div>
                        <p className="font-black text-xl text-orange-500">{fPrice(l.prix_final || l.prix_calcule)}</p>
                      </div>

                      <div className="bg-gray-50 rounded-xl p-3 mb-3 space-y-1.5">
                        <div className="flex items-start gap-2"><div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0 mt-0.5" /><p className="text-sm text-gray-700">{l.depart_adresse}</p></div>
                        <div className="ml-1 w-0.5 h-2 bg-gray-200 rounded" />
                        <div className="flex items-start gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0 mt-0.5" /><p className="text-sm text-gray-700">{l.arrivee_adresse}</p></div>
                      </div>

                      <div className="flex items-center justify-between mb-3 text-xs">
                        <span className="text-gray-500">→ <strong className="text-gray-800">{l.destinataire_nom}</strong></span>
                        <a href={`tel:${l.destinataire_tel}`} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-50 text-green-700 font-semibold">
                          <Phone size={11} />Appeler
                        </a>
                      </div>

                      <div className="flex gap-2">
                        <Link href={`/coursier/mission/${l.id}`}
                          className="flex-1 py-2.5 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm text-center hover:bg-gray-200 transition-colors">
                          🗺️ Carte & Détails
                        </Link>
                        {cfg?.next && (
                          <button
                            onClick={() => updateStatut(l.id, cfg.next!)}
                            className="flex-1 py-2.5 rounded-xl font-bold text-sm text-white transition-all active:scale-95"
                            style={{ background: cfg.nextColor || '#f97316' }}
                          >
                            {cfg.nextLabel}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ══ GAINS ══ */}
          {tab === 'gains' && (
            <div className="px-4 sm:px-0 pt-4 space-y-4">
              <h2 className="text-xl font-black text-gray-900">Mes gains</h2>

              <div className="rounded-3xl p-6 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1e293b, #0f172a)' }}>
                <div className="absolute top-0 right-0 w-40 h-40 rounded-full opacity-10" style={{ background: 'white', transform: 'translate(30%,-30%)' }} />
                <p className="text-white/50 text-sm mb-1">Solde disponible</p>
                <div className="flex items-baseline gap-2 mb-5">
                  <span className="text-4xl font-black">{(wallet?.solde || 0).toLocaleString('fr-FR')}</span>
                  <span className="text-lg opacity-60">FCFA</span>
                </div>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {[
                    { label: "Aujourd'hui", val: fPrice(gainsDuJour),                                           color: '#eab308' },
                    { label: 'Total courses', val: String(coursier?.total_courses || 0),                         color: '#22c55e' },
                    { label: 'Note moy.',  val: `⭐ ${(coursier as (Coursier & { note_moyenne?: number }) | null)?.note_moyenne || '5.0'}`, color: '#f97316' },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-2.5 text-center" style={{ background: 'rgba(255,255,255,0.08)' }}>
                      <p className="text-sm font-black" style={{ color: s.color }}>{s.val}</p>
                      <p className="text-[10px] text-white/40 mt-0.5">{s.label}</p>
                    </div>
                  ))}
                </div>
                <Link href="/coursier/wallet"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl font-bold text-sm text-gray-900 active:scale-[0.98] transition-all"
                  style={{ background: '#f97316' }}>
                  <ArrowDown size={15} />Retirer mes gains
                </Link>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                  <h3 className="font-bold text-gray-900 text-sm">Historique</h3>
                  <Link href="/coursier/wallet" className="text-orange-500 text-xs font-semibold">Voir tout</Link>
                </div>
                {transactions.length === 0 ? (
                  <div className="p-10 text-center"><TrendingUp size={28} className="text-gray-200 mx-auto mb-2" /><p className="text-gray-400 text-sm">Aucune transaction</p></div>
                ) : transactions.slice(0, 20).map(tx => {
                  const isGain = ['gain', 'bonus'].includes(tx.type)
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0" style={{ background: isGain ? '#f0fdf4' : '#fef2f2' }}>
                        {isGain ? '💰' : '📊'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{tx.note || tx.type}</p>
                        <p className="text-xs text-gray-400">{fDate(tx.created_at)}</p>
                      </div>
                      <p className={`font-black text-sm shrink-0 ${isGain ? 'text-green-600' : 'text-red-500'}`}>
                        {isGain ? '+' : '-'}{Math.abs(tx.montant).toLocaleString('fr-FR')} FCFA
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ══ PROFIL ══ */}
          {tab === 'profil' && (
            <div className="px-4 sm:px-0 pt-4 space-y-4">
              <div className="bg-white rounded-2xl border border-gray-100 p-6 text-center" style={{ boxShadow: '0 1px 12px rgba(0,0,0,0.06)' }}>
                <div className="relative inline-block mb-3">
                  {user?.avatar_url
                    ? <img src={user.avatar_url} alt={user.nom} className="w-20 h-20 rounded-full object-cover border-4 border-orange-100 mx-auto" />
                    : <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-white font-black text-3xl" style={{ background: 'linear-gradient(135deg, #f97316, #22c55e)' }}>{user?.nom?.charAt(0) || '🛵'}</div>
                  }
                  <button onClick={() => setShowParams(true)}
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center text-white" style={{ background: '#f97316' }}>
                    <Camera size={12} />
                  </button>
                </div>
                <h2 className="text-xl font-black text-gray-900">{user?.nom}</h2>
                <p className="text-gray-500 text-sm">{user?.telephone}</p>
                <div className="flex items-center justify-center gap-3 mt-3">
                  <div className="flex items-center gap-1">
                    <Star size={13} className="text-yellow-400 fill-yellow-400" />
                    <span className="font-bold text-gray-800 text-sm">{(coursier as (Coursier & { note_moyenne?: number }) | null)?.note_moyenne || '5.0'}</span>
                  </div>
                  <span className="text-gray-300">•</span>
                  <span className="text-sm font-semibold text-gray-600">{coursier?.total_courses || 0} courses</span>
                  <span className="text-gray-300">•</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${isVerifie ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {isVerifie ? '✅ Vérifié' : '⏳ En attente'}
                  </span>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {[
                  { onClick: () => setShowParams(true),    emoji: '✏️', label: 'Modifier mon profil',      sub: user?.nom || '' },
                  { href: '/coursier/verification',        emoji: '📋', label: 'Documents & vérification', sub: isVerifie ? 'Vérifié ✅' : 'En attente de validation' },
                  { href: '/coursier/wallet',              emoji: '💰', label: 'Mon Wallet',               sub: fPrice(wallet?.solde || 0) },
                  { href: '/client/messages',              emoji: '💬', label: 'Messages',                 sub: 'Clients & support NYME' },
                ].map((item, i) => {
                  const content = (
                    <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 active:bg-gray-100 transition-colors cursor-pointer">
                      <span className="text-xl w-8 text-center">{item.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                        <p className="text-gray-400 text-xs truncate">{item.sub}</p>
                      </div>
                      <ChevronRight size={14} className="text-gray-300 shrink-0" />
                    </div>
                  )
                  if ('onClick' in item && item.onClick) return <div key={i} onClick={item.onClick}>{content}</div>
                  return <Link key={i} href={(item as { href: string }).href}>{content}</Link>
                })}
              </div>

              {/* Notifications */}
              {notifications.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                      <button onClick={async () => {
                        if (!user) return
                        await supabase.from('notifications').update({ lu: true }).eq('user_id', user.id)
                        setNotifications(prev => prev.map(n => ({ ...n, lu: true })))
                      }} className="text-orange-500 text-xs font-semibold">Tout lire</button>
                    )}
                  </div>
                  {notifications.slice(0, 5).map(n => (
                    <div key={n.id}
                      className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 cursor-pointer ${!n.lu ? 'bg-orange-50/50' : ''}`}
                      onClick={async () => {
                        if (!n.lu) {
                          await supabase.from('notifications').update({ lu: true }).eq('id', n.id)
                          setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, lu: true } : x))
                        }
                      }}>
                      <span className="text-lg shrink-0">🔔</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-gray-900 text-sm">{n.titre}</p>
                        <p className="text-xs text-gray-500 truncate">{n.message}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{fDate(n.created_at)}</p>
                      </div>
                      {!n.lu && <div className="w-2 h-2 rounded-full shrink-0 mt-1 bg-orange-500" />}
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={async () => {
                  stopGpsTracking()
                  await supabase.auth.signOut()
                  router.push('/coursier/login')
                }}
                className="w-full py-3.5 rounded-2xl font-bold text-red-600 border-2 border-red-100 hover:bg-red-50 active:scale-[0.98] transition-all text-sm"
              >
                🚪 Déconnexion
              </button>
            </div>
          )}
        </main>

        {/* ── BOTTOM NAV MOBILE ── */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden text-white" style={{ background: '#1e293b', boxShadow: '0 -4px 20px rgba(0,0,0,0.2)' }}>
          <div className="flex max-w-2xl mx-auto">
            {([
              ['missions', '🔍', 'Missions'],
              ['en_cours', '🚀', `En cours${coursesEnCours.length > 0 ? `(${coursesEnCours.length})` : ''}`],
              ['gains',    '💰', 'Gains'],
              ['profil',   '👤', 'Profil'],
            ] as const).map(([t, icon, label]) => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all relative ${tab === t ? 'text-orange-400' : 'text-white/35'}`}>
                <span className="text-lg leading-none">{icon}</span>
                <span className="text-[9px] font-semibold">{label}</span>
                {tab === t && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-orange-400" />}
              </button>
            ))}
          </div>
        </nav>
      </div>
    </>
  )
}
