// src/app/client/dashboard/page.tsx
'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Utilisateur, Livraison, Wallet, Notification, TransactionWallet } from '@/lib/supabase'
import toast from 'react-hot-toast'
import {
  Bell, Plus, Search, LogOut, Package, Wallet as WalletIcon,
  MessageSquare, Star, Settings, ChevronRight, MapPin,
  ArrowUpRight, Clock, CheckCircle, XCircle, Users,
  Navigation, RefreshCw, Phone, ChevronDown, Menu, X,
  TrendingUp, Zap, ArrowDown, ArrowUp, Home, List,
} from 'lucide-react'

type Tab = 'accueil' | 'livraisons' | 'wallet' | 'notifications'

const STATUT: Record<string, { label: string; emoji: string; bg: string; text: string; color: string }> = {
  en_attente:       { label: 'En attente',     emoji: '🕐', bg: 'bg-amber-50',   text: 'text-amber-700',  color: '#f59e0b' },
  acceptee:         { label: 'Acceptée',       emoji: '✅', bg: 'bg-blue-50',    text: 'text-blue-700',   color: '#3b82f6' },
  en_rout_depart:   { label: 'En route ↑',     emoji: '🛵', bg: 'bg-purple-50',  text: 'text-purple-700', color: '#8b5cf6' },
  colis_recupere:   { label: 'Colis récupéré', emoji: '📦', bg: 'bg-indigo-50',  text: 'text-indigo-700', color: '#6366f1' },
  en_route_arrivee: { label: 'En livraison',   emoji: '🚀', bg: 'bg-orange-50',  text: 'text-orange-700', color: '#f97316' },
  livree:           { label: 'Livrée',         emoji: '🎉', bg: 'bg-green-50',   text: 'text-green-700',  color: '#22c55e' },
  annulee:          { label: 'Annulée',        emoji: '❌', bg: 'bg-red-50',     text: 'text-red-700',    color: '#ef4444' },
}

const fPrice = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
const fDate  = (d: string) => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d))

// Composant carte Leaflet SSR-safe
function MapView({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<unknown>(null)

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return
    let mounted = true

    import('leaflet').then(L => {
      if (!mounted || !mapRef.current) return
      // Éviter double init
      if ((mapRef.current as HTMLElement & { _leaflet_id?: number })._leaflet_id) return

      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false }).setView([lat, lng], 15)
      mapInstance.current = map

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
      }).addTo(map)

      const icon = L.divIcon({
        html: `<div style="background:#1a56db;width:16px;height:16px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3)"></div>`,
        iconSize: [16, 16],
        className: '',
      })
      L.marker([lat, lng], { icon }).addTo(map).bindPopup(label)
    }).catch(() => {})

    return () => {
      mounted = false
      if (mapInstance.current) {
        try { (mapInstance.current as { remove: () => void }).remove() } catch {}
        mapInstance.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng])

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} style={{ height: '100%', width: '100%', zIndex: 1 }} />
    </>
  )
}

// Carte principale du dashboard avec position client
function DashboardMap({ userLat, userLng, livraisons }: {
  userLat: number | null; userLng: number | null; livraisons: Livraison[]
}) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<unknown>(null)
  const [mapError, setMapError] = useState(false)

  const defaultLat = userLat ?? 12.3714
  const defaultLng = userLng ?? -1.5197

  useEffect(() => {
    if (typeof window === 'undefined' || !mapRef.current) return
    let mounted = true

    import('leaflet').then(L => {
      if (!mounted || !mapRef.current) return
      if ((mapRef.current as HTMLElement & { _leaflet_id?: number })._leaflet_id) return

      const map = L.map(mapRef.current, { zoomControl: false, attributionControl: false }).setView([defaultLat, defaultLng], 13)
      mapInstance.current = map

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map)
      L.control.zoom({ position: 'bottomright' }).addTo(map)

      // Marker position utilisateur
      const userIcon = L.divIcon({
        html: `<div style="background:#1a56db;width:18px;height:18px;border-radius:50%;border:3px solid white;box-shadow:0 2px 10px rgba(26,86,219,0.5)"></div>`,
        iconSize: [18, 18], className: '',
      })
      if (userLat && userLng) {
        L.marker([userLat, userLng], { icon: userIcon }).addTo(map).bindPopup('📍 Vous êtes ici')
      }

      // Markers livraisons actives
      livraisons.filter(l => !['livree','annulee'].includes(l.statut)).forEach(l => {
        const cfg = STATUT[l.statut]
        const icon = L.divIcon({
          html: `<div style="background:${cfg?.color || '#f97316'};width:14px;height:14px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
          iconSize: [14, 14], className: '',
        })
        if (l.arrivee_lat && l.arrivee_lng) {
          L.marker([l.arrivee_lat, l.arrivee_lng], { icon }).addTo(map)
            .bindPopup(`${cfg?.emoji || '📦'} ${l.arrivee_adresse}`)
        }
      })
    }).catch(() => { if (mounted) setMapError(true) })

    return () => {
      mounted = false
      if (mapInstance.current) {
        try { (mapInstance.current as { remove: () => void }).remove() } catch {}
        mapInstance.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultLat, defaultLng])

  if (mapError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 text-gray-500">
        <MapPin size={32} className="text-blue-300 mb-2" />
        <p className="text-sm font-medium">Carte indisponible</p>
        <p className="text-xs text-gray-400">Activez la géolocalisation</p>
      </div>
    )
  }

  return (
    <>
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <div ref={mapRef} style={{ height: '100%', width: '100%', zIndex: 1 }} />
    </>
  )
}

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
  const [menuOpen,      setMenuOpen]      = useState(false)
  const [mapExpanded,   setMapExpanded]   = useState(false)

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
      if (u.role === 'coursier')   { router.replace('/coursier/dashboard-new'); return }
      if (u.role === 'admin')      { router.replace('/admin-x9k2m/dashboard'); return }
      if (u.role === 'partenaire') { router.replace('/partenaires/dashboard'); return }

      setUser(u as Utilisateur)
      await Promise.all([loadLivraisons(session.user.id), loadWallet(session.user.id), loadNotifications(session.user.id)])
      setLoading(false)

      // Géolocalisation
      navigator.geolocation?.getCurrentPosition(
        pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude) },
        () => {}
      )

      const channel = supabase.channel(`client-${session.user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'livraisons', filter: `client_id=eq.${session.user.id}` },
          () => loadLivraisons(session.user.id))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` },
          (p) => {
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
    toast.success('Toutes les notifications marquées comme lues')
  }

  const filteredLivraisons = livraisons.filter(l => {
    const matchSearch = !search ||
      l.depart_adresse.toLowerCase().includes(search.toLowerCase()) ||
      l.arrivee_adresse.toLowerCase().includes(search.toLowerCase()) ||
      l.destinataire_nom.toLowerCase().includes(search.toLowerCase())
    return matchSearch && (filterStatut === 'tous' || l.statut === filterStatut)
  })

  const unreadCount      = notifications.filter(n => !n.lu).length
  const activeDeliveries = livraisons.filter(l => !['livree', 'annulee'].includes(l.statut))

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a56db, #f97316)' }}>
          <span className="text-white font-black text-2xl">N</span>
        </div>
        <div className="w-8 h-8 border-3 border-white/20 border-t-orange-400 rounded-full animate-spin" style={{ borderWidth: 3 }} />
      </div>
    </div>
  )

  const mapHeight = mapExpanded ? 'h-[60vh]' : 'h-52 sm:h-64'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">

      {/* ── HEADER STICKY ── */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-100" style={{ boxShadow: '0 1px 12px rgba(0,0,0,0.06)' }}>
        <div className="max-w-5xl mx-auto px-4 flex items-center justify-between h-14">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a56db, #f97316)' }}>
              <span className="text-white font-black text-sm">N</span>
            </div>
            <div className="hidden sm:block">
              <p className="font-bold text-gray-900 text-sm leading-none">Bonjour {user?.nom?.split(' ')[0]} 👋</p>
              <p className="text-gray-400 text-[11px]">Espace client</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Notifs */}
            <button onClick={() => setTab('notifications')}
              className="relative w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors">
              <Bell size={18} className="text-gray-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                  style={{ background: '#ef4444' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
            </button>

            {/* Bouton principale */}
            <Link href="/client/nouvelle-livraison"
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white font-bold text-xs transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, #1a56db, #1e40af)' }}>
              <Plus size={14} />
              <span className="hidden sm:inline">Nouvelle livraison</span>
              <span className="sm:hidden">Livraison</span>
            </Link>

            {/* Menu mobile */}
            <button onClick={() => setMenuOpen(!menuOpen)}
              className="sm:hidden w-9 h-9 rounded-xl hover:bg-gray-100 flex items-center justify-center">
              {menuOpen ? <X size={18} className="text-gray-600" /> : <Menu size={18} className="text-gray-600" />}
            </button>
          </div>
        </div>

        {/* Menu mobile déroulant */}
        {menuOpen && (
          <div className="sm:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col gap-1">
            <p className="text-xs text-gray-400 mb-1">Bonjour {user?.nom} 👋</p>
            {[
              { t: 'accueil' as Tab, icon: '🏠', label: 'Accueil' },
              { t: 'livraisons' as Tab, icon: '📦', label: 'Livraisons' },
              { t: 'wallet' as Tab, icon: '💰', label: 'Wallet' },
              { t: 'notifications' as Tab, icon: '🔔', label: `Notifs${unreadCount > 0 ? ` (${unreadCount})` : ''}` },
            ].map(({ t, icon, label }) => (
              <button key={t} onClick={() => { setTab(t); setMenuOpen(false) }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${tab === t ? 'text-blue-700 bg-blue-50' : 'text-gray-600 hover:bg-gray-50'}`}>
                <span>{icon}</span>{label}
              </button>
            ))}
          </div>
        )}

        {/* Tabs desktop */}
        <div className="hidden sm:flex max-w-5xl mx-auto px-4 border-t border-gray-100 overflow-x-auto">
          {([
            ['accueil', '🏠 Accueil'],
            ['livraisons', `📦 Livraisons${livraisons.length > 0 ? ` (${livraisons.length})` : ''}`],
            ['wallet', '💰 Wallet'],
            ['notifications', `🔔 Notifs${unreadCount > 0 ? ` (${unreadCount})` : ''}`],
          ] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t as Tab)}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${tab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-0 sm:px-4 pb-20">

        {/* ══════════════════ ACCUEIL ══════════════════ */}
        {tab === 'accueil' && (
          <div>
            {/* CARTE PRINCIPALE — toujours visible en premier */}
            <div className={`relative ${mapHeight} transition-all duration-300 overflow-hidden bg-gray-200`}>
              <DashboardMap userLat={userLat} userLng={userLng} livraisons={livraisons} />

              {/* Overlay top */}
              <div className="absolute top-0 left-0 right-0 z-10 p-3 flex items-center justify-between">
                <div className="bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-2 shadow-lg">
                  <div className={`w-2 h-2 rounded-full ${userLat ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
                  <span className="text-xs font-semibold text-gray-700">
                    {userLat ? 'Position détectée' : 'Position inconnue'}
                  </span>
                </div>
                <button onClick={() => setMapExpanded(!mapExpanded)}
                  className="bg-white/95 backdrop-blur-sm rounded-xl px-3 py-2 flex items-center gap-1.5 shadow-lg text-xs font-semibold text-gray-700 hover:bg-white transition-colors">
                  {mapExpanded ? <><ChevronDown size={14} />Réduire</> : <><ArrowUpRight size={14} />Agrandir</>}
                </button>
              </div>

              {/* Barre recherche destination */}
              <div className="absolute bottom-0 left-0 right-0 z-10 p-3">
                <Link href="/client/nouvelle-livraison"
                  className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-xl hover:shadow-2xl transition-all active:scale-98 border border-gray-100">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#1a56db' }}>
                    <MapPin size={15} className="text-white" />
                  </div>
                  <span className="text-gray-400 text-sm flex-1">Où voulez-vous livrer ?</span>
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-orange-500">
                    <ArrowUpRight size={14} className="text-white" />
                  </div>
                </Link>
              </div>
            </div>

            <div className="px-4 sm:px-0 space-y-4 mt-4">
              {/* Stats rapides */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { icon: Package,    label: 'Total',    val: String(livraisons.length),                                    color: '#1a56db', bg: '#eff6ff' },
                  { icon: Zap,        label: 'En cours', val: String(activeDeliveries.length),                              color: '#8b5cf6', bg: '#f5f3ff' },
                  { icon: CheckCircle,label: 'Livrées',  val: String(livraisons.filter(l => l.statut === 'livree').length), color: '#22c55e', bg: '#f0fdf4' },
                  { icon: WalletIcon, label: 'Solde',    val: fPrice(wallet?.solde || 0),                                  color: '#f97316', bg: '#fff7ed' },
                ].map(s => (
                  <div key={s.label} className="bg-white rounded-2xl p-3.5 border border-gray-100 flex items-center gap-3" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
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

              {/* Actions rapides */}
              <div className="grid grid-cols-4 gap-2.5">
                {[
                  { icon: '📦', label: 'Livraison',  href: '/client/nouvelle-livraison', bg: '#1a56db' },
                  { icon: '💰', label: 'Wallet',     href: '/client/wallet',             bg: '#22c55e' },
                  { icon: '💬', label: 'Messages',   href: '/client/messages',           bg: '#8b5cf6' },
                  { icon: '👥', label: 'Contacts',   href: '/client/contacts-favoris',   bg: '#f97316' },
                ].map(a => (
                  <Link key={a.label} href={a.href}
                    className="rounded-2xl p-3 flex flex-col items-center gap-1.5 hover:opacity-90 active:scale-95 transition-all text-white"
                    style={{ background: a.bg }}>
                    <span className="text-xl">{a.icon}</span>
                    <span className="text-[10px] font-bold text-center leading-tight">{a.label}</span>
                  </Link>
                ))}
              </div>

              {/* Livraisons actives */}
              {activeDeliveries.length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                  <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                      <h2 className="font-bold text-gray-900 text-sm">En cours ({activeDeliveries.length})</h2>
                    </div>
                    <button onClick={() => setTab('livraisons')} className="text-xs font-semibold text-blue-600 hover:underline">Voir tout</button>
                  </div>
                  {activeDeliveries.slice(0, 3).map(l => {
                    const cfg = STATUT[l.statut] || STATUT.en_attente
                    return (
                      <div key={l.id} className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 ${cfg.bg}`}>
                        <span className="text-xl mt-0.5">{cfg.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/80 ${cfg.text}`}>{cfg.label}</span>
                          </div>
                          <p className="text-sm font-semibold text-gray-800 truncate">{l.depart_adresse}</p>
                          <p className="text-xs text-gray-500 truncate">→ {l.arrivee_adresse}</p>
                        </div>
                        <Link href={`/client/suivi/${l.id}`}
                          className="shrink-0 px-3 py-1.5 rounded-lg text-white text-xs font-bold active:scale-95"
                          style={{ background: '#1a56db' }}>
                          Suivre
                        </Link>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Historique récent */}
              {livraisons.filter(l => l.statut === 'livree' || l.statut === 'annulee').length > 0 && (
                <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                  <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between">
                    <h2 className="font-bold text-gray-900 text-sm">Récentes</h2>
                    <button onClick={() => setTab('livraisons')} className="text-xs font-semibold text-blue-600 hover:underline">Voir tout →</button>
                  </div>
                  {livraisons.filter(l => ['livree','annulee'].includes(l.statut)).slice(0, 4).map(l => {
                    const cfg = STATUT[l.statut] || STATUT.en_attente
                    return (
                      <div key={l.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                        <span className="text-lg shrink-0">{cfg.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{l.arrivee_adresse}</p>
                          <p className="text-xs text-gray-400">{fDate(l.created_at)}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black text-gray-800">{fPrice(l.prix_final || l.prix_calcule)}</p>
                          <p className={`text-[11px] font-semibold ${cfg.text}`}>{cfg.label}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Menu paramètres */}
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
                {[
                  { href: '/client/profil',          emoji: '👤', label: 'Mon profil',         sub: user?.telephone || '' },
                  { href: '/client/favoris',          emoji: '📍', label: 'Adresses favorites',  sub: 'Maison, Bureau...' },
                  { href: '/client/contacts-favoris', emoji: '👥', label: 'Contacts favoris',    sub: 'Destinataires fréquents' },
                  { href: '/client/wallet',           emoji: '💳', label: 'Mon Wallet',          sub: fPrice(wallet?.solde || 0) },
                ].map(item => (
                  <Link key={item.href} href={item.href}
                    className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 active:bg-gray-100 transition-colors">
                    <span className="text-xl w-8 text-center">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                      {item.sub && <p className="text-gray-400 text-xs truncate">{item.sub}</p>}
                    </div>
                    <ChevronRight size={15} className="text-gray-300 shrink-0" />
                  </Link>
                ))}
                <button onClick={async () => { await supabase.auth.signOut(); router.replace('/login') }}
                  className="flex items-center gap-3 px-4 py-3.5 hover:bg-red-50 w-full text-left active:bg-red-100 transition-colors">
                  <span className="text-xl w-8 text-center">🚪</span>
                  <span className="flex-1 font-semibold text-red-500 text-sm">Déconnexion</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════ LIVRAISONS ══════════════════ */}
        {tab === 'livraisons' && (
          <div className="px-4 sm:px-0 pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-gray-900">Mes livraisons</h2>
              <Link href="/client/nouvelle-livraison"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white font-bold text-sm active:scale-95 transition-all"
                style={{ background: '#1a56db' }}>
                <Plus size={14} />Créer
              </Link>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input placeholder="Rechercher adresse, destinataire..." value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 bg-white text-gray-900 placeholder-gray-400" />
              </div>
              <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)}
                className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 bg-white text-gray-700">
                <option value="tous">Tous les statuts</option>
                {Object.entries(STATUT).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
              </select>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
              {filteredLivraisons.length === 0 ? (
                <div className="p-12 text-center">
                  <Package size={40} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm font-medium">Aucune livraison trouvée</p>
                  <Link href="/client/nouvelle-livraison"
                    className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl text-white font-bold text-sm"
                    style={{ background: '#1a56db' }}>
                    <Plus size={14} />Créer ma première livraison
                  </Link>
                </div>
              ) : (
                filteredLivraisons.map(l => {
                  const cfg = STATUT[l.statut] || STATUT.en_attente
                  return (
                    <div key={l.id} className="px-4 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start gap-3">
                        <span className="text-xl mt-0.5 shrink-0">{cfg.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{l.depart_adresse}</p>
                              <p className="text-xs text-gray-400 truncate">→ {l.arrivee_adresse}</p>
                            </div>
                            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full shrink-0 ${cfg.bg} ${cfg.text}`}>{cfg.label}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                            <span className="text-gray-400">{fDate(l.created_at)}</span>
                            <span className="font-bold text-gray-800">{fPrice(l.prix_final || l.prix_calcule)}</span>
                            <span className="text-gray-300">•</span>
                            <span className="text-gray-500">{l.destinataire_nom}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-2">
                            {l.statut === 'en_attente' && (
                              <Link href={`/client/propositions/${l.id}`}
                                className="text-xs px-3 py-1 rounded-lg font-semibold text-orange-600 bg-orange-50 hover:bg-orange-100">
                                Voir propositions →
                              </Link>
                            )}
                            {!['livree', 'annulee', 'en_attente'].includes(l.statut) && (
                              <Link href={`/client/suivi/${l.id}`}
                                className="text-xs px-3 py-1 rounded-lg font-semibold text-white"
                                style={{ background: '#1a56db' }}>
                                🗺️ Suivre
                              </Link>
                            )}
                            {l.statut === 'livree' && (
                              <Link href={`/client/evaluation/${l.id}`}
                                className="text-xs px-3 py-1 rounded-lg font-semibold text-yellow-700 bg-yellow-50 hover:bg-yellow-100">
                                ⭐ Évaluer
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ══════════════════ WALLET ══════════════════ */}
        {tab === 'wallet' && (
          <div className="px-4 sm:px-0 pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setTab('accueil')}
                  className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                  <ArrowUp size={14} className="text-gray-600 rotate-[-90deg]" />
                </button>
                <h2 className="text-xl font-black text-gray-900">Mon Wallet</h2>
              </div>
              <Link href="/client/wallet" className="text-blue-600 text-sm font-semibold hover:underline">Gérer →</Link>
            </div>

            {/* Carte solde */}
            <div className="rounded-3xl p-6 text-white relative overflow-hidden"
              style={{ background: 'linear-gradient(135deg, #1a56db 0%, #1e3a8a 100%)' }}>
              <div className="absolute top-0 right-0 w-48 h-48 rounded-full opacity-10"
                style={{ background: 'white', transform: 'translate(30%, -30%)' }} />
              <p className="text-white/70 text-sm mb-1">Solde disponible</p>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="text-4xl font-black">{(wallet?.solde || 0).toLocaleString('fr-FR')}</span>
                <span className="text-lg font-semibold opacity-80">FCFA</span>
              </div>
              {wallet && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/15 rounded-xl p-3">
                    <p className="text-white/60 text-xs">Total rechargé</p>
                    <p className="font-bold text-sm mt-0.5">{fPrice(wallet.total_gains || 0)}</p>
                  </div>
                  <div className="bg-white/15 rounded-xl p-3">
                    <p className="text-white/60 text-xs">Total dépensé</p>
                    <p className="font-bold text-sm mt-0.5">{fPrice(wallet.total_retraits || 0)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions wallet */}
            <div className="grid grid-cols-2 gap-3">
              <Link href="/client/wallet"
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95 text-white"
                style={{ background: '#22c55e' }}>
                <ArrowDown size={16} />Recharger
              </Link>
              <Link href="/client/wallet"
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm border-2 border-gray-200 text-gray-700 hover:bg-gray-50 active:scale-95 transition-all">
                <TrendingUp size={16} />Historique
              </Link>
            </div>

            {/* Transactions */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden" style={{ boxShadow: '0 1px 8px rgba(0,0,0,0.04)' }}>
              <div className="px-4 py-3 border-b border-gray-50">
                <h3 className="font-bold text-gray-900 text-sm">Transactions récentes</h3>
              </div>
              {transactions.length === 0 ? (
                <div className="p-8 text-center">
                  <WalletIcon size={28} className="text-gray-200 mx-auto mb-2" />
                  <p className="text-gray-400 text-sm">Aucune transaction</p>
                </div>
              ) : (
                transactions.slice(0, 15).map(tx => {
                  const isCredit = ['gain', 'bonus', 'remboursement', 'recharge'].includes(tx.type)
                  const icons: Record<string, string> = {
                    gain: '💰', recharge: '📲', paiement_course: '📦', retrait: '🏦',
                    bonus: '🎁', remboursement: '↩️', commission: '📊',
                  }
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0"
                        style={{ background: isCredit ? '#f0fdf4' : '#fef2f2' }}>
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
                })
              )}
            </div>
          </div>
        )}

        {/* ══════════════════ NOTIFICATIONS ══════════════════ */}
        {tab === 'notifications' && (
          <div className="px-4 sm:px-0 pt-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button onClick={() => setTab('accueil')}
                  className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                  <ArrowUp size={14} className="text-gray-600 rotate-[-90deg]" />
                </button>
                <h2 className="text-xl font-black text-gray-900">Notifications</h2>
              </div>
              {unreadCount > 0 && (
                <button onClick={markAllRead}
                  className="text-blue-600 text-xs font-semibold hover:underline">
                  Tout marquer lu
                </button>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
                <Bell size={36} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm font-medium">Aucune notification</p>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id}
                  onClick={async () => {
                    if (!n.lu) {
                      await supabase.from('notifications').update({ lu: true }).eq('id', n.id)
                      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, lu: true } : x))
                    }
                  }}
                  className={`rounded-2xl p-4 border cursor-pointer transition-all active:scale-[0.98] ${
                    !n.lu
                      ? 'border-blue-200 bg-blue-50'
                      : 'border-gray-100 bg-white'
                  }`}
                  style={{ boxShadow: '0 1px 6px rgba(0,0,0,0.04)' }}>
                  <div className="flex items-start gap-3">
                    <span className="text-xl shrink-0">🔔</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-gray-900 text-sm">{n.titre}</p>
                      <p className="text-gray-600 text-xs mt-0.5 leading-relaxed">{n.message}</p>
                      <p className="text-gray-400 text-[11px] mt-1.5">{fDate(n.created_at)}</p>
                    </div>
                    {!n.lu && <div className="w-2.5 h-2.5 rounded-full shrink-0 mt-1" style={{ background: '#1a56db' }} />}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>

      {/* ── BOTTOM NAV MOBILE ── */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-100" style={{ boxShadow: '0 -4px 20px rgba(0,0,0,0.06)' }}>
        <div className="flex">
          {([
            ['accueil', '🏠', 'Accueil'],
            ['livraisons', '📦', 'Livraisons'],
            ['wallet', '💰', 'Wallet'],
            ['notifications', '🔔', 'Notifs'],
          ] as const).map(([t, icon, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-all relative ${tab === t ? 'text-blue-600' : 'text-gray-400'}`}>
              <span className="text-lg leading-none">{icon}</span>
              <span className="text-[10px] font-semibold">{label}</span>
              {t === 'notifications' && unreadCount > 0 && (
                <span className="absolute top-1.5 right-4 w-4 h-4 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                  style={{ background: '#ef4444' }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
              )}
              {tab === t && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full" style={{ background: '#1a56db' }} />}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
