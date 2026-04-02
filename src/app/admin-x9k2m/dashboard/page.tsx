'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Zap, LogOut, Users, Package, TrendingUp, ShieldCheck,
  Plus, X, AlertCircle, CheckCircle, RefreshCw, Eye,
  Building2, User, Phone, Mail, Loader2,
  BarChart3, Wallet, FileCheck, Search,
  Ban, UserCheck, Send, DollarSign, CreditCard,
  ArrowDownLeft, ChevronDown, ChevronUp, Truck,
  Clock, XCircle, CheckCircle2, AlertTriangle
} from 'lucide-react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────
interface PartenaireAdmin {
  id: string; user_id: string; entreprise: string; nom_contact: string
  telephone: string | null; email_pro: string | null
  plan: 'starter' | 'business' | 'enterprise'
  statut: 'actif' | 'suspendu' | 'en_attente' | 'rejete'
  livraisons_max: number; livraisons_mois: number
  taux_commission: number; date_debut: string; created_at: string
}

interface CoursierAdmin {
  id: string; nom: string; email: string; telephone: string
  statut_verification: 'en_attente' | 'verifie' | 'rejete'
  statut: 'hors_ligne' | 'disponible' | 'occupe'
  cni_recto_url: string; cni_verso_url: string; permis_url: string
  total_gains: number; total_courses: number; created_at: string
  wallet_solde?: number
}

interface ClientAdmin {
  id: string; nom: string; email: string; telephone: string
  est_actif: boolean; est_verifie: boolean
  created_at: string; total_livraisons?: number
}

interface LivraisonAdmin {
  id: string; client_nom: string; coursier_nom: string
  statut: string; type: string; depart_adresse: string
  arrivee_adresse: string; prix_final: number; created_at: string
}

interface WalletAdmin {
  id: string; user_id: string; solde: number; total_gains: number
  total_retraits: number; created_at: string
  utilisateur?: { nom: string; email: string; role: string }
}

interface Transaction {
  id: string; wallet_id: string; type: string; montant: number
  statut: string; description: string; created_at: string
}

// ── Configs ────────────────────────────────────────────────────────
const PLAN_CFG = {
  starter:    { label:'Starter',    color:'text-green-600 bg-green-50 border-green-200' },
  business:   { label:'Business',   color:'text-orange-600 bg-orange-50 border-orange-200' },
  enterprise: { label:'Enterprise', color:'text-purple-600 bg-purple-50 border-purple-200' },
}

const STATUT_CFG: Record<string, { label: string; color: string; dot: string }> = {
  actif:       { label:'Actif',       color:'text-green-600 bg-green-50 border-green-200',  dot:'bg-green-500' },
  en_attente:  { label:'En attente',  color:'text-amber-600 bg-amber-50 border-amber-200',  dot:'bg-amber-400' },
  suspendu:    { label:'Suspendu',    color:'text-red-600 bg-red-50 border-red-200',        dot:'bg-red-500' },
  rejete:      { label:'Rejeté',      color:'text-gray-600 bg-gray-50 border-gray-200',     dot:'bg-gray-400' },
  verifie:     { label:'Vérifié',     color:'text-green-600 bg-green-50 border-green-200',  dot:'bg-green-500' },
  hors_ligne:  { label:'Hors ligne',  color:'text-gray-600 bg-gray-50 border-gray-200',     dot:'bg-gray-400' },
  disponible:  { label:'Disponible',  color:'text-green-600 bg-green-50 border-green-200',  dot:'bg-green-500' },
  occupe:      { label:'Occupé',      color:'text-blue-600 bg-blue-50 border-blue-200',     dot:'bg-blue-500' },
}

const ONGLETS = [
  { id:'overview',    label:'Vue générale',   icon:BarChart3 },
  { id:'partenaires', label:'Partenaires',    icon:Building2 },
  { id:'coursiers',   label:'Coursiers',      icon:Truck },
  { id:'clients',     label:'Clients',        icon:Users },
  { id:'livraisons',  label:'Courses',        icon:Package },
  { id:'wallet',      label:'Wallet/Finances', icon:Wallet },
  { id:'creation',    label:'Actions Admin',  icon:Plus },
]

function Badge({ statut }: { statut: string }) {
  const cfg = STATUT_CFG[statut] || STATUT_CFG.en_attente
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`}/>
      {cfg.label}
    </span>
  )
}

// ── Composant principal ────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter()
  const [adminUser,   setAdminUser]   = useState<any>(null)
  const [partenaires, setPartenaires] = useState<PartenaireAdmin[]>([])
  const [coursiers,   setCoursiers]   = useState<CoursierAdmin[]>([])
  const [clients,     setClients]     = useState<ClientAdmin[]>([])
  const [livraisons,  setLivraisons]  = useState<LivraisonAdmin[]>([])
  const [wallets,     setWallets]     = useState<WalletAdmin[]>([])
  const [loading,     setLoading]     = useState(true)
  const [refreshing,  setRefreshing]  = useState(false)
  const [onglet,      setOnglet]      = useState('overview')
  const [recherche,   setRecherche]   = useState('')
  const [error,       setError]       = useState('')
  const [success,     setSuccess]     = useState('')

  // Formulaires création
  const [formPartenaire, setFormPartenaire] = useState({
    entreprise:'', nom_contact:'', email:'', telephone:'', plan:'starter', adresse:''
  })
  const [formAdmin, setFormAdmin] = useState({ email:'', nom:'' })
  const [creating, setCreating] = useState(false)

  // Modal paiement coursier
  const [modalPaiement, setModalPaiement] = useState<{ coursier: CoursierAdmin | null; montant: string; description: string }>({
    coursier: null, montant: '', description: ''
  })

  // Accordion coursier documents
  const [openDoc, setOpenDoc] = useState<string | null>(null)

  // Stats comptées
  const stats = {
    partenaires_total:    partenaires.length,
    partenaires_actifs:   partenaires.filter(p => p.statut === 'actif').length,
    partenaires_attente:  partenaires.filter(p => p.statut === 'en_attente').length,
    coursiers_total:      coursiers.length,
    coursiers_verifies:   coursiers.filter(c => c.statut_verification === 'verifie').length,
    coursiers_attente:    coursiers.filter(c => c.statut_verification === 'en_attente').length,
    clients_total:        clients.length,
    clients_actifs:       clients.filter(c => c.est_actif).length,
    livraisons_total:     livraisons.length,
    ca_total:             livraisons.reduce((acc, l) => acc + (l.prix_final || 0), 0),
    wallets_total_solde:  wallets.reduce((acc, w) => acc + (w.solde || 0), 0),
  }

  // ── Auth & Chargement ──────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { router.replace('/admin-x9k2m/login'); return }
      const { data: u } = await supabase
        .from('utilisateurs').select('role,nom').eq('id', session.user.id).single()
      if (!u || u.role !== 'admin') {
        await supabase.auth.signOut(); router.replace('/admin-x9k2m/login'); return
      }
      setAdminUser({ ...session.user, nom: u.nom })
      loadData()
    })
  }, [router])

  const loadData = useCallback(async () => {
    setRefreshing(true)
    try {
      const [partsRes, coursRes, clientsRes, livsRes, walletsRes] = await Promise.all([
        // Partenaires
        supabase.from('partenaires').select('*').order('created_at', { ascending: false }),
        // Coursiers avec utilisateurs join
        supabase.from('coursiers')
          .select('*, utilisateurs(nom, email, telephone)')
          .order('created_at', { ascending: false }),
        // Clients (rôle = client)
        supabase.from('utilisateurs')
          .select('id, nom, email, telephone, est_actif, est_verifie, created_at')
          .eq('role', 'client')
          .order('created_at', { ascending: false })
          .limit(100),
        // Livraisons récentes
        supabase.from('livraisons')
          .select('*, client:utilisateurs!livraisons_client_id_fkey(nom), coursier:utilisateurs!livraisons_coursier_id_fkey(nom)')
          .order('created_at', { ascending: false })
          .limit(100),
        // Wallets avec utilisateurs
        supabase.from('wallets')
          .select('*, utilisateurs(nom, email, role)')
          .order('solde', { ascending: false })
          .limit(100),
      ])

      setPartenaires(partsRes.data || [])

      setCoursiers((coursRes.data || []).map((c: any) => ({
        ...c,
        nom:       c.utilisateurs?.nom       || 'N/A',
        email:     c.utilisateurs?.email     || 'N/A',
        telephone: c.utilisateurs?.telephone || 'N/A',
      })))

      setClients(clientsRes.data || [])

      setLivraisons((livsRes.data || []).map((l: any) => ({
        ...l,
        client_nom:   l.client?.nom   || 'Client inconnu',
        coursier_nom: l.coursier?.nom || 'Non assigné',
      })))

      setWallets(walletsRes.data || [])

    } catch (err: any) {
      setError('Erreur de chargement: ' + err.message)
    } finally {
      setLoading(false); setRefreshing(false)
    }
  }, [])

  // ── Actions partenaires ────────────────────────────────────────
  const updateStatutPartenaire = async (id: string, statut: string) => {
    setError(''); setSuccess('')
    const { error: err } = await supabase
      .from('partenaires').update({ statut, updated_at: new Date().toISOString() }).eq('id', id)
    if (err) setError(err.message)
    else { setSuccess(`Statut partenaire mis à jour : ${statut}`); loadData() }
  }

  // ── Actions coursiers ──────────────────────────────────────────
  const validerCoursier = async (id: string, statut: string) => {
    setError(''); setSuccess('')
    const { error: err } = await supabase
      .from('coursiers').update({ statut_verification: statut }).eq('id', id)
    if (err) setError(err.message)
    else { setSuccess(`Coursier ${statut === 'verifie' ? 'vérifié' : 'rejeté'} avec succès`); loadData() }
  }

  // ── Paiement coursier ──────────────────────────────────────────
  const payerCoursier = async () => {
    if (!modalPaiement.coursier || !modalPaiement.montant) return
    setCreating(true); setError('')
    try {
      const session = await supabase.auth.getSession()
      const token   = session.data.session?.access_token
      const res = await fetch('/api/admin/payer-coursier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          coursier_id: modalPaiement.coursier.id,
          montant:     parseFloat(modalPaiement.montant),
          description: modalPaiement.description || `Paiement admin — ${new Date().toLocaleDateString('fr-FR')}`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur paiement')
      setSuccess(`✅ Paiement de ${parseFloat(modalPaiement.montant).toLocaleString()} FCFA effectué pour ${modalPaiement.coursier.nom}`)
      setModalPaiement({ coursier: null, montant: '', description: '' })
      loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  // ── Actions clients ────────────────────────────────────────────
  const toggleClientActif = async (id: string, actif: boolean) => {
    setError(''); setSuccess('')
    const { error: err } = await supabase
      .from('utilisateurs').update({ est_actif: actif, updated_at: new Date().toISOString() }).eq('id', id)
    if (err) setError(err.message)
    else { setSuccess(`Client ${actif ? 'activé' : 'désactivé'}`); loadData() }
  }

  // ── Création partenaire ────────────────────────────────────────
  const handleCreatePartenaire = async (e: React.FormEvent) => {
    e.preventDefault(); setCreating(true); setError(''); setSuccess('')
    try {
      const session = await supabase.auth.getSession()
      const token   = session.data.session?.access_token
      const res = await fetch('/api/admin/create-partenaire', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formPartenaire),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur création')
      setSuccess(`✅ Partenaire créé et email envoyé !`)
      setFormPartenaire({ entreprise:'', nom_contact:'', email:'', telephone:'', plan:'starter', adresse:'' })
      loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  // ── Promotion admin ────────────────────────────────────────────
  const handlePromoteAdmin = async (e: React.FormEvent) => {
    e.preventDefault(); setCreating(true); setError(''); setSuccess('')
    try {
      const session = await supabase.auth.getSession()
      const token   = session.data.session?.access_token
      const res = await fetch('/api/admin/create-admin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(formAdmin),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur création admin')
      setSuccess(data.message || '✅ Admin créé avec succès')
      setFormAdmin({ email: '', nom: '' })
      loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  // ── Filtres ────────────────────────────────────────────────────
  const partsFiltered = partenaires.filter(p =>
    recherche === '' ||
    p.entreprise.toLowerCase().includes(recherche.toLowerCase()) ||
    p.nom_contact.toLowerCase().includes(recherche.toLowerCase()) ||
    (p.email_pro || '').toLowerCase().includes(recherche.toLowerCase())
  )

  const coursFiltered = coursiers.filter(c =>
    recherche === '' ||
    (c.nom || '').toLowerCase().includes(recherche.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(recherche.toLowerCase())
  )

  const clientsFiltered = clients.filter(c =>
    recherche === '' ||
    c.nom.toLowerCase().includes(recherche.toLowerCase()) ||
    c.email.toLowerCase().includes(recherche.toLowerCase())
  )

  // ── Render ─────────────────────────────────────────────────────
  if (loading) return (
    <div className="min-h-screen bg-[#F8FAFF] flex items-center justify-center">
      <Loader2 className="animate-spin text-[#0A2E8A]" size={40}/>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8FAFF]">
      {/* ── Navbar ── */}
      <nav className="bg-[#0A2E8A] text-white sticky top-0 z-50 shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#E87722] to-[#F59343] flex items-center justify-center">
              <Zap size={16} className="text-white" strokeWidth={2.5}/>
            </div>
            <span className="font-bold text-xl tracking-tight">NYME ADMIN</span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadData}
              className="p-2 hover:bg-white/10 rounded-full transition-colors"
              title="Rafraîchir">
              <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''}/>
            </button>
            <span className="text-sm text-white/70 hidden sm:block">{adminUser?.nom}</span>
            <button onClick={async () => { await supabase.auth.signOut(); router.replace('/admin-x9k2m/login') }}
              className="flex items-center gap-1.5 text-sm text-red-300 hover:text-red-100 transition-colors">
              <LogOut size={15}/> Quitter
            </button>
          </div>
        </div>
        {/* Onglets */}
        <div className="max-w-7xl mx-auto px-4 flex gap-1 overflow-x-auto scrollbar-hide">
          {ONGLETS.map(o => (
            <button key={o.id} onClick={() => { setOnglet(o.id); setRecherche('') }}
              className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                onglet === o.id ? 'border-[#E87722] text-[#E87722]' : 'border-transparent text-white/60 hover:text-white'
              }`}>
              <o.icon size={14}/> {o.label}
              {o.id === 'partenaires' && stats.partenaires_attente > 0 && (
                <span className="bg-amber-500 text-white text-[9px] rounded-full px-1.5 py-0.5 font-bold">
                  {stats.partenaires_attente}
                </span>
              )}
              {o.id === 'coursiers' && stats.coursiers_attente > 0 && (
                <span className="bg-amber-500 text-white text-[9px] rounded-full px-1.5 py-0.5 font-bold">
                  {stats.coursiers_attente}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* ── Main ── */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Alertes globales */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2"><AlertCircle size={16}/>{error}</div>
            <X size={16} className="cursor-pointer shrink-0" onClick={() => setError('')}/>
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2"><CheckCircle2 size={16}/>{success}</div>
            <X size={16} className="cursor-pointer shrink-0" onClick={() => setSuccess('')}/>
          </div>
        )}

        {/* ── VUE GÉNÉRALE ── */}
        {onglet === 'overview' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black text-[#0A2E8A]">Vue générale</h1>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label:'Partenaires',     value:stats.partenaires_total,    sub:`${stats.partenaires_actifs} actifs`, icon:Building2, color:'bg-blue-600' },
                { label:'Coursiers',       value:stats.coursiers_total,      sub:`${stats.coursiers_verifies} vérifiés`, icon:Truck,      color:'bg-orange-500' },
                { label:'Clients',         value:stats.clients_total,        sub:`${stats.clients_actifs} actifs`, icon:Users,      color:'bg-green-600' },
                { label:'Livraisons',      value:stats.livraisons_total,     sub:'Ce mois',  icon:Package,    color:'bg-purple-600' },
                { label:'CA Estimé (FCFA)',value:stats.ca_total.toLocaleString('fr-FR'), sub:'Total', icon:TrendingUp,  color:'bg-teal-600' },
                { label:'Soldes Wallets',  value:stats.wallets_total_solde.toLocaleString('fr-FR'), sub:'FCFA total', icon:Wallet,     color:'bg-indigo-600' },
                { label:'En attente',      value:stats.partenaires_attente,  sub:'Partenaires', icon:Clock,   color:'bg-amber-500' },
                { label:'Docs à vérifier', value:stats.coursiers_attente,    sub:'Coursiers', icon:FileCheck, color:'bg-rose-500' },
              ].map((card, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${card.color} text-white shrink-0`}>
                    <card.icon size={18}/>
                  </div>
                  <div>
                    <p className="text-slate-500 text-xs font-bold uppercase tracking-wide">{card.label}</p>
                    <p className="text-2xl font-black text-slate-800">{card.value}</p>
                    <p className="text-slate-400 text-xs">{card.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Partenaires en attente */}
            {stats.partenaires_attente > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <h3 className="text-amber-700 font-bold mb-3 flex items-center gap-2">
                  <AlertTriangle size={16}/> {stats.partenaires_attente} partenaire(s) en attente de validation
                </h3>
                <div className="space-y-2">
                  {partenaires.filter(p => p.statut === 'en_attente').slice(0, 5).map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{p.entreprise}</p>
                        <p className="text-slate-500 text-xs">{p.nom_contact} • {p.email_pro}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => updateStatutPartenaire(p.id, 'actif')}
                          className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold hover:bg-green-600 hover:text-white transition-all">
                          ✓ Valider
                        </button>
                        <button onClick={() => updateStatutPartenaire(p.id, 'rejete')}
                          className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-all">
                          ✗ Rejeter
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Coursiers à vérifier */}
            {stats.coursiers_attente > 0 && (
              <div className="bg-rose-50 border border-rose-200 rounded-2xl p-5">
                <h3 className="text-rose-700 font-bold mb-3 flex items-center gap-2">
                  <FileCheck size={16}/> {stats.coursiers_attente} coursier(s) avec documents à vérifier
                </h3>
                <div className="space-y-2">
                  {coursiers.filter(c => c.statut_verification === 'en_attente').slice(0, 5).map(c => (
                    <div key={c.id} className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{c.nom}</p>
                        <p className="text-slate-500 text-xs">{c.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => validerCoursier(c.id, 'verifie')}
                          className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold hover:bg-green-600 hover:text-white transition-all">
                          ✓ Vérifier
                        </button>
                        <button onClick={() => validerCoursier(c.id, 'rejete')}
                          className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-all">
                          ✗ Rejeter
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── PARTENAIRES ── */}
        {onglet === 'partenaires' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-[#0A2E8A]">Partenaires ({partenaires.length})</h2>
              <button onClick={() => setOnglet('creation')}
                className="flex items-center gap-2 px-4 py-2 bg-[#0A2E8A] text-white rounded-xl text-sm font-bold hover:bg-[#0d38a5] transition-all">
                <Plus size={16}/> Nouveau
              </button>
            </div>

            {/* Barre de recherche */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input type="text" placeholder="Rechercher..." value={recherche} onChange={e => setRecherche(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#0A2E8A] text-sm"/>
            </div>

            {/* Tableau partenaires */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[700px]">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Entreprise</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Contact</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Plan</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Statut</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Livraisons</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {partsFiltered.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-800 text-sm">{p.entreprise}</p>
                          <p className="text-xs text-slate-400">{p.email_pro}</p>
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-sm text-slate-700">{p.nom_contact}</p>
                          <p className="text-xs text-slate-400">{p.telephone || '—'}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2 py-1 rounded-full text-[11px] font-bold border ${PLAN_CFG[p.plan]?.color || ''}`}>
                            {PLAN_CFG[p.plan]?.label || p.plan}
                          </span>
                        </td>
                        <td className="px-5 py-4"><Badge statut={p.statut}/></td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-bold text-slate-700">{p.livraisons_mois}/{p.livraisons_max}</p>
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full mt-1">
                            <div className="h-full bg-[#0A2E8A] rounded-full"
                              style={{width:`${Math.min(100,(p.livraisons_mois/p.livraisons_max)*100)}%`}}/>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {p.statut !== 'actif' && (
                              <button onClick={() => updateStatutPartenaire(p.id, 'actif')}
                                className="px-2.5 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-600 hover:text-white transition-all flex items-center gap-1">
                                <UserCheck size={11}/> Activer
                              </button>
                            )}
                            {p.statut !== 'suspendu' && (
                              <button onClick={() => updateStatutPartenaire(p.id, 'suspendu')}
                                className="px-2.5 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-all flex items-center gap-1">
                                <Ban size={11}/> Suspendre
                              </button>
                            )}
                            {p.statut !== 'rejete' && (
                              <button onClick={() => updateStatutPartenaire(p.id, 'rejete')}
                                className="px-2.5 py-1.5 bg-gray-50 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-600 hover:text-white transition-all flex items-center gap-1">
                                <XCircle size={11}/> Rejeter
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {partsFiltered.length === 0 && (
                      <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-sm">Aucun partenaire trouvé</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── COURSIERS ── */}
        {onglet === 'coursiers' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-[#0A2E8A]">Coursiers ({coursiers.length})</h2>
              <div className="flex gap-2 text-xs">
                <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-bold">{stats.coursiers_verifies} vérifiés</span>
                <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full font-bold">{stats.coursiers_attente} en attente</span>
              </div>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input type="text" placeholder="Rechercher un coursier..." value={recherche} onChange={e => setRecherche(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#0A2E8A] text-sm"/>
            </div>

            <div className="space-y-3">
              {coursFiltered.map(c => (
                <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <User size={18} className="text-slate-500"/>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-slate-800">{c.nom}</p>
                          <Badge statut={c.statut_verification}/>
                          <Badge statut={c.statut}/>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{c.email} • {c.telephone}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {c.total_courses || 0} courses • Gains: {(c.total_gains || 0).toLocaleString('fr-FR')} FCFA
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                      {/* Documents */}
                      <button
                        onClick={() => setOpenDoc(openDoc === c.id ? null : c.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-blue-100 hover:text-blue-700 transition-all">
                        <Eye size={12}/>Docs
                        {openDoc === c.id ? <ChevronUp size={11}/> : <ChevronDown size={11}/>}
                      </button>
                      {/* Vérifier */}
                      <button onClick={() => validerCoursier(c.id, 'verifie')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-600 hover:text-white transition-all">
                        <ShieldCheck size={12}/>Vérifier
                      </button>
                      {/* Rejeter */}
                      <button onClick={() => validerCoursier(c.id, 'rejete')}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-all">
                        <XCircle size={12}/>Rejeter
                      </button>
                      {/* Payer */}
                      <button onClick={() => setModalPaiement({ coursier: c, montant: '', description: '' })}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A2E8A] text-white rounded-lg text-xs font-bold hover:bg-[#0d38a5] transition-all">
                        <Send size={12}/>Payer
                      </button>
                    </div>
                  </div>
                  {/* Documents accordion */}
                  {openDoc === c.id && (
                    <div className="border-t border-slate-100 p-5 bg-slate-50">
                      <h4 className="text-xs font-bold text-slate-600 uppercase mb-3">Documents soumis</h4>
                      <div className="flex flex-wrap gap-3">
                        {c.cni_recto_url && (
                          <a href={c.cni_recto_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all">
                            <FileCheck size={14}/> CNI Recto
                          </a>
                        )}
                        {c.cni_verso_url && (
                          <a href={c.cni_verso_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all">
                            <FileCheck size={14}/> CNI Verso
                          </a>
                        )}
                        {c.permis_url && (
                          <a href={c.permis_url} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-blue-600 hover:border-blue-400 hover:bg-blue-50 transition-all">
                            <FileCheck size={14}/> Permis de conduire
                          </a>
                        )}
                        {!c.cni_recto_url && !c.cni_verso_url && !c.permis_url && (
                          <p className="text-slate-400 text-xs italic">Aucun document soumis</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {coursFiltered.length === 0 && (
                <div className="bg-white rounded-2xl p-10 text-center text-slate-400 text-sm">Aucun coursier trouvé</div>
              )}
            </div>
          </div>
        )}

        {/* ── CLIENTS ── */}
        {onglet === 'clients' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-[#0A2E8A]">Clients ({clients.length})</h2>
              <div className="flex gap-2 text-xs">
                <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-bold">{stats.clients_actifs} actifs</span>
                <span className="px-2.5 py-1 bg-red-100 text-red-700 rounded-full font-bold">{clients.length - stats.clients_actifs} inactifs</span>
              </div>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input type="text" placeholder="Rechercher un client..." value={recherche} onChange={e => setRecherche(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#0A2E8A] text-sm"/>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Client</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Contact</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Statut</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Inscrit le</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {clientsFiltered.map(c => (
                      <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-800 text-sm">{c.nom}</p>
                          <p className="text-xs text-slate-400">{c.email}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{c.telephone || '—'}</td>
                        <td className="px-5 py-4">
                          <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                            c.est_actif
                              ? 'text-green-600 bg-green-50 border-green-200'
                              : 'text-red-600 bg-red-50 border-red-200'
                          }`}>
                            {c.est_actif ? '● Actif' : '● Inactif'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500">
                          {new Date(c.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => toggleClientActif(c.id, !c.est_actif)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              c.est_actif
                                ? 'bg-red-50 text-red-700 hover:bg-red-600 hover:text-white'
                                : 'bg-green-50 text-green-700 hover:bg-green-600 hover:text-white'
                            }`}>
                            {c.est_actif ? <><Ban size={11}/> Désactiver</> : <><UserCheck size={11}/> Activer</>}
                          </button>
                        </td>
                      </tr>
                    ))}
                    {clientsFiltered.length === 0 && (
                      <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm">Aucun client trouvé</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── LIVRAISONS ── */}
        {onglet === 'livraisons' && (
          <div className="space-y-5">
            <h2 className="text-xl font-black text-[#0A2E8A]">Courses récentes ({livraisons.length})</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[700px]">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Client</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Coursier</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Statut</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Prix (FCFA)</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {livraisons.map(l => (
                      <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-800 text-sm">{l.client_nom}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[200px]">{l.depart_adresse}</p>
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">{l.coursier_nom}</td>
                        <td className="px-5 py-4"><Badge statut={l.statut}/></td>
                        <td className="px-5 py-4 font-bold text-slate-700">
                          {l.prix_final ? l.prix_final.toLocaleString('fr-FR') : '—'}
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-500">
                          {new Date(l.created_at).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'2-digit' })}
                        </td>
                      </tr>
                    ))}
                    {livraisons.length === 0 && (
                      <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm">Aucune livraison</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── WALLET / FINANCES ── */}
        {onglet === 'wallet' && (
          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-[#0A2E8A]">Wallets & Finances</h2>
              <div className="text-sm font-bold text-[#0A2E8A]">
                Solde total : {stats.wallets_total_solde.toLocaleString('fr-FR')} FCFA
              </div>
            </div>

            {/* Résumé wallets */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label:'Total wallets',     value:wallets.length,                          icon:Wallet,         color:'bg-blue-600' },
                { label:'Solde total (FCFA)', value:stats.wallets_total_solde.toLocaleString('fr-FR'), icon:DollarSign,     color:'bg-green-600' },
                { label:'Wallets coursiers',  value:wallets.filter(w => w.utilisateur?.role === 'coursier').length, icon:Truck, color:'bg-orange-500' },
              ].map((c, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${c.color} text-white`}><c.icon size={20}/></div>
                  <div>
                    <p className="text-slate-500 text-xs font-bold uppercase">{c.label}</p>
                    <p className="text-xl font-black text-slate-800">{c.value}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Liste wallets */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[600px]">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Utilisateur</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Rôle</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Solde (FCFA)</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Total gains</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Total retraits</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {wallets.map(w => (
                      <tr key={w.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-800 text-sm">{w.utilisateur?.nom || 'N/A'}</p>
                          <p className="text-xs text-slate-400">{w.utilisateur?.email || '—'}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`px-2 py-1 rounded-full text-[11px] font-bold ${
                            w.utilisateur?.role === 'coursier' ? 'bg-orange-100 text-orange-700' :
                            w.utilisateur?.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {w.utilisateur?.role || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <span className={`font-black text-lg ${w.solde > 0 ? 'text-green-600' : 'text-slate-400'}`}>
                            {(w.solde || 0).toLocaleString('fr-FR')}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-slate-600 text-sm">
                          {(w.total_gains || 0).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-5 py-4 text-slate-600 text-sm">
                          {(w.total_retraits || 0).toLocaleString('fr-FR')}
                        </td>
                        <td className="px-5 py-4">
                          {w.utilisateur?.role === 'coursier' && (
                            <button
                              onClick={() => {
                                const coursier = coursiers.find(c => c.id === w.user_id)
                                if (coursier) setModalPaiement({ coursier, montant: '', description: '' })
                              }}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0A2E8A] text-white rounded-lg text-xs font-bold hover:bg-[#0d38a5] transition-all">
                              <Send size={11}/> Payer
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                    {wallets.length === 0 && (
                      <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-sm">Aucun wallet trouvé</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── ACTIONS ADMIN ── */}
        {onglet === 'creation' && (
          <div className="space-y-8">
            <h2 className="text-xl font-black text-[#0A2E8A]">Actions Administrateur</h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Créer partenaire */}
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-black mb-6 flex items-center gap-2 text-[#0A2E8A]">
                  <Building2 size={20}/> Nouveau Partenaire
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Crée un compte avec mot de passe auto-généré et envoie un email de bienvenue.
                </p>
                <form onSubmit={handleCreatePartenaire} className="space-y-3">
                  <input type="text" placeholder="Entreprise *" required
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#E87722] text-sm"
                    value={formPartenaire.entreprise} onChange={e => setFormPartenaire({...formPartenaire, entreprise: e.target.value})}/>
                  <input type="text" placeholder="Nom du contact *" required
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#E87722] text-sm"
                    value={formPartenaire.nom_contact} onChange={e => setFormPartenaire({...formPartenaire, nom_contact: e.target.value})}/>
                  <input type="email" placeholder="Email professionnel *" required
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#E87722] text-sm"
                    value={formPartenaire.email} onChange={e => setFormPartenaire({...formPartenaire, email: e.target.value})}/>
                  <input type="tel" placeholder="Téléphone"
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#E87722] text-sm"
                    value={formPartenaire.telephone} onChange={e => setFormPartenaire({...formPartenaire, telephone: e.target.value})}/>
                  <input type="text" placeholder="Adresse (optionnel)"
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#E87722] text-sm"
                    value={formPartenaire.adresse} onChange={e => setFormPartenaire({...formPartenaire, adresse: e.target.value})}/>
                  <select className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 text-sm"
                    value={formPartenaire.plan} onChange={e => setFormPartenaire({...formPartenaire, plan: e.target.value})}>
                    <option value="starter">Starter — 30 livraisons/mois</option>
                    <option value="business">Business — 100 livraisons/mois</option>
                    <option value="enterprise">Enterprise — Illimité</option>
                  </select>
                  <button type="submit" disabled={creating}
                    className="w-full py-3.5 bg-[#0A2E8A] text-white font-bold rounded-xl hover:bg-[#0d38a5] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {creating
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Création...</>
                      : <><Mail size={15}/> Créer et envoyer email</>}
                  </button>
                </form>
              </div>

              {/* Créer admin */}
              <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
                <h3 className="text-lg font-black mb-6 flex items-center gap-2 text-[#0A2E8A]">
                  <ShieldCheck size={20}/> Nouvel Administrateur
                </h3>
                <p className="text-xs text-slate-500 mb-4">
                  Crée un compte admin avec mot de passe auto-généré et envoie les credentials par email.
                </p>
                <form onSubmit={handlePromoteAdmin} className="space-y-3">
                  <input type="email" placeholder="Email du nouvel admin *" required
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#E87722] text-sm"
                    value={formAdmin.email} onChange={e => setFormAdmin({...formAdmin, email: e.target.value})}/>
                  <input type="text" placeholder="Nom complet *" required
                    className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 focus:outline-none focus:border-[#E87722] text-sm"
                    value={formAdmin.nom} onChange={e => setFormAdmin({...formAdmin, nom: e.target.value})}/>
                  <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-700">
                    ℹ️ Un mot de passe temporaire sera auto-généré et envoyé par email.
                  </div>
                  <button type="submit" disabled={creating}
                    className="w-full py-3.5 bg-[#E87722] text-white font-bold rounded-xl hover:bg-[#f59343] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {creating
                      ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Création...</>
                      : <><ShieldCheck size={15}/> Créer compte admin</>}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Modal Paiement Coursier ── */}
      {modalPaiement.coursier && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-black text-[#0A2E8A] flex items-center gap-2">
                <CreditCard size={20}/> Payer {modalPaiement.coursier.nom}
              </h3>
              <button onClick={() => setModalPaiement({ coursier: null, montant: '', description: '' })}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                <X size={18}/>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Montant (FCFA) *</label>
                <div className="relative">
                  <DollarSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                  <input type="number" min="100" step="100" placeholder="Ex: 5000"
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0A2E8A] text-sm"
                    value={modalPaiement.montant}
                    onChange={e => setModalPaiement({...modalPaiement, montant: e.target.value})}/>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Description (optionnel)</label>
                <input type="text" placeholder="Ex: Paiement semaine du 01/04"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 focus:outline-none focus:border-[#0A2E8A] text-sm"
                  value={modalPaiement.description}
                  onChange={e => setModalPaiement({...modalPaiement, description: e.target.value})}/>
              </div>
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
                ⚠️ Cette action créditera le wallet du coursier de <strong>{parseFloat(modalPaiement.montant || '0').toLocaleString('fr-FR')} FCFA</strong>.
              </div>
              <div className="flex gap-3">
                <button onClick={() => setModalPaiement({ coursier: null, montant: '', description: '' })}
                  className="flex-1 py-3 bg-slate-100 text-slate-700 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm">
                  Annuler
                </button>
                <button onClick={payerCoursier} disabled={creating || !modalPaiement.montant}
                  className="flex-1 py-3 bg-[#0A2E8A] text-white rounded-xl font-bold hover:bg-[#0d38a5] transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2">
                  {creating
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Traitement...</>
                    : <><ArrowDownLeft size={15}/> Confirmer paiement</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
