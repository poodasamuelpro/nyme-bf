// src/app/client/dashboard/page.tsx
// ✅ Carte : Google Maps (si clé dispo) → fallback Leaflet automatique
// ✅ Zéro dépendance @types/google.maps — types gérés en interne (any ciblé)
// ✅ Photo profil header + Paramètres complets
// ✅ Types de course : Standard / Urgente / Planifiée
// ✅ Vérification rôle stricte (client uniquement)
// ✅ Responsive mobile-first / app pure sans header/footer site
'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Utilisateur, Livraison, Wallet, Notification, TransactionWallet } from '@/lib/supabase'
import toast from 'react-hot-toast'
import {
  Bell, Plus, Package, Settings, ChevronRight, MapPin,
  ArrowUpRight, CheckCircle, Zap, ArrowDown,
  TrendingUp, Wallet as WalletIcon, Camera,
  Shield, X, Save, Eye, EyeOff,
  RefreshCw,
} from 'lucide-react'

type Tab = 'accueil' | 'livraisons' | 'wallet'

const STATUT: Record<string, { label: string; emoji: string; bg: string; text: string; color: string }> = {
  en_attente:       { label: 'En attente',     emoji: '🕐', bg: '#fffbeb', text: '#92400e', color: '#f59e0b' },
  acceptee:         { label: 'Acceptée',       emoji: '✅', bg: '#eff6ff', text: '#1e40af', color: '#3b82f6' },
  en_rout_depart:   { label: 'En route ↑',     emoji: '🛵', bg: '#f5f3ff', text: '#5b21b6', color: '#8b5cf6' },
  colis_recupere:   { label: 'Colis récupéré', emoji: '📦', bg: '#eef2ff', text: '#3730a3', color: '#6366f1' },
  en_route_arrivee: { label: 'En livraison',   emoji: '🚀', bg: '#fff7ed', text: '#9a3412', color: '#f97316' },
  livree:           { label: 'Livrée',         emoji: '🎉', bg: '#f0fdf4', text: '#166534', color: '#22c55e' },
  annulee:          { label: 'Annulée',        emoji: '❌', bg: '#fef2f2', text: '#991b1b', color: '#ef4444' },
}

const fPrice = (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
const fDate  = (d: string) => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d))

// ─────────────────────────────────────────────────────────────────────────────
// COMPOSANT CARTE — Google Maps si clé dispo, sinon Leaflet automatiquement
// Types Google gérés avec `any` ciblé → aucun @types/google.maps requis
// ─────────────────────────────────────────────────────────────────────────────
function MapView({
  userLat, userLng, livraisons, satellite = false
}: {
  userLat: number | null; userLng: number | null;
  livraisons: Livraison[]; satellite?: boolean
}) {
  const mapRef       = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapInstance  = useRef<any>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef   = useRef<any[]>([])
  const [engine, setEngine]     = useState<'google' | 'leaflet' | 'error' | null>(null)
  const [mapReady, setMapReady] = useState(false)

  const lat = userLat ?? 12.3714
  const lng = userLng ?? -1.5197

  // ── Helpers marqueur SVG (inline base64 — pas besoin de @types/google.maps) ─
  const svgBase64 = (svg: string) =>
    typeof window !== 'undefined' ? 'data:image/svg+xml;base64,' + window.btoa(svg) : ''

  // ── INIT GOOGLE MAPS ──────────────────────────────────────────────────────
  const initGoogle = useCallback(() => {
    if (!mapRef.current) return
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const G = (window as any).google.maps

      const map = new G.Map(mapRef.current, {
        center: { lat, lng },
        zoom: 14,
        mapTypeId: satellite ? 'hybrid' : 'roadmap',
        disableDefaultUI: true,
        zoomControl: true,
        gestureHandling: 'greedy',
        styles: satellite ? [] : [
          { featureType: 'poi', stylers: [{ visibility: 'off' }] },
          { featureType: 'transit', stylers: [{ visibility: 'simplified' }] },
        ],
      })
      mapInstance.current = map

      // Marker position utilisateur
      if (userLat && userLng) {
        new G.Marker({
          position: { lat: userLat, lng: userLng },
          map,
          icon: {
            url: svgBase64(`<svg width="30" height="30" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg"><circle cx="15" cy="15" r="13" fill="#1a56db" opacity="0.2"/><circle cx="15" cy="15" r="8" fill="#1a56db" stroke="white" stroke-width="2.5"/></svg>`),
            scaledSize: new G.Size(30, 30),
            anchor: new G.Point(15, 15),
          },
        })
      }

      // Markers livraisons actives
      livraisons.filter(l => !['livree', 'annulee'].includes(l.statut)).forEach(l => {
        if (!l.arrivee_lat || !l.arrivee_lng) return
        const cfg = STATUT[l.statut]
        const m = new G.Marker({
          position: { lat: l.arrivee_lat, lng: l.arrivee_lng },
          map,
          icon: {
            url: svgBase64(`<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg"><circle cx="9" cy="9" r="8" fill="${cfg?.color || '#f97316'}" stroke="white" stroke-width="2"/></svg>`),
            scaledSize: new G.Size(18, 18),
            anchor: new G.Point(9, 9),
          },
        })
        const info = new G.InfoWindow({ content: `<div style="font-size:12px;font-weight:600;padding:4px">${cfg?.emoji} ${l.arrivee_adresse}</div>` })
        m.addListener('click', () => info.open(map, m))
        markersRef.current.push(m)
      })

      setEngine('google')
      setMapReady(true)
    } catch {
      initLeaflet()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, satellite, userLat, userLng])

  // ── INIT LEAFLET (fallback) ───────────────────────────────────────────────
  const initLeaflet = useCallback(() => {
    if (!mapRef.current || typeof window === 'undefined') return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((mapRef.current as any)._leaflet_id) return

    import('leaflet').then(L => {
      if (!mapRef.current) return
      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView([lat, lng], 14)
      mapInstance.current = map

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map)

      if (userLat && userLng) {
        const icon = L.divIcon({
          html: `<div style="background:#1a56db;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(26,86,219,0.4)"></div>`,
          iconSize: [16, 16], className: '',
        })
        L.marker([userLat, userLng], { icon }).addTo(map).bindPopup('📍 Vous êtes ici')
      }

      livraisons.filter(l => !['livree', 'annulee'].includes(l.statut)).forEach(l => {
        if (!l.arrivee_lat || !l.arrivee_lng) return
        const cfg = STATUT[l.statut]
        const icon = L.divIcon({
          html: `<div style="background:${cfg?.color || '#f97316'};width:12px;height:12px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
          iconSize: [12, 12], className: '',
        })
        L.marker([l.arrivee_lat, l.arrivee_lng], { icon }).addTo(map).bindPopup(`${cfg?.emoji} ${l.arrivee_adresse}`)
      })

      setEngine('leaflet')
      setMapReady(true)
    }).catch(() => setEngine('error'))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng, userLat, userLng])

  // ── CHARGEMENT INITIAL ────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Nettoyage si re-montage
    return () => {
      markersRef.current.forEach(m => { try { m.setMap?.(null) } catch {} })
      markersRef.current = []
      if (mapInstance.current) {
        try { mapInstance.current.remove?.() } catch {}
        mapInstance.current = null
      }
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return

    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (apiKey && (window as any).google?.maps) {
      initGoogle()
      return
    }

    if (apiKey) {
      // Charger le script Google Maps dynamiquement
      const existing = document.getElementById('gmaps-script')
      if (existing) { initGoogle(); return }

      const script = document.createElement('script')
      script.id  = 'gmaps-script'
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&language=fr&region=BF`
      script.async = true
      script.defer = true
      script.onload  = initGoogle
      script.onerror = initLeaflet  // Si Google échoue → Leaflet
      document.head.appendChild(script)
    } else {
      // Pas de clé Google → Leaflet directement
      initLeaflet()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Toggle satellite (Google uniquement)
  useEffect(() => {
    if (engine !== 'google' || !mapInstance.current) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mapInstance.current.setMapTypeId(satellite ? 'hybrid' : 'roadmap')
  }, [satellite, engine])

  if (engine === 'error') {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50">
        <MapPin size={28} className="text-blue-300 mb-2" />
        <p className="text-sm font-semibold text-gray-500">Carte indisponible</p>
        <p className="text-xs text-gray-400 mt-0.5">Activez la géolocalisation</p>
      </div>
    )
  }

  return (
    <>
      {engine === 'leaflet' && (
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      )}
      <div
        ref={mapRef}
        className="w-full h-full"
        style={{ opacity: mapReady ? 1 : 0.6, transition: 'opacity 0.3s' }}
      />
      {/* Badge moteur visible uniquement en dev */}
      {process.env.NODE_ENV === 'development' && engine && (
        <div className="absolute bottom-14 left-3 z-20 text-[10px] px-2 py-0.5 rounded-full font-bold"
          style={{ background: engine === 'google' ? '#1a56db' : '#64748b', color: 'white' }}>
          {engine === 'google' ? '🗺️ Google Maps' : '🗺️ OpenStreetMap'}
        </div>
      )}
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL PARAMÈTRES
// ─────────────────────────────────────────────────────────────────────────────
function ParametresPanel({
  user, wallet, onClose, onUpdate
}: {
  user: Utilisateur; wallet: Wallet | null;
  onClose: () => void; onUpdate: (u: Utilisateur) => void
}) {
  const [section, setSection] = useState<'profil' | 'securite' | 'adresses' | 'notifs'>('profil')
  const [form, setForm] = useState({ nom: user.nom, telephone: user.telephone || '' })
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' })
  const [showPw, setShowPw] = useState(false)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('utilisateurs').update({
        nom: form.nom.trim(),
        telephone: form.telephone.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', user.id)
      if (error) throw error
      toast.success('Profil mis à jour ✅')
      onUpdate({ ...user, nom: form.nom.trim(), telephone: form.telephone.trim() })
    } catch { toast.error('Erreur lors de la mise à jour') }
    finally { setSaving(false) }
  }

  const handleChangePassword = async () => {
    if (!pwForm.current) { toast.error('Mot de passe actuel requis'); return }
    if (pwForm.next.length < 6) { toast.error('Minimum 6 caractères'); return }
    if (pwForm.next !== pwForm.confirm) { toast.error('Mots de passe différents'); return }
    setSaving(true)
    try {
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email: user.email!, password: pwForm.current })
      if (loginErr) throw new Error('Mot de passe actuel incorrect')
      const { error } = await supabase.auth.updateUser({ password: pwForm.next })
      if (error) throw error
      toast.success('Mot de passe modifié ✅')
      setPwForm({ current: '', next: '', confirm: '' })
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    finally { setSaving(false) }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5 Mo'); return }
    setUploadingPhoto(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `avatars/${user.id}/avatar.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('utilisateurs').update({ avatar_url: publicUrl }).eq('id', user.id)
      toast.success('Photo mise à jour ✅')
      onUpdate({ ...user, avatar_url: publicUrl })
    } catch { toast.error('Erreur upload photo') }
    finally { setUploadingPhoto(false) }
  }

  const menus = [
    { id: 'profil'   as const, emoji: '👤', label: 'Profil' },
    { id: 'securite' as const, emoji: '🔒', label: 'Sécurité' },
    { id: 'adresses' as const, emoji: '📍', label: 'Adresses' },
    { id: 'notifs'   as const, emoji: '🔔', label: 'Notifs' },
  ]

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{ boxShadow: '0 -8px 40px rgba(0,0,0,0.15)' }}>

        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-black text-gray-900 text-lg">Paramètres</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
            <X size={14} className="text-gray-600" />
          </button>
        </div>

        {/* Photo profil */}
        <div className="flex flex-col items-center pt-5 pb-3 border-b border-gray-50">
          <div className="relative">
            {user.avatar_url
              ? <img src={user.avatar_url} alt={user.nom} className="w-20 h-20 rounded-full object-cover border-4 border-white" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.12)' }} />
              : <div className="w-20 h-20 rounded-full flex items-center justify-center text-white font-black text-3xl" style={{ background: 'linear-gradient(135deg, #1a56db, #f97316)' }}>
                  {user.nom.charAt(0).toUpperCase()}
                </div>
            }
            <button onClick={() => fileRef.current?.click()} disabled={uploadingPhoto}
              className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center text-white shadow-lg"
              style={{ background: '#1a56db' }}>
              {uploadingPhoto ? <div className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Camera size={13} />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>
          <p className="font-bold text-gray-900 mt-2">{user.nom}</p>
          <p className="text-gray-400 text-xs">{user.email}</p>
        </div>

        {/* Tabs */}
        <div className="flex px-4 py-2 gap-1 border-b border-gray-100 overflow-x-auto">
          {menus.map(m => (
            <button key={m.id} onClick={() => setSection(m.id)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all"
              style={section === m.id ? { background: '#1a56db', color: 'white' } : { color: '#6b7280' }}>
              <span>{m.emoji}</span>{m.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {section === 'profil' && (
            <>
              {[
                { key: 'nom' as const,       label: 'Nom complet',  type: 'text', placeholder: 'Votre nom' },
                { key: 'telephone' as const, label: 'Téléphone',    type: 'tel',  placeholder: '+226 70 00 00 00' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">{f.label}</label>
                  <input type={f.type} value={form[f.key]} placeholder={f.placeholder}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full px-4 py-3 rounded-2xl border border-gray-200 text-gray-900 text-sm outline-none focus:border-blue-500 transition-colors" />
                </div>
              ))}
              <div>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">Email</label>
                <input value={user.email || ''} disabled
                  className="w-full px-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-gray-400 text-sm outline-none cursor-not-allowed" />
                <p className="text-xs text-gray-400 mt-1 ml-1">L'email ne peut pas être modifié ici</p>
              </div>
              <button onClick={handleSaveProfile} disabled={saving}
                className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60 active:scale-[0.98] transition-all"
                style={{ background: '#1a56db' }}>
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
                {saving ? 'Sauvegarde...' : 'Enregistrer'}
              </button>
            </>
          )}

          {section === 'securite' && (
            <>
              <div className="bg-blue-50 rounded-2xl p-3.5 mb-1">
                <p className="text-blue-800 text-xs font-semibold flex items-center gap-2"><Shield size={13} />Modification du mot de passe</p>
              </div>
              {[
                { key: 'current' as const, label: 'Mot de passe actuel',   auto: 'current-password' },
                { key: 'next'    as const, label: 'Nouveau mot de passe',  auto: 'new-password' },
                { key: 'confirm' as const, label: 'Confirmer le nouveau',   auto: 'new-password' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-bold text-gray-500 mb-1.5">{f.label}</label>
                  <div className="relative">
                    <input type={showPw ? 'text' : 'password'} value={pwForm[f.key]}
                      autoComplete={f.auto}
                      onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full pl-4 pr-11 py-3 rounded-2xl border border-gray-200 text-gray-900 text-sm outline-none focus:border-blue-500 transition-colors"
                      placeholder="••••••••" />
                    {f.key === 'current' && (
                      <button type="button" onClick={() => setShowPw(!showPw)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                        {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button onClick={handleChangePassword} disabled={saving}
                className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: '#1a56db' }}>
                {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Shield size={14} />}
                Modifier le mot de passe
              </button>
            </>
          )}

          {section === 'adresses' && (
            <div className="space-y-3">
              <p className="text-sm text-gray-500">Gérez vos adresses pour commander plus rapidement.</p>
              {[
                { href: '/client/favoris',          emoji: '📍', title: 'Mes adresses favorites',  sub: 'Maison, Bureau...' },
                { href: '/client/contacts-favoris', emoji: '👥', title: 'Contacts favoris',         sub: 'Destinataires fréquents' },
              ].map(item => (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 hover:bg-gray-100 transition-colors">
                  <span className="text-2xl">{item.emoji}</span>
                  <div className="flex-1">
                    <p className="font-bold text-gray-900 text-sm">{item.title}</p>
                    <p className="text-gray-500 text-xs">{item.sub}</p>
                  </div>
                  <ChevronRight size={14} className="text-gray-400" />
                </Link>
              ))}
            </div>
          )}

          {section === 'notifs' && (
            <div className="space-y-3">
              {[
                { label: 'Livraisons en cours',  sub: 'Statuts temps réel', on: true },
                { label: 'Promotions NYME',      sub: 'Offres spéciales',   on: false },
                { label: 'Alertes wallet',       sub: 'Solde faible',       on: true },
              ].map((n, i) => (
                <div key={i} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{n.label}</p>
                    <p className="text-gray-400 text-xs">{n.sub}</p>
                  </div>
                  <div className={`w-11 h-6 rounded-full relative transition-colors ${n.on ? 'bg-blue-600' : 'bg-gray-300'}`}>
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow-sm transition-all ${n.on ? 'left-5' : 'left-0.5'}`} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────
export default function ClientDashboard() {
  const router = useRouter()
  const [user,          setUser]          = useState<Utilisateur | null>(null)
  const [tab,           setTab]           = useState<Tab>('accueil')
  const [livraisons,    setLivraisons]    = useState<Livraison[]>([])
  const [wallet,        setWallet]        = useState<Wallet | null>(null)
  const [transactions,  setTransactions]  = useState<TransactionWallet[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')
  const [filterStatut,  setFilterStatut]  = useState('tous')
  const [userLat,       setUserLat]       = useState<number | null>(null)
  const [userLng,       setUserLng]       = useState<number | null>(null)
  const [mapExpanded,   setMapExpanded]   = useState(false)
  const [satellite,     setSatellite]     = useState(false)
  const [showParams,    setShowParams]    = useState(false)

  const loadLivraisons = useCallback(async (uid: string) => {
    const { data } = await supabase.from('livraisons')
      .select('*, coursier:coursier_id(id, nom, telephone, avatar_url, note_moyenne)')
      .eq('client_id', uid).order('created_at', { ascending: false })
    setLivraisons((data || []) as unknown as Livraison[])
  }, [])

  const loadWallet = useCallback(async (uid: string) => {
    const { data: w } = await supabase.from('wallets').select('*').eq('user_id', uid).single()
    if (w) setWallet(w as Wallet)
    const { data: txs } = await supabase.from('transactions_wallet').select('*')
      .eq('user_id', uid).order('created_at', { ascending: false }).limit(30)
    setTransactions((txs || []) as TransactionWallet[])
  }, [])

  const loadNotifications = useCallback(async (uid: string) => {
    const { data } = await supabase.from('notifications').select('*')
      .eq('user_id', uid).order('created_at', { ascending: false }).limit(50)
    setNotifications((data || []) as Notification[])
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      const { data: u } = await supabase.from('utilisateurs').select('*').eq('id', session.user.id).single()
      if (!u) { router.replace('/login'); return }

      // ── Vérification rôle stricte ─────────────────────────────────────
      if (u.role !== 'client') {
        const redirects: Record<string, string> = {
          coursier:   '/coursier/dashboard-new',
          admin:      '/admin-x9k2m/dashboard',
          partenaire: '/partenaires/dashboard',
        }
        router.replace(redirects[u.role] || '/login')
        return
      }

      setUser(u as Utilisateur)
      await Promise.all([
        loadLivraisons(session.user.id),
        loadWallet(session.user.id),
        loadNotifications(session.user.id),
      ])
      setLoading(false)

      navigator.geolocation?.getCurrentPosition(
        pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude) },
        () => {}
      )

      const channel = supabase.channel(`client-${session.user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'livraisons', filter: `client_id=eq.${session.user.id}` },
          () => loadLivraisons(session.user.id))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
          p => {
            setNotifications(prev => [p.new as Notification, ...prev])
            toast((p.new as Notification).titre || '🔔 Notification', { icon: '🔔' })
          })
        .subscribe()
      return () => { supabase.removeChannel(channel) }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const markAllRead = async () => {
    if (!user) return
    await supabase.from('notifications').update({ lu: true }).eq('user_id', user.id).eq('lu', false)
    setNotifications(prev => prev.map(n => ({ ...n, lu: true })))
    toast.success('Tout marqué comme lu')
  }

  const filteredLivraisons = livraisons.filter(l => {
    const m = !search ||
      l.depart_adresse.toLowerCase().includes(search.toLowerCase()) ||
      l.arrivee_adresse.toLowerCase().includes(search.toLowerCase()) ||
      l.destinataire_nom.toLowerCase().includes(search.toLowerCase())
    return m && (filterStatut === 'tous' || l.statut === filterStatut)
  })

  const unreadCount      = notifications.filter(n => !n.lu).length
  const activeDeliveries = livraisons.filter(l => !['livree', 'annulee'].includes(l.statut))

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a56db, #f97316)' }}>
          <span className="text-white font-black text-2xl">N</span>
        </div>
        <div className="w-7 h-7 border-2 border-white/20 border-t-orange-400 rounded-full animate-spin" />
      </div>
    </div>
  )

  return (
    <>
      {showParams && user && (
        <ParametresPanel
          user={user} wallet={wallet}
          onClose={() => setShowParams(false)}
          onUpdate={u => setUser(u)}
        />
      )}

      <div className="min-h-screen bg-gray-50 flex flex-col">

        {/* ── HEADER ── */}
        <header className="sticky top-0 z-40 bg-white border-b border-gray-100" style={{ boxShadow: '0 1px 10px rgba(0,0,0,0.05)' }}>
          <div className="max-w-2xl mx-auto px-4 flex items-center justify-between h-14">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a56db, #f97316)' }}>
                <span className="text-white font-black text-sm">N</span>
              </div>
              <p className="font-bold text-gray-900 text-sm">{user?.nom?.split(' ')[0]} 👋</p>
            </div>

            <div className="flex items-center gap-1.5">
              <button onClick={() => setTab('livraisons')} className="relative w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors">
                <Bell size={17} className="text-gray-600" />
                {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center bg-red-500">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>
              <button onClick={() => setShowParams(true)} className="w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors">
                <Settings size={16} className="text-gray-600" />
              </button>
              <button onClick={() => setShowParams(true)} className="shrink-0">
                {user?.avatar_url
                  ? <img src={user.avatar_url} alt={user.nom} className="w-8 h-8 rounded-full object-cover border-2 border-blue-100" />
                  : <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm" style={{ background: 'linear-gradient(135deg, #1a56db, #f97316)' }}>
                      {user?.nom?.charAt(0).toUpperCase()}
                    </div>
                }
              </button>
              <Link href="/client/nouvelle-livraison" className="hidden sm:flex items-center gap-1.5 px-3 py-2 rounded-xl text-white font-bold text-xs active:scale-95 transition-all" style={{ background: 'linear-gradient(135deg, #1a56db, #1e40af)' }}>
                <Plus size={13} />Livraison
              </Link>
            </div>
          </div>

          {/* Tabs desktop */}
          <div className="hidden sm:flex max-w-2xl mx-auto px-4 border-t border-gray-50">
            {([['accueil', '🏠 Accueil'], ['livraisons', `📦 Livraisons${livraisons.length > 0 ? ` (${livraisons.length})` : ''}`], ['wallet', '💰 Wallet']] as const).map(([t, label]) => (
              <button key={t} onClick={() => setTab(t as Tab)}
                className={`px-4 py-2.5 text-xs font-bold border-b-2 transition-all whitespace-nowrap ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-400 hover:text-gray-700'}`}>
                {label}
              </button>
            ))}
          </div>
        </header>

        <main className="flex-1 max-w-2xl mx-auto w-full px-0 sm:px-4 pb-24">

          {/* ══ ACCUEIL ══ */}
          {tab === 'accueil' && (
            <div>
              {/* Carte avec gestion moteur */}
              <div className={`relative transition-all duration-300 overflow-hidden bg-gray-100 ${mapExpanded ? 'h-[60vh]' : 'h-52 sm:h-64'}`}>
                <MapView userLat={userLat} userLng={userLng} livraisons={livraisons} satellite={satellite} />

                {/* Contrôles */}
                <div className="absolute top-3 left-3 right-3 z-10 flex items-center gap-2">
                  <div className="bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2 shadow-md flex-1">
                    <div className={`w-2 h-2 rounded-full ${userLat ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                    <span className="text-xs font-semibold text-gray-700 truncate">{userLat ? '📍 Position détectée' : 'Position inconnue'}</span>
                  </div>
                  <button onClick={() => setSatellite(!satellite)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold shadow-md transition-all ${satellite ? 'bg-blue-600 text-white' : 'bg-white/95 text-gray-700'}`}>
                    {satellite ? '🛰️' : '🗺️'}
                  </button>
                  <button onClick={() => setMapExpanded(!mapExpanded)}
                    className="bg-white/95 backdrop-blur-sm rounded-xl p-2 shadow-md text-gray-600">
                    {mapExpanded ? <ArrowDown size={14} /> : <ArrowUpRight size={14} />}
                  </button>
                </div>

                {/* Barre de recherche */}
                <div className="absolute bottom-3 left-3 right-3 z-10">
                  <Link href="/client/nouvelle-livraison"
                    className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-xl border border-gray-100 active:scale-[0.98] transition-all">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#1a56db' }}>
                      <MapPin size={14} className="text-white" />
                    </div>
                    <span className="text-gray-400 text-sm flex-1">Où voulez-vous livrer ?</span>
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-orange-500 shrink-0">
                      <ArrowUpRight size={13} className="text-white" />
                    </div>
                  </Link>
                </div>
              </div>

              <div className="px-4 sm:px-0 space-y-4 mt-4">
                {/* Stats */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: Package,     label: 'Total',    val: String(livraisons.length),                                    color: '#1a56db', bg: '#eff6ff' },
                    { icon: Zap,         label: 'En cours', val: String(activeDeliveries.length),                              color: '#8b5cf6', bg: '#f5f3ff' },
                    { icon: CheckCircle, label: 'Livrées',  val: String(livraisons.filter(l => l.statut === 'livree').length), color: '#22c55e', bg: '#f0fdf4' },
                    { icon: WalletIcon,  label: 'Solde',    val: fPrice(wallet?.solde || 0),                                   color: '#f97316', bg: '#fff7ed' },
                  ].map(s => (
                    <div key={s.label} className="bg-white rounded-2xl p-3.5 border border-gray-100 flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: s.bg }}>
                        <s.icon size={16} style={{ color: s.color }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-gray-400 text-[11px] font-medium">{s.label}</p>
                        <p className="font-black text-gray-900 text-sm truncate">{s.val}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Types de course */}
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Nouvelle livraison</p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { type: 'standard',   emoji: '⚡', label: 'Standard',  desc: 'Prix normal',      color: '#1a56db', bg: '#eff6ff', border: '#bfdbfe' },
                      { type: 'urgente',    emoji: '🚨', label: 'Urgente',   desc: 'Priorité +30%',    color: '#dc2626', bg: '#fef2f2', border: '#fecaca' },
                      { type: 'programmee', emoji: '📅', label: 'Planifiée', desc: "Jusqu'à J+15",     color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
                    ].map(t => (
                      <Link key={t.type} href={`/client/nouvelle-livraison?type=${t.type}`}
                        className="rounded-2xl p-3 text-center transition-all active:scale-95 border"
                        style={{ background: t.bg, borderColor: t.border }}>
                        <span className="text-2xl block mb-1">{t.emoji}</span>
                        <p className="font-bold text-xs" style={{ color: t.color }}>{t.label}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{t.desc}</p>
                      </Link>
                    ))}
                  </div>
                </div>

                {/* Livraisons actives */}
                {activeDeliveries.length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                        <h2 className="font-bold text-gray-900 text-sm">En cours ({activeDeliveries.length})</h2>
                      </div>
                      <button onClick={() => setTab('livraisons')} className="text-xs font-semibold text-blue-600">Tout voir</button>
                    </div>
                    {activeDeliveries.slice(0, 3).map(l => {
                      const cfg = STATUT[l.statut] || STATUT.en_attente
                      return (
                        <div key={l.id} className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0" style={{ background: cfg.bg }}>
                          <span className="text-xl shrink-0 mt-0.5">{cfg.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold mb-0.5" style={{ color: cfg.color }}>{cfg.label}</p>
                            <p className="text-sm font-semibold text-gray-800 truncate">{l.depart_adresse}</p>
                            <p className="text-xs text-gray-500 truncate">→ {l.arrivee_adresse}</p>
                          </div>
                          <Link href={`/client/suivi/${l.id}`}
                            className="shrink-0 px-3 py-1.5 rounded-lg text-white text-xs font-bold" style={{ background: '#1a56db' }}>
                            Suivre
                          </Link>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Historique récent */}
                {livraisons.filter(l => ['livree', 'annulee'].includes(l.statut)).length > 0 && (
                  <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                      <h2 className="font-bold text-gray-900 text-sm">Récentes</h2>
                      <button onClick={() => setTab('livraisons')} className="text-xs font-semibold text-blue-600">Voir tout →</button>
                    </div>
                    {livraisons.filter(l => ['livree', 'annulee'].includes(l.statut)).slice(0, 4).map(l => {
                      const cfg = STATUT[l.statut]
                      return (
                        <div key={l.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                          <span className="text-lg shrink-0">{cfg.emoji}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{l.arrivee_adresse}</p>
                            <p className="text-xs text-gray-400">{fDate(l.created_at)}</p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-black text-gray-800">{fPrice(l.prix_final || l.prix_calcule)}</p>
                            <p className="text-[11px] font-semibold" style={{ color: cfg.color }}>{cfg.label}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Actions rapides */}
                <div className="grid grid-cols-4 gap-2.5">
                  {[
                    { icon: '💰', label: 'Wallet',   href: '/client/wallet',          bg: '#22c55e' },
                    { icon: '💬', label: 'Messages', href: '/client/messages',         bg: '#8b5cf6' },
                    { icon: '👥', label: 'Contacts', href: '/client/contacts-favoris', bg: '#f97316' },
                    { icon: '⭐', label: 'Notes',    href: '/client/evaluation',       bg: '#eab308' },
                  ].map(a => (
                    <Link key={a.label} href={a.href}
                      className="rounded-2xl p-3 flex flex-col items-center gap-1.5 active:scale-95 transition-all text-white"
                      style={{ background: a.bg }}>
                      <span className="text-xl">{a.icon}</span>
                      <span className="text-[10px] font-bold text-center">{a.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ LIVRAISONS ══ */}
          {tab === 'livraisons' && (
            <div className="px-4 sm:px-0 pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-gray-900">Mes livraisons</h2>
                <Link href="/client/nouvelle-livraison"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white font-bold text-sm"
                  style={{ background: '#1a56db' }}>
                  <Plus size={13} />Créer
                </Link>
              </div>

              {unreadCount > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Bell size={14} className="text-blue-600" />
                    <span className="text-sm font-semibold text-blue-800">{unreadCount} notification(s) non lue(s)</span>
                  </div>
                  <button onClick={markAllRead} className="text-blue-600 text-xs font-bold">Tout lire</button>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 bg-white text-gray-900 placeholder-gray-400" />
                <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
                  className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none bg-white text-gray-700">
                  <option value="tous">Tous les statuts</option>
                  {Object.entries(STATUT).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
                </select>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                {filteredLivraisons.length === 0 ? (
                  <div className="p-12 text-center">
                    <Package size={36} className="text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 text-sm font-medium">Aucune livraison</p>
                    <Link href="/client/nouvelle-livraison"
                      className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl text-white font-bold text-sm"
                      style={{ background: '#1a56db' }}>
                      <Plus size={13} />Créer ma première livraison
                    </Link>
                  </div>
                ) : filteredLivraisons.map(l => {
                  const cfg = STATUT[l.statut] || STATUT.en_attente
                  return (
                    <div key={l.id} className="px-4 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <span className="text-xl shrink-0 mt-0.5">{cfg.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{l.depart_adresse}</p>
                              <p className="text-xs text-gray-400 truncate">→ {l.arrivee_adresse}</p>
                            </div>
                            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0"
                              style={{ background: cfg.bg, color: cfg.text }}>{cfg.label}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span className="text-gray-400">{fDate(l.created_at)}</span>
                            <span className="font-bold text-gray-800">{fPrice(l.prix_final || l.prix_calcule)}</span>
                            <span className="text-gray-300">•</span>
                            <span className="text-gray-500">{l.destinataire_nom}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {!['livree', 'annulee'].includes(l.statut) && (
                              <Link href={`/client/suivi/${l.id}`}
                                className="text-xs px-3 py-1 rounded-lg font-semibold text-white" style={{ background: '#1a56db' }}>
                                🗺️ Suivre
                              </Link>
                            )}
                            {l.statut === 'livree' && (
                              <Link href={`/client/evaluation/${l.id}`}
                                className="text-xs px-3 py-1 rounded-lg font-semibold text-yellow-700 bg-yellow-50">⭐ Évaluer</Link>
                            )}
                            {l.statut === 'en_attente' && (
                              <Link href={`/client/propositions/${l.id}`}
                                className="text-xs px-3 py-1 rounded-lg font-semibold text-orange-600 bg-orange-50">Propositions →</Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ══ WALLET ══ */}
          {tab === 'wallet' && (
            <div className="px-4 sm:px-0 pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-black text-gray-900">Mon Wallet</h2>
                <Link href="/client/wallet" className="text-blue-600 text-sm font-semibold">Gérer →</Link>
              </div>

              <div className="rounded-3xl p-6 text-white relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1e3a8a 100%)' }}>
                <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10" style={{ background: 'white', transform: 'translate(30%,-30%)' }} />
                <p className="text-white/60 text-sm mb-1">Solde disponible</p>
                <div className="flex items-baseline gap-2 mb-5">
                  <span className="text-4xl font-black">{(wallet?.solde || 0).toLocaleString('fr-FR')}</span>
                  <span className="text-lg opacity-70">FCFA</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Total rechargé', val: fPrice(wallet?.total_gains || 0) },
                    { label: 'Total dépensé',  val: fPrice(wallet?.total_retraits || 0) },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.12)' }}>
                      <p className="text-white/50 text-xs">{s.label}</p>
                      <p className="font-bold text-sm mt-0.5">{s.val}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Link href="/client/wallet"
                  className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm text-white active:scale-[0.98] transition-all"
                  style={{ background: '#22c55e' }}>
                  <ArrowDown size={15} />Recharger
                </Link>
                <Link href="/client/wallet"
                  className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm border-2 border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-[0.98] transition-all">
                  <TrendingUp size={15} />Historique
                </Link>
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-50">
                  <h3 className="font-bold text-gray-900 text-sm">Transactions récentes</h3>
                </div>
                {transactions.length === 0 ? (
                  <div className="p-8 text-center">
                    <WalletIcon size={28} className="text-gray-200 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Aucune transaction</p>
                  </div>
                ) : transactions.slice(0, 15).map(tx => {
                  const isCredit = ['gain', 'bonus', 'remboursement', 'recharge'].includes(tx.type)
                  const icons: Record<string, string> = { gain: '💰', recharge: '📲', paiement_course: '📦', retrait: '🏦', bonus: '🎁', remboursement: '↩️', commission: '📊' }
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0" style={{ background: isCredit ? '#f0fdf4' : '#fef2f2' }}>
                        {icons[tx.type] || '💳'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">{tx.note || tx.type}</p>
                        <p className="text-xs text-gray-400">{fDate(tx.created_at)}</p>
                      </div>
                      <p className={`font-black text-sm shrink-0 ${isCredit ? 'text-green-600' : 'text-red-500'}`}>
                        {isCredit ? '+' : ''}{tx.montant.toLocaleString('fr-FR')} FCFA
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </main>

        {/* ── BOTTOM NAV MOBILE ── */}
        <nav className="fixed bottom-0 left-0 right-0 z-50 sm:hidden bg-white border-t border-gray-100" style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.06)' }}>
          <div className="flex max-w-2xl mx-auto">
            {/* Accueil */}
            <button onClick={() => setTab('accueil')}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all relative ${tab === 'accueil' ? 'text-blue-600' : 'text-gray-400'}`}>
              <span className="text-lg">🏠</span>
              <span className="text-[10px] font-semibold">Accueil</span>
              {tab === 'accueil' && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-blue-600" />}
            </button>
            {/* Livraisons */}
            <button onClick={() => setTab('livraisons')}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all relative ${tab === 'livraisons' ? 'text-blue-600' : 'text-gray-400'}`}>
              <span className="text-lg">📦</span>
              <span className="text-[10px] font-semibold">Livraisons</span>
              {unreadCount > 0 && <span className="absolute top-1.5 right-2 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              {tab === 'livraisons' && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-blue-600" />}
            </button>
            {/* Bouton + central */}
            <Link href="/client/nouvelle-livraison" className="flex-1 flex flex-col items-center py-1.5 relative">
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-black text-2xl -mt-5 shadow-xl" style={{ background: 'linear-gradient(135deg, #1a56db, #f97316)' }}>+</div>
              <span className="text-[10px] font-semibold text-gray-400 mt-0.5">Livrer</span>
            </Link>
            {/* Wallet */}
            <button onClick={() => setTab('wallet')}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all relative ${tab === 'wallet' ? 'text-blue-600' : 'text-gray-400'}`}>
              <span className="text-lg">💰</span>
              <span className="text-[10px] font-semibold">Wallet</span>
              {tab === 'wallet' && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-blue-600" />}
            </button>
            {/* Paramètres */}
            <button onClick={() => setShowParams(true)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all relative text-gray-400">
              <span className="text-lg">⚙️</span>
              <span className="text-[10px] font-semibold">Réglages</span>
            </button>
          </div>
        </nav>
      </div>
    </>
  )
}
