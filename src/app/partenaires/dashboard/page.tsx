'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Package, TrendingUp, Clock, CheckCircle, XCircle, Zap, LogOut,
  User, Bell, RefreshCw, MapPin, ChevronRight, AlertCircle, Calendar,
  Phone, Wallet, BarChart3, ShieldCheck, Map, Plus, FileText,
  ArrowUpRight, ArrowDownRight, Eye, X, Search, Filter
} from 'lucide-react'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────
interface Partenaire {
  id: string
  user_id: string
  entreprise: string
  nom_contact: string
  telephone: string | null
  email_pro: string | null
  plan: 'starter' | 'business' | 'enterprise'
  statut: 'actif' | 'suspendu' | 'en_attente'
  livraisons_max: number
  livraisons_mois: number
  taux_commission: number
  date_debut: string
  date_fin: string | null
  created_at: string
}

interface LivraisonPartenaire {
  id: string
  partenaire_id: string
  adresse_depart: string
  adresse_arrivee: string
  statut: 'en_attente' | 'en_cours' | 'livre' | 'annule'
  prix: number | null
  commission: number | null
  destinataire_nom: string | null
  destinataire_tel: string | null
  instructions: string | null
  coursier_id: string | null
  lat_depart: number | null
  lng_depart: number | null
  lat_arrivee: number | null
  lng_arrivee: number | null
  created_at: string
  updated_at: string
}

// ── Constantes ───────────────────────────────────────────────
const PLAN_CONFIG = {
  starter:    { label: 'Starter',    badge: 'bg-green-500/15 text-green-400 border-green-500/25',  emoji: '🟢' },
  business:   { label: 'Business',   badge: 'bg-orange-500/15 text-orange-400 border-orange-500/25', emoji: '🟠' },
  enterprise: { label: 'Enterprise', badge: 'bg-purple-500/15 text-purple-400 border-purple-500/25', emoji: '🏢' },
}

const STATUT_CONFIG = {
  en_attente: { label: 'En attente', color: 'text-amber-400',  bg: 'bg-amber-400/15 border-amber-400/30',   dot: 'bg-amber-400'  },
  en_cours:   { label: 'En cours',   color: 'text-purple-400', bg: 'bg-purple-400/15 border-purple-400/30', dot: 'bg-purple-400' },
  livre:      { label: 'Livré ✓',    color: 'text-green-400',  bg: 'bg-green-400/15 border-green-400/30',   dot: 'bg-green-400'  },
  annule:     { label: 'Annulé',     color: 'text-red-400',    bg: 'bg-red-400/15 border-red-400/30',       dot: 'bg-red-400'    },
}

const ONGLETS = [
  { id: 'dashboard', label: 'Dashboard',    icon: BarChart3 },
  { id: 'livraisons', label: 'Livraisons',  icon: Package   },
  { id: 'comptabilite', label: 'Finances',  icon: Wallet    },
  { id: 'securite', label: 'Sécurité',      icon: ShieldCheck },
]

// ── Composants utilitaires ───────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, color, trend }: {
  icon: React.ElementType; label: string; value: string | number
  sub?: string; color: string; trend?: 'up' | 'down' | null
}) {
  return (
    <div className="card p-5 flex items-start gap-4 hover:shadow-lg transition-shadow">
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-nyme-text-muted text-xs font-body font-semibold uppercase tracking-wider mb-1">{label}</p>
        <div className="flex items-center gap-2">
          <p className="font-heading text-2xl font-black text-nyme-text">{value}</p>
          {trend === 'up' && <ArrowUpRight size={14} className="text-green-400" />}
          {trend === 'down' && <ArrowDownRight size={14} className="text-red-400" />}
        </div>
        {sub && <p className="text-nyme-text-muted text-xs font-body mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

function Badge({ statut }: { statut: string }) {
  const s = STATUT_CONFIG[statut as keyof typeof STATUT_CONFIG] || STATUT_CONFIG.en_attente
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border font-body ${s.bg} ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

// ── Composant Map simple (sans clé API intégrée) ─────────────
function MiniMap({ lat, lng, label }: { lat: number; lng: number; label: string }) {
  // Utilise OpenStreetMap sans clé API pour les aperçus
  const zoom = 14
  const tileUrl = `https://tile.openstreetmap.org/${zoom}/${Math.floor((lng + 180) / 360 * Math.pow(2, zoom))}/${Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom))}.png`

  return (
    <div className="relative w-full h-40 rounded-xl overflow-hidden bg-nyme-bg-input">
      <iframe
        src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.01},${lat - 0.01},${lng + 0.01},${lat + 0.01}&layer=mapnik&marker=${lat},${lng}`}
        className="w-full h-full border-0"
        title={label}
      />
      <div className="absolute bottom-2 left-2 bg-black/60 backdrop-blur-sm text-white text-xs px-2 py-1 rounded-lg font-body">
        {label}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════
export default function PartenaireDashboard() {
  const router = useRouter()

  const [user,       setUser]       = useState<any>(null)
  const [partenaire, setPartenaire] = useState<Partenaire | null>(null)
  const [livraisons, setLivraisons] = useState<LivraisonPartenaire[]>([])
  const [loading,    setLoading]    = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error,      setError]      = useState('')
  const [onglet,     setOnglet]     = useState('dashboard')
  const [recherche,  setRecherche]  = useState('')
  const [filtreStatut, setFiltreStatut] = useState('tous')
  const [livraisonDetail, setLivraisonDetail] = useState<LivraisonPartenaire | null>(null)
  const [alertesFraude, setAlertesFraude] = useState<string[]>([])

  // ── Auth ──────────────────────────────────────────────────
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/partenaires/login'); return }
      setUser(session.user)
      await loadData(session.user.id)
    }
    checkAuth()

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') router.replace('/partenaires/login')
    })
    return () => listener.subscription.unsubscribe()
  }, [router])

  // ── Charger données ───────────────────────────────────────
  const loadData = useCallback(async (userId: string) => {
    try {
      // 1. Partenaire
      const { data: part, error: partErr } = await supabase
        .from('partenaires')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (partErr) {
        if (partErr.code === 'PGRST116') {
          setError('Profil partenaire introuvable. Contactez nyme.contact@gmail.com')
        } else {
          setError(`Erreur: ${partErr.message}`)
        }
        setLoading(false)
        return
      }

      setPartenaire(part)

      // 2. Livraisons
      const { data: livs } = await supabase
        .from('livraisons_partenaire')
        .select('*')
        .eq('partenaire_id', part.id)
        .order('created_at', { ascending: false })
        .limit(100)

      setLivraisons(livs || [])

      // 3. Détection fraude
      detecterFraude(livs || [], part)

    } catch (err: any) {
      setError('Erreur de chargement. Réessayez.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // ── Détection de fraude ───────────────────────────────────
  const detecterFraude = (livs: LivraisonPartenaire[], part: Partenaire) => {
    const alertes: string[] = []

    // Vérification 1 : trop de livraisons annulées (> 40%)
    const total = livs.length
    const annulees = livs.filter(l => l.statut === 'annule').length
    if (total > 5 && annulees / total > 0.4) {
      alertes.push(`⚠️ Taux d'annulation élevé : ${Math.round(annulees/total*100)}% (${annulees}/${total})`)
    }

    // Vérification 2 : dépassement quota
    if (part.livraisons_mois > part.livraisons_max) {
      alertes.push(`🚨 Quota dépassé : ${part.livraisons_mois}/${part.livraisons_max} livraisons ce mois`)
    }

    // Vérification 3 : compte en attente avec livraisons
    if (part.statut === 'en_attente' && livs.length > 0) {
      alertes.push(`⚠️ Compte en attente de validation mais livraisons existantes`)
    }

    // Vérification 4 : livraisons avec prix anormalement bas
    const livsAvecPrix = livs.filter(l => l.prix !== null && l.prix > 0)
    if (livsAvecPrix.length > 0) {
      const prixMoyen = livsAvecPrix.reduce((s, l) => s + (l.prix || 0), 0) / livsAvecPrix.length
      const livsAnormales = livsAvecPrix.filter(l => l.prix! < prixMoyen * 0.3)
      if (livsAnormales.length > 2) {
        alertes.push(`⚠️ ${livsAnormales.length} livraisons avec prix anormalement bas détectées`)
      }
    }

    setAlertesFraude(alertes)
  }

  // ── Stats ────────────────────────────────────────────────
  const stats = {
    total:       livraisons.length,
    livrees:     livraisons.filter(l => l.statut === 'livre').length,
    en_cours:    livraisons.filter(l => l.statut === 'en_cours').length,
    en_attente:  livraisons.filter(l => l.statut === 'en_attente').length,
    annulees:    livraisons.filter(l => l.statut === 'annule').length,
    depenses:    livraisons.filter(l => l.statut === 'livre').reduce((s, l) => s + (l.prix || 0), 0),
    commissions: livraisons.filter(l => l.statut === 'livre').reduce((s, l) => s + (l.commission || 0), 0),
    net:         livraisons.filter(l => l.statut === 'livre').reduce((s, l) => s + ((l.prix || 0) - (l.commission || 0)), 0),
    txSucces:    livraisons.length > 0 ? Math.round(livraisons.filter(l => l.statut === 'livre').length / livraisons.length * 100) : 0,
  }

  const progression = partenaire
    ? Math.min(100, Math.round(partenaire.livraisons_mois / partenaire.livraisons_max * 100))
    : 0

  // ── Livraisons filtrées ───────────────────────────────────
  const livraisonsFiltrees = livraisons.filter(l => {
    const matchStatut = filtreStatut === 'tous' || l.statut === filtreStatut
    const matchRecherche = recherche === '' ||
      l.adresse_depart.toLowerCase().includes(recherche.toLowerCase()) ||
      l.adresse_arrivee.toLowerCase().includes(recherche.toLowerCase()) ||
      (l.destinataire_nom || '').toLowerCase().includes(recherche.toLowerCase())
    return matchStatut && matchRecherche
  })

  // ── Données comptabilité par mois ─────────────────────────
  const comptabiliteParMois = livraisons
    .filter(l => l.statut === 'livre' && l.prix)
    .reduce((acc, l) => {
      const mois = new Date(l.created_at).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
      if (!acc[mois]) acc[mois] = { livraisons: 0, depenses: 0, commissions: 0 }
      acc[mois].livraisons++
      acc[mois].depenses += l.prix || 0
      acc[mois].commissions += l.commission || 0
      return acc
    }, {} as Record<string, { livraisons: number; depenses: number; commissions: number }>)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.replace('/partenaires/login')
  }

  const handleRefresh = () => {
    if (!user) return
    setRefreshing(true)
    loadData(user.id)
  }

  // ── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-nyme-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-[3px] border-nyme-primary/25 border-t-nyme-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-nyme-text-muted font-body text-sm">Chargement du dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-nyme-bg">

      {/* ── NAVBAR ───────────────────────────────────────── */}
      <nav className="bg-nyme-primary-dark border-b border-white/10 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-nyme-orange to-[#d4691a] flex items-center justify-center">
              <Zap size={16} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-heading text-white font-extrabold tracking-wider">NYME</span>
            <span className="hidden sm:block text-white/40 text-xs font-body ml-1">/ Partenaires</span>
          </Link>

          <div className="flex items-center gap-2">
            {/* Alerte fraude */}
            {alertesFraude.length > 0 && (
              <div className="relative">
                <button className="p-2 rounded-lg text-red-400 hover:bg-red-400/10 transition-all" title="Alertes sécurité">
                  <AlertCircle size={16} />
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-bold">
                    {alertesFraude.length}
                  </span>
                </button>
              </div>
            )}
            <button onClick={handleRefresh} disabled={refreshing}
              className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/8 transition-all">
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/8 border border-white/12">
              <User size={14} className="text-nyme-orange" />
              <span className="text-white/70 text-xs font-body truncate max-w-[120px]">
                {partenaire?.nom_contact || user?.email?.split('@')[0]}
              </span>
            </div>
            <button onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white/60 hover:text-red-400 hover:bg-red-400/10 transition-all text-xs font-body font-semibold">
              <LogOut size={14} /> <span className="hidden sm:block">Déconnexion</span>
            </button>
          </div>
        </div>

        {/* Navigation onglets */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 pb-0 overflow-x-auto">
          {ONGLETS.map(o => (
            <button key={o.id} onClick={() => setOnglet(o.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold font-body border-b-2 transition-all whitespace-nowrap ${
                onglet === o.id
                  ? 'border-nyme-orange text-nyme-orange'
                  : 'border-transparent text-white/50 hover:text-white/80'
              }`}>
              <o.icon size={13} /> {o.label}
            </button>
          ))}
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Erreur */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/25 flex items-center gap-3 text-red-400 text-sm font-body">
            <AlertCircle size={16} className="shrink-0" />
            {error}
            <button onClick={() => setError('')} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        {/* ════════════════════════════════════════════════ */}
        {/* ONGLET DASHBOARD                                 */}
        {/* ════════════════════════════════════════════════ */}
        {onglet === 'dashboard' && (
          <div className="space-y-6">

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-heading text-2xl sm:text-3xl font-black text-nyme-text">
                  Bonjour, {partenaire?.nom_contact?.split(' ')[0] || 'Partenaire'} 👋
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <p className="text-nyme-text-muted text-sm font-body">{partenaire?.entreprise}</p>
                  {partenaire && (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border ${PLAN_CONFIG[partenaire.plan].badge}`}>
                      {PLAN_CONFIG[partenaire.plan].emoji} {PLAN_CONFIG[partenaire.plan].label}
                    </span>
                  )}
                  {partenaire?.statut === 'en_attente' && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold border bg-amber-400/15 text-amber-400 border-amber-400/25">
                      ⏳ En cours de validation
                    </span>
                  )}
                </div>
              </div>
              <a href="https://wa.me/22600000000?text=Bonjour+NYME,+je+souhaite+commander+une+livraison"
                target="_blank" rel="noopener noreferrer"
                className="btn-primary inline-flex items-center gap-2 text-sm whitespace-nowrap">
                <Plus size={15} /> Nouvelle livraison
              </a>
            </div>

            {/* Alertes fraude */}
            {alertesFraude.length > 0 && (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/25 space-y-2">
                <p className="text-red-400 font-semibold text-sm font-body flex items-center gap-2">
                  <ShieldCheck size={15} /> Alertes sécurité ({alertesFraude.length})
                </p>
                {alertesFraude.map((a, i) => (
                  <p key={i} className="text-red-400/80 text-xs font-body ml-5">{a}</p>
                ))}
              </div>
            )}

            {/* Alerte quota */}
            {partenaire && progression >= 80 && (
              <div className={`p-4 rounded-xl border flex items-center gap-3 text-sm font-body ${
                progression >= 100
                  ? 'bg-red-500/10 border-red-500/25 text-red-400'
                  : 'bg-amber-400/10 border-amber-400/25 text-amber-400'
              }`}>
                <Bell size={16} className="shrink-0" />
                {progression >= 100
                  ? `🚨 Quota atteint (${partenaire.livraisons_mois}/${partenaire.livraisons_max})`
                  : `🔔 ${progression}% de votre quota utilisé ce mois`}
                <a href="mailto:nyme.contact@gmail.com" className="ml-auto underline font-semibold">
                  Nous contacter
                </a>
              </div>
            )}

            {/* Barre de progression */}
            {partenaire && (
              <div className="card p-5">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-nyme-text font-semibold text-sm font-body">Livraisons ce mois</p>
                  <p className="text-nyme-text-muted text-sm font-body">
                    <span className="text-nyme-primary font-bold text-base">{partenaire.livraisons_mois}</span>
                    {' / '}{partenaire.livraisons_max}
                  </p>
                </div>
                <div className="w-full h-2.5 bg-nyme-bg-input rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${
                    progression >= 100 ? 'bg-red-500' : progression >= 80 ? 'bg-amber-400' : 'bg-gradient-to-r from-nyme-primary to-nyme-orange'
                  }`} style={{ width: `${Math.min(100, progression)}%` }} />
                </div>
                <p className="text-nyme-text-muted text-xs font-body mt-2">
                  {partenaire.livraisons_max - partenaire.livraisons_mois > 0
                    ? `${partenaire.livraisons_max - partenaire.livraisons_mois} livraisons restantes`
                    : 'Quota mensuel atteint'}
                </p>
              </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              <StatCard icon={Package}     label="Total livraisons" value={stats.total}      color="bg-nyme-primary"  />
              <StatCard icon={CheckCircle} label="Livrées"           value={stats.livrees}    color="bg-green-600"    sub={`${stats.txSucces}% succès`} trend={stats.txSucces > 80 ? 'up' : 'down'} />
              <StatCard icon={Clock}       label="En cours"          value={stats.en_cours}   color="bg-purple-600"   />
              <StatCard icon={TrendingUp}  label="Dépenses (FCFA)"   value={stats.depenses > 0 ? stats.depenses.toLocaleString('fr-FR') : '—'} color="bg-nyme-orange" />
            </div>

            {/* Livraisons récentes */}
            <div className="card overflow-hidden">
              <div className="p-5 border-b border-nyme-border flex items-center justify-between">
                <h2 className="font-heading text-nyme-text font-bold text-lg">Livraisons récentes</h2>
                <button onClick={() => setOnglet('livraisons')} className="text-nyme-primary text-xs font-body hover:underline">
                  Voir tout →
                </button>
              </div>
              {livraisons.slice(0, 5).length === 0 ? (
                <div className="p-12 text-center">
                  <Package size={40} className="text-nyme-border mx-auto mb-3" />
                  <p className="text-nyme-text font-semibold font-body mb-1">Aucune livraison</p>
                  <p className="text-nyme-text-muted text-sm font-body mb-4">Commandez via WhatsApp ou l'application.</p>
                  <a href="https://wa.me/22600000000" target="_blank" rel="noopener noreferrer"
                    className="btn-primary inline-flex items-center gap-2 text-sm">
                    💬 Commander sur WhatsApp
                  </a>
                </div>
              ) : (
                <div className="divide-y divide-nyme-border">
                  {livraisons.slice(0, 5).map(liv => (
                    <LivraisonRow key={liv.id} liv={liv} onDetail={() => setLivraisonDetail(liv)} />
                  ))}
                </div>
              )}
            </div>

            {/* Contact rapide */}
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="card p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0">
                  <span className="text-xl">💬</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-nyme-text font-bold text-sm font-body">WhatsApp direct</p>
                  <p className="text-nyme-text-muted text-xs font-body">Commande rapide</p>
                </div>
                <a href="https://wa.me/22600000000" target="_blank" rel="noopener noreferrer"
                  className="btn-primary text-xs py-2 px-3 whitespace-nowrap">
                  Ouvrir
                </a>
              </div>
              <div className="card p-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-nyme-primary/10 flex items-center justify-center shrink-0">
                  <Phone size={18} className="text-nyme-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-nyme-text font-bold text-sm font-body">Support NYME</p>
                  <p className="text-nyme-text-muted text-xs font-body">nyme.contact@gmail.com</p>
                </div>
                <a href="mailto:nyme.contact@gmail.com" className="btn-secondary text-xs py-2 px-3 whitespace-nowrap">
                  Email
                </a>
              </div>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════ */}
        {/* ONGLET LIVRAISONS                                */}
        {/* ════════════════════════════════════════════════ */}
        {onglet === 'livraisons' && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <h2 className="font-heading text-xl font-bold text-nyme-text">
                Toutes les livraisons <span className="text-nyme-text-muted text-sm font-body font-normal">({livraisons.length})</span>
              </h2>
              <a href="https://wa.me/22600000000" target="_blank" rel="noopener noreferrer"
                className="btn-primary inline-flex items-center gap-2 text-sm">
                <Plus size={14} /> Nouvelle livraison
              </a>
            </div>

            {/* Filtres */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nyme-text-muted" />
                <input
                  type="text"
                  placeholder="Rechercher adresse, destinataire..."
                  value={recherche}
                  onChange={e => setRecherche(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-nyme-bg-input border border-nyme-border text-nyme-text placeholder-nyme-text-muted text-sm font-body focus:outline-none focus:border-nyme-primary"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {['tous', 'en_attente', 'en_cours', 'livre', 'annule'].map(s => (
                  <button key={s} onClick={() => setFiltreStatut(s)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold font-body transition-all ${
                      filtreStatut === s
                        ? 'bg-nyme-primary text-white'
                        : 'bg-nyme-bg-input text-nyme-text-muted hover:text-nyme-text border border-nyme-border'
                    }`}>
                    {s === 'tous' ? 'Tous' : STATUT_CONFIG[s as keyof typeof STATUT_CONFIG]?.label || s}
                  </button>
                ))}
              </div>
            </div>

            {/* Liste */}
            <div className="card overflow-hidden">
              {livraisonsFiltrees.length === 0 ? (
                <div className="p-10 text-center text-nyme-text-muted font-body">
                  <Package size={32} className="mx-auto mb-3 opacity-30" />
                  Aucune livraison {filtreStatut !== 'tous' ? `avec statut "${STATUT_CONFIG[filtreStatut as keyof typeof STATUT_CONFIG]?.label}"` : ''}
                </div>
              ) : (
                <div className="divide-y divide-nyme-border">
                  {livraisonsFiltrees.map(liv => (
                    <LivraisonRow key={liv.id} liv={liv} onDetail={() => setLivraisonDetail(liv)} showDetails />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════ */}
        {/* ONGLET COMPTABILITÉ                              */}
        {/* ════════════════════════════════════════════════ */}
        {onglet === 'comptabilite' && (
          <div className="space-y-6">
            <h2 className="font-heading text-xl font-bold text-nyme-text">Finances & Comptabilité</h2>

            {/* Résumé financier */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card p-5 text-center">
                <p className="text-nyme-text-muted text-xs uppercase tracking-wider font-body mb-2">Dépenses totales</p>
                <p className="font-heading text-3xl font-black text-nyme-primary">
                  {stats.depenses.toLocaleString('fr-FR')}
                </p>
                <p className="text-nyme-text-muted text-xs font-body mt-1">FCFA</p>
              </div>
              <div className="card p-5 text-center">
                <p className="text-nyme-text-muted text-xs uppercase tracking-wider font-body mb-2">Commissions NYME</p>
                <p className="font-heading text-3xl font-black text-nyme-orange">
                  {stats.commissions.toLocaleString('fr-FR')}
                </p>
                <p className="text-nyme-text-muted text-xs font-body mt-1">
                  FCFA ({partenaire?.taux_commission || 12}%)
                </p>
              </div>
              <div className="card p-5 text-center">
                <p className="text-nyme-text-muted text-xs uppercase tracking-wider font-body mb-2">Net livraisons</p>
                <p className="font-heading text-3xl font-black text-green-400">
                  {stats.net.toLocaleString('fr-FR')}
                </p>
                <p className="text-nyme-text-muted text-xs font-body mt-1">FCFA</p>
              </div>
            </div>

            {/* Tableau par mois */}
            <div className="card overflow-hidden">
              <div className="p-5 border-b border-nyme-border">
                <h3 className="font-heading font-bold text-nyme-text">Récapitulatif mensuel</h3>
              </div>
              {Object.keys(comptabiliteParMois).length === 0 ? (
                <div className="p-8 text-center text-nyme-text-muted font-body text-sm">
                  Aucune donnée de facturation disponible
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm font-body">
                    <thead>
                      <tr className="bg-nyme-bg border-b border-nyme-border">
                        <th className="text-left px-5 py-3 text-nyme-text-muted text-xs uppercase tracking-wider">Mois</th>
                        <th className="text-right px-5 py-3 text-nyme-text-muted text-xs uppercase tracking-wider">Livraisons</th>
                        <th className="text-right px-5 py-3 text-nyme-text-muted text-xs uppercase tracking-wider">Montant (FCFA)</th>
                        <th className="text-right px-5 py-3 text-nyme-text-muted text-xs uppercase tracking-wider">Commission</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-nyme-border">
                      {Object.entries(comptabiliteParMois).map(([mois, data]) => (
                        <tr key={mois} className="hover:bg-nyme-bg transition-colors">
                          <td className="px-5 py-3.5 text-nyme-text font-medium capitalize">{mois}</td>
                          <td className="px-5 py-3.5 text-right text-nyme-text">{data.livraisons}</td>
                          <td className="px-5 py-3.5 text-right text-nyme-primary font-semibold">
                            {data.depenses.toLocaleString('fr-FR')}
                          </td>
                          <td className="px-5 py-3.5 text-right text-nyme-orange">
                            {data.commissions.toLocaleString('fr-FR')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="bg-nyme-bg border-t-2 border-nyme-border font-bold">
                        <td className="px-5 py-3.5 text-nyme-text">TOTAL</td>
                        <td className="px-5 py-3.5 text-right text-nyme-text">{stats.livrees}</td>
                        <td className="px-5 py-3.5 text-right text-nyme-primary">{stats.depenses.toLocaleString('fr-FR')}</td>
                        <td className="px-5 py-3.5 text-right text-nyme-orange">{stats.commissions.toLocaleString('fr-FR')}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            {/* Export */}
            <div className="card p-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-nyme-text font-semibold font-body">Exporter les données</p>
                <p className="text-nyme-text-muted text-xs font-body mt-0.5">Téléchargez votre historique en CSV</p>
              </div>
              <button
                onClick={() => {
                  const csv = [
                    ['ID', 'Date', 'Départ', 'Arrivée', 'Statut', 'Prix (FCFA)', 'Commission (FCFA)'],
                    ...livraisons.map(l => [
                      l.id.substring(0, 8),
                      new Date(l.created_at).toLocaleDateString('fr-FR'),
                      l.adresse_depart,
                      l.adresse_arrivee,
                      STATUT_CONFIG[l.statut]?.label || l.statut,
                      l.prix || 0,
                      l.commission || 0,
                    ])
                  ].map(row => row.join(';')).join('\n')

                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `nyme-livraisons-${new Date().toLocaleDateString('fr-FR')}.csv`
                  a.click()
                }}
                className="btn-primary text-sm flex items-center gap-2 whitespace-nowrap">
                <FileText size={14} /> Exporter CSV
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════ */}
        {/* ONGLET SÉCURITÉ                                  */}
        {/* ════════════════════════════════════════════════ */}
        {onglet === 'securite' && (
          <div className="space-y-6">
            <h2 className="font-heading text-xl font-bold text-nyme-text">Sécurité & Anti-fraude</h2>

            {/* Statut compte */}
            <div className="card p-5">
              <h3 className="font-body font-bold text-nyme-text mb-4">Statut du compte</h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { label: 'Statut', value: partenaire?.statut === 'actif' ? '✅ Actif' : partenaire?.statut === 'en_attente' ? '⏳ En attente' : '❌ Suspendu' },
                  { label: 'Plan', value: `${PLAN_CONFIG[partenaire?.plan || 'starter'].emoji} ${PLAN_CONFIG[partenaire?.plan || 'starter'].label}` },
                  { label: 'Membre depuis', value: partenaire ? new Date(partenaire.date_debut).toLocaleDateString('fr-FR') : '—' },
                  { label: 'Commission', value: `${partenaire?.taux_commission || 12}%` },
                  { label: 'Email', value: partenaire?.email_pro || user?.email || '—' },
                  { label: 'Téléphone', value: partenaire?.telephone || '—' },
                ].map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-nyme-bg">
                    <span className="text-nyme-text-muted text-sm font-body">{item.label}</span>
                    <span className="text-nyme-text text-sm font-semibold font-body">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Alertes actives */}
            <div className="card p-5">
              <h3 className="font-body font-bold text-nyme-text mb-4 flex items-center gap-2">
                <ShieldCheck size={16} className="text-nyme-primary" />
                Alertes de sécurité ({alertesFraude.length})
              </h3>
              {alertesFraude.length === 0 ? (
                <div className="flex items-center gap-3 text-green-400 text-sm font-body">
                  <CheckCircle size={16} />
                  Aucune alerte détectée — compte sécurisé ✓
                </div>
              ) : (
                <div className="space-y-2">
                  {alertesFraude.map((a, i) => (
                    <div key={i} className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-400 text-sm font-body flex items-start gap-2">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      {a}
                    </div>
                  ))}
                  <p className="text-nyme-text-muted text-xs font-body mt-3">
                    Des anomalies ont été détectées. Contactez{' '}
                    <a href="mailto:nyme.contact@gmail.com" className="text-nyme-primary hover:underline">
                      nyme.contact@gmail.com
                    </a>
                  </p>
                </div>
              )}
            </div>

            {/* Statistiques sécurité */}
            <div className="card p-5">
              <h3 className="font-body font-bold text-nyme-text mb-4">Analyse des livraisons</h3>
              <div className="space-y-3">
                {[
                  { label: 'Taux de succès', value: `${stats.txSucces}%`, color: stats.txSucces >= 80 ? 'text-green-400' : stats.txSucces >= 60 ? 'text-amber-400' : 'text-red-400', bar: stats.txSucces, barColor: stats.txSucces >= 80 ? 'bg-green-500' : stats.txSucces >= 60 ? 'bg-amber-400' : 'bg-red-500' },
                  { label: 'Taux d\'annulation', value: `${stats.total > 0 ? Math.round(stats.annulees / stats.total * 100) : 0}%`, color: stats.annulees / Math.max(stats.total, 1) <= 0.2 ? 'text-green-400' : 'text-red-400', bar: stats.total > 0 ? Math.round(stats.annulees / stats.total * 100) : 0, barColor: 'bg-red-500' },
                  { label: 'Utilisation quota', value: `${progression}%`, color: progression >= 90 ? 'text-red-400' : progression >= 70 ? 'text-amber-400' : 'text-green-400', bar: progression, barColor: progression >= 90 ? 'bg-red-500' : progression >= 70 ? 'bg-amber-400' : 'bg-nyme-primary' },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-nyme-text-muted text-sm font-body">{item.label}</span>
                      <span className={`text-sm font-bold font-body ${item.color}`}>{item.value}</span>
                    </div>
                    <div className="w-full h-1.5 bg-nyme-bg-input rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${item.barColor}`} style={{ width: `${Math.min(100, item.bar)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <p className="text-center text-nyme-text-muted text-xs font-body mt-8">
          © {new Date().getFullYear()} NYME · Dashboard Partenaires · Ouagadougou, Burkina Faso
        </p>
      </div>

      {/* ── MODAL DÉTAIL LIVRAISON ── */}
      {livraisonDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setLivraisonDetail(null)}>
          <div className="bg-nyme-bg-card rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto border border-nyme-border"
            onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-nyme-border flex items-center justify-between sticky top-0 bg-nyme-bg-card">
              <h3 className="font-heading font-bold text-nyme-text">
                Livraison #{livraisonDetail.id.substring(0, 8).toUpperCase()}
              </h3>
              <button onClick={() => setLivraisonDetail(null)} className="p-1.5 rounded-lg hover:bg-nyme-bg transition-colors">
                <X size={16} className="text-nyme-text-muted" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-nyme-text-muted text-sm font-body">Statut</span>
                <Badge statut={livraisonDetail.statut} />
              </div>

              {/* Carte mini si coordonnées disponibles */}
              {livraisonDetail.lat_depart && livraisonDetail.lng_depart && (
                <MiniMap lat={livraisonDetail.lat_depart} lng={livraisonDetail.lng_depart} label="Point de départ" />
              )}

              {[
                { label: '📍 Départ', value: livraisonDetail.adresse_depart },
                { label: '🏁 Arrivée', value: livraisonDetail.adresse_arrivee },
                { label: '👤 Destinataire', value: livraisonDetail.destinataire_nom || '—' },
                { label: '📞 Téléphone', value: livraisonDetail.destinataire_tel || '—' },
                { label: '📝 Instructions', value: livraisonDetail.instructions || '—' },
                { label: '💰 Prix', value: livraisonDetail.prix ? `${livraisonDetail.prix.toLocaleString('fr-FR')} FCFA` : '—' },
                { label: '📅 Créée le', value: new Date(livraisonDetail.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
              ].map((item, i) => (
                <div key={i} className="flex items-start justify-between gap-3 py-2 border-b border-nyme-border/50 last:border-0">
                  <span className="text-nyme-text-muted text-sm font-body shrink-0">{item.label}</span>
                  <span className="text-nyme-text text-sm font-body text-right">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Composant ligne livraison ─────────────────────────────────
function LivraisonRow({ liv, onDetail, showDetails = false }: {
  liv: LivraisonPartenaire; onDetail: () => void; showDetails?: boolean
}) {
  return (
    <div className="p-4 sm:p-5 flex items-start gap-3 sm:gap-4 hover:bg-nyme-bg transition-colors cursor-pointer"
      onClick={onDetail}>
      <div className="w-9 h-9 rounded-xl bg-nyme-bg-input flex items-center justify-center shrink-0 mt-0.5">
        <MapPin size={15} className="text-nyme-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-nyme-text font-semibold text-sm font-body truncate">{liv.adresse_depart}</p>
            <div className="flex items-center gap-1 mt-0.5">
              <ChevronRight size={11} className="text-nyme-text-muted shrink-0" />
              <p className="text-nyme-text-muted text-xs font-body truncate">{liv.adresse_arrivee}</p>
            </div>
          </div>
          <Badge statut={liv.statut} />
        </div>
        <div className="flex flex-wrap items-center gap-3 mt-2">
          <span className="flex items-center gap-1 text-nyme-text-muted text-xs font-body">
            <Calendar size={10} />
            {new Date(liv.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
          </span>
          {liv.prix && (
            <span className="text-nyme-orange font-bold text-xs font-body">
              {liv.prix.toLocaleString('fr-FR')} FCFA
            </span>
          )}
          {showDetails && liv.destinataire_nom && (
            <span className="text-nyme-text-muted text-xs font-body">👤 {liv.destinataire_nom}</span>
          )}
          <span className="ml-auto">
            <Eye size={13} className="text-nyme-text-muted" />
          </span>
        </div>
      </div>
    </div>
  )
}
