// src/app/partenaires/dashboard/page.tsx — Dashboard partenaire NYME v3
// ✅ Vrais prix (25k/65k/devis) | ✅ Abonnement mensuel wallet | ✅ Pas de commission UI
// ✅ Carte temps réel | ✅ Design app livraison production-grade
'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import type { PartenaireRow, LivraisonPartenaire as LivraisonPartenaireRow } from '@/lib/supabase'
import {
  Package, Clock, CheckCircle, Zap, LogOut,
  Bell, RefreshCw, MapPin, AlertCircle,
  Calendar, Phone, Wallet, BarChart3, ShieldCheck, Plus,
  FileText, X, Search, Star, CreditCard, Settings,
  Map, UserPlus, BookOpen, Edit2, Trash2, ArrowUpRight,
  Navigation, Bike, Circle,
} from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

const MapAdvanced = dynamic(() => import('@/components/MapAdvanced'), { ssr: false })

// ── Types ──────────────────────────────────────────────────────────

interface Contact {
  id: string
  nom: string
  telephone: string
  whatsapp?: string
  adresse_habituelle?: string
}

interface CoursierActif {
  id: string
  nom: string
  note_moyenne: number
  total_courses: number
  statut: string
  lat_actuelle: number | null
  lng_actuelle: number | null
}

// ✅ FIX DÉFINITIF : Map déclaré au niveau MODULE (hors composant)
// tsconfig strict=true interdit new Map() sans argument dans un composant React
// car TypeScript ne peut pas inférer Map<string, CoursierPos> depuis new Map()
// Solution : déclarer le type et l'instance au niveau module où l'inférence fonctionne
interface CoursierPos { lat: number; lng: number }
const _coursierPositionsMap = new Map<string, CoursierPos>()

// ── Config plans ──────────────────────────────────────────────────

const PLAN_CFG = {
  starter: {
    label: 'Starter',
    emoji: '🟢',
    color: 'from-emerald-500 to-green-600',
    badge: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    max: 40,
    prix: 45000,
    delai: '45 min',
    features: ['40 livraisons/mois', 'Livreur dédié', 'Livraison sous 45 min', 'Suivi GPS', 'Dashboard', 'Support email'],
  },
  business: {
    label: 'Business',
    emoji: '⭐',
    color: 'from-orange-500 to-amber-500',
    badge: 'bg-orange-100 text-orange-700 border-orange-200',
    max: 100,
    prix: 90000,
    delai: '30 min',
    features: ['100 livraisons/mois', 'Livreur dédié quotidien', 'Express sous 30 min', 'Traçabilité photos', 'WhatsApp Business', 'Support 7j/7'],
  },
  enterprise: {
    label: 'Enterprise',
    emoji: '🏢',
    color: 'from-violet-600 to-purple-700',
    badge: 'bg-violet-100 text-violet-700 border-violet-200',
    max: 9999,
    prix: 0,
    delai: 'Express',
    features: ['Livraisons illimitées', 'Équipe de livreurs', 'API sur mesure', 'Multi-utilisateurs', 'SLA garanti', 'Support 24h/24'],
  },
}

const STATUT_CFG: Record<string, { label: string; color: string; bg: string; dot: string; icon: string }> = {
  en_attente: { label: 'En attente',   color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',  dot: 'bg-amber-400',  icon: '⏳' },
  en_cours:   { label: 'En livraison', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',    dot: 'bg-blue-500',   icon: '🚴' },
  livre:      { label: 'Livré',        color: 'text-green-700',  bg: 'bg-green-50 border-green-200',  dot: 'bg-green-500',  icon: '✅' },
  annule:     { label: 'Annulé',       color: 'text-red-700',    bg: 'bg-red-50 border-red-200',      dot: 'bg-red-400',    icon: '❌' },
}

const TABS = [
  { id: 'dashboard',  label: 'Accueil',    icon: BarChart3 },
  { id: 'livraisons', label: 'Livraisons', icon: Package },
  { id: 'planifier',  label: 'Planifier',  icon: Calendar },
  { id: 'contacts',   label: 'Contacts',   icon: BookOpen },
  { id: 'carte',      label: 'Carte',      icon: Map },
  { id: 'wallet',     label: 'Wallet',     icon: Wallet },
  { id: 'compte',     label: 'Compte',     icon: Settings },
]

// ── Utilitaires ────────────────────────────────────────────────────

const fXOF = (n: number) =>
  n === 0 ? 'Sur devis' : new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'

const fDate = (d: string) =>
  new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d))

function Badge({ statut }: { statut: string }) {
  const s = STATUT_CFG[statut] || STATUT_CFG.en_attente
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${s.bg} ${s.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${statut === 'en_cours' ? 'animate-pulse' : ''}`} />
      {s.label}
    </span>
  )
}

function MiniSparkline({ data, color = '#3b82f6' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null
  const max = Math.max(...data) || 1
  const w = 80, h = 32
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - (v / max) * h}`).join(' ')
  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={pts} />
    </svg>
  )
}

// ── Page principale ────────────────────────────────────────────────

export default function PartenaireDashboard() {
  const router = useRouter()

  const [userId,       setUserId]       = useState<string | null>(null)
  const [partenaire,   setPartenaire]   = useState<PartenaireRow | null>(null)
  const [livraisons,   setLivraisons]   = useState<LivraisonPartenaireRow[]>([])
  const [contacts,     setContacts]     = useState<Contact[]>([])
  const [coursiers,    setCoursiers]    = useState<CoursierActif[]>([])
  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [tab,          setTab]          = useState('dashboard')
  const [recherche,    setRecherche]    = useState('')
  const [filtreStatut, setFiltreStatut] = useState('tous')
  const [detail,       setDetail]       = useState<LivraisonPartenaireRow | null>(null)
  const [alertes,      setAlertes]      = useState<string[]>([])
  const [soldeWallet,  setSoldeWallet]  = useState(0)
  const [txWallet,     setTxWallet]     = useState<any[]>([])
  const [coursierFavori, setCoursierFavori] = useState<CoursierActif | null>(null)

  // ✅ FIX : useRef pointe vers l'instance module-level — aucun generic nécessaire
  const coursierPositionsRef = useRef(_coursierPositionsMap)

  const [editingProfil,  setEditingProfil]  = useState(false)
  const [profilForm,     setProfilForm]     = useState({ entreprise: '', nom_contact: '', telephone: '', email_pro: '', adresse: '' })
  const [savingProfil,   setSavingProfil]   = useState(false)
  const [showNotifPanel, setShowNotifPanel] = useState(false)

  const [showForm,    setShowForm]    = useState(false)
  const [formLivr,    setFormLivr]    = useState({
    adresse_depart: '', lat_depart: 0, lng_depart: 0,
    adresse_arrivee: '', lat_arrivee: 0, lng_arrivee: 0,
    destinataire_nom: '', destinataire_tel: '', destinataire_whatsapp: '',
    instructions: '', date_programmee: '', heure: '09:00', contact_id: '',
  })
  const [submittingLivr, setSubmittingLivr] = useState(false)

  const [showContactForm, setShowContactForm] = useState(false)
  const [editContact,     setEditContact]     = useState<Contact | null>(null)
  const [contactForm,     setContactForm]     = useState({ nom: '', telephone: '', whatsapp: '', adresse_habituelle: '' })
  const [savingContact,   setSavingContact]   = useState(false)

  const refreshCoursierPositions = useCallback(async () => {
    try {
      const { data: posData } = await supabase
        .from('localisation_coursier')
        .select('coursier_id, lat, lng, statut, vitesse, direction, updated_at')
        .in('statut', ['disponible', 'occupe'])
      if (posData && posData.length > 0) {
        posData.forEach((p: { coursier_id: string; lat: number; lng: number }) => {
          coursierPositionsRef.current.set(p.coursier_id, { lat: p.lat, lng: p.lng })
        })
        setCoursiers(prev => prev.map(c => {
          const pos = coursierPositionsRef.current.get(c.id)
          if (pos) return { ...c, lat_actuelle: pos.lat, lng_actuelle: pos.lng }
          return c
        }))
      }
    } catch (posErr) {
      console.debug('[dashboard partenaire] Positions refresh:', posErr)
    }
  }, [])

  const loadData = useCallback(async (uid: string) => {
    try {
      const { data: part, error: partErr } = await supabase
        .from('partenaires').select('*').eq('user_id', uid).single()
      if (partErr || !part) {
        toast.error('Profil partenaire introuvable')
        router.replace('/partenaires/login')
        return
      }
      setPartenaire(part)
      setProfilForm({
        entreprise:  part.entreprise  || '',
        nom_contact: part.nom_contact || '',
        telephone:   part.telephone   || '',
        email_pro:   part.email_pro   || '',
        adresse:     (part as any).adresse || '',
      })

      const { data: livs } = await supabase
        .from('livraisons_partenaire')
        .select(`*, coursier:coursier_id(id, nom, note_moyenne)`)
        .eq('partenaire_id', part.id)
        .order('created_at', { ascending: false })
        .limit(200)
      const livsData = (livs || []) as LivraisonPartenaireRow[]
      setLivraisons(livsData)

      const { data: ctData } = await supabase
        .from('contacts_favoris').select('*').eq('user_id', uid).order('nom')
      setContacts((ctData || []) as Contact[])

      const { data: cData } = await supabase
        .from('coursiers')
        .select('id, statut, lat_actuelle, lng_actuelle, total_courses, note_moyenne')
        .in('statut', ['disponible', 'occupe'])
      if (cData) {
        const ids = cData.map((c: any) => c.id)
        const { data: uData } = await supabase.from('utilisateurs').select('id, nom').in('id', ids)
        const enriched: CoursierActif[] = cData.map((c: any) => ({
          ...c, nom: uData?.find((u: any) => u.id === c.id)?.nom || 'Coursier',
        }))
        setCoursiers(enriched)
        const counts: Record<string, number> = {}
        livsData.filter(l => l.statut === 'livre' && l.coursier_id).forEach(l => {
          if (l.coursier_id) counts[l.coursier_id] = (counts[l.coursier_id] || 0) + 1
        })
        const topId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]
        if (topId) setCoursierFavori(enriched.find(c => c.id === topId) || null)
      }

      const { data: w } = await supabase.from('wallets').select('solde').eq('user_id', uid).single()
      setSoldeWallet(w?.solde || 0)
      const { data: txs } = await supabase.from('transactions_wallet')
        .select('type, montant, note, created_at').eq('user_id', uid)
        .order('created_at', { ascending: false }).limit(30)
      setTxWallet(txs || [])

      const a: string[] = []
      if (part.livraisons_mois >= part.livraisons_max)
        a.push(`Quota atteint : ${part.livraisons_mois}/${part.livraisons_max}`)
      else if (part.livraisons_mois / part.livraisons_max >= 0.8)
        a.push(`${Math.round(part.livraisons_mois / part.livraisons_max * 100)}% du quota utilisé ce mois`)
      if (part.statut === 'en_attente') a.push('Compte en cours de validation — réponse sous 4h')
      if (part.statut === 'suspendu')   a.push('⚠️ Compte suspendu — contactez NYME immédiatement')
      setAlertes(a)
    } catch (err) {
      console.error('[PartenaireDashboard]', err)
      toast.error('Erreur de chargement')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [router])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/partenaires/login'); return }
      const { data: user } = await supabase.from('utilisateurs').select('role').eq('id', session.user.id).single()
      if (!user || user.role !== 'partenaire') {
        toast.error('Accès réservé aux partenaires')
        await supabase.auth.signOut()
        router.replace('/partenaires/login')
        return
      }
      setUserId(session.user.id)
      await loadData(session.user.id)

      const channelLivraisons = supabase.channel('partenaire-rt-livraisons')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'livraisons_partenaire' }, () => {
          if (session.user.id) loadData(session.user.id)
        }).subscribe()

      const channelPositions = supabase.channel('partenaire-rt-positions')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'localisation_coursier' }, (payload) => {
          const record = payload.new as { coursier_id?: string; lat?: number; lng?: number; statut?: string }
          if (record?.coursier_id && record?.lat && record?.lng) {
            coursierPositionsRef.current.set(record.coursier_id, { lat: record.lat, lng: record.lng })
            setCoursiers(prev => prev.map(c =>
              c.id === record.coursier_id
                ? { ...c, lat_actuelle: record.lat!, lng_actuelle: record.lng!, statut: record.statut || c.statut }
                : c
            ))
          }
        }).subscribe()

      const pollingInterval = setInterval(refreshCoursierPositions, 5000)

      const { data: auth } = supabase.auth.onAuthStateChange(ev => {
        if (ev === 'SIGNED_OUT') router.replace('/partenaires/login')
      })
      return () => {
        supabase.removeChannel(channelLivraisons)
        supabase.removeChannel(channelPositions)
        clearInterval(pollingInterval)
        auth.subscription.unsubscribe()
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleCreateLivraison = async () => {
    if (!partenaire) return
    if (!formLivr.adresse_depart || !formLivr.adresse_arrivee || !formLivr.destinataire_nom || !formLivr.destinataire_tel) {
      toast.error('Remplissez les champs obligatoires'); return
    }
    if (partenaire.livraisons_mois >= partenaire.livraisons_max) {
      toast.error(`Quota mensuel atteint (${partenaire.livraisons_max}). Contactez NYME pour upgrader.`); return
    }
    setSubmittingLivr(true)
    try {
      const { error } = await supabase.from('livraisons_partenaire').insert({
        partenaire_id:    partenaire.id,
        adresse_depart:   formLivr.adresse_depart,
        adresse_arrivee:  formLivr.adresse_arrivee,
        lat_depart:       formLivr.lat_depart  || null,
        lng_depart:       formLivr.lng_depart  || null,
        lat_arrivee:      formLivr.lat_arrivee || null,
        lng_arrivee:      formLivr.lng_arrivee || null,
        destinataire_nom: formLivr.destinataire_nom,
        destinataire_tel: formLivr.destinataire_tel,
        instructions:     formLivr.instructions || null,
        statut:           'en_attente',
      })
      if (error) throw error
      toast.success('✅ Livraison créée ! Votre livreur dédié est en route.')
      setShowForm(false)
      setFormLivr({ adresse_depart: '', lat_depart: 0, lng_depart: 0, adresse_arrivee: '', lat_arrivee: 0, lng_arrivee: 0, destinataire_nom: '', destinataire_tel: '', destinataire_whatsapp: '', instructions: '', date_programmee: '', heure: '09:00', contact_id: '' })
      if (userId) loadData(userId)
    } catch (err: any) {
      toast.error(err.message || 'Erreur lors de la création')
    } finally { setSubmittingLivr(false) }
  }

  const selectContact = (contact: Contact) => {
    setFormLivr(p => ({
      ...p,
      destinataire_nom:       contact.nom,
      destinataire_tel:       contact.telephone,
      destinataire_whatsapp:  contact.whatsapp || '',
      adresse_arrivee:        contact.adresse_habituelle || p.adresse_arrivee,
    }))
    toast.success(`👤 ${contact.nom} sélectionné`)
  }

  const handleSaveContact = async () => {
    if (!userId) return
    if (!contactForm.nom || !contactForm.telephone) { toast.error('Nom et téléphone requis'); return }
    setSavingContact(true)
    try {
      if (editContact) {
        const { error } = await supabase.from('contacts_favoris').update({
          nom:       contactForm.nom,
          telephone: contactForm.telephone,
          whatsapp:  contactForm.whatsapp || null,
          email:     contactForm.adresse_habituelle || null,
        }).eq('id', editContact.id)
        if (error) throw error
        toast.success('Contact modifié')
      } else {
        const { error } = await supabase.from('contacts_favoris').insert({
          user_id:   userId,
          nom:       contactForm.nom,
          telephone: contactForm.telephone,
          whatsapp:  contactForm.whatsapp || null,
          email:     contactForm.adresse_habituelle || null,
        })
        if (error) throw error
        toast.success('Contact ajouté')
      }
      setShowContactForm(false); setEditContact(null)
      setContactForm({ nom: '', telephone: '', whatsapp: '', adresse_habituelle: '' })
      if (userId) loadData(userId)
    } catch (err: any) { toast.error(err.message || 'Erreur') }
    finally { setSavingContact(false) }
  }

  const handleDeleteContact = async (id: string) => {
    if (!confirm('Supprimer ce contact ?')) return
    await supabase.from('contacts_favoris').delete().eq('id', id)
    setContacts(p => p.filter(c => c.id !== id))
    toast.success('Contact supprimé')
  }

  const handlePaiementAbonnement = async () => {
    if (!partenaire || !userId) return
    const plan = PLAN_CFG[partenaire.plan as keyof typeof PLAN_CFG]
    if (plan.prix === 0) { toast('Contactez NYME pour renouveler votre plan Enterprise', { icon: '📞' }); return }
    if (soldeWallet < plan.prix) {
      toast.error(`Solde insuffisant — rechargez votre wallet (manque ${fXOF(plan.prix - soldeWallet)})`); return
    }
    try {
      const { error } = await supabase.rpc('process_wallet_transaction', {
        p_user_id:   userId,
        p_type:      'paiement_course',
        p_montant:   -plan.prix,
        p_reference: `ABO_${partenaire.id}_${Date.now()}`,
        p_note:      `Abonnement ${plan.label} — ${new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
      })
      if (error) throw error
      toast.success(`✅ Abonnement ${plan.label} renouvelé pour ce mois !`)
      if (userId) loadData(userId)
    } catch { toast.error('Erreur paiement — réessayez ou contactez NYME') }
  }

  const handleSaveProfil = async () => {
    if (!partenaire) return
    setSavingProfil(true)
    try {
      const { error } = await supabase.from('partenaires').update({
        entreprise:  profilForm.entreprise,
        nom_contact: profilForm.nom_contact,
        telephone:   profilForm.telephone,
        email_pro:   profilForm.email_pro,
        adresse:     profilForm.adresse,
      }).eq('id', partenaire.id)
      if (error) throw error
      setPartenaire(p => p ? { ...p, ...profilForm } : null)
      setEditingProfil(false)
      toast.success('Profil mis à jour !')
    } catch { toast.error('Erreur mise à jour') }
    finally { setSavingProfil(false) }
  }

  const exportCSV = () => {
    const rows = [
      ['ID', 'Date', 'Départ', 'Arrivée', 'Destinataire', 'Téléphone', 'Statut', 'Prix (FCFA)'],
      ...livraisons.map(l => [
        l.id.slice(0, 8), new Date(l.created_at).toLocaleDateString('fr-FR'),
        l.adresse_depart, l.adresse_arrivee,
        l.destinataire_nom || '', l.destinataire_tel || '',
        STATUT_CFG[l.statut]?.label || l.statut, l.prix || 0,
      ])
    ].map(r => r.join(';')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\ufeff' + rows], { type: 'text/csv;charset=utf-8;' }))
    a.download = `nyme-livraisons-${new Date().toLocaleDateString('fr-FR').replace(/\//g, '-')}.csv`
    a.click()
  }

  const stats = {
    total:     livraisons.length,
    livrees:   livraisons.filter(l => l.statut === 'livre').length,
    enCours:   livraisons.filter(l => l.statut === 'en_cours').length,
    enAttente: livraisons.filter(l => l.statut === 'en_attente').length,
    depenses:  livraisons.filter(l => l.statut === 'livre').reduce((s, l) => s + (l.prix || 0), 0),
    txSucces:  livraisons.length > 0 ? Math.round(livraisons.filter(l => l.statut === 'livre').length / livraisons.length * 100) : 0,
  }

  const spark7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    return livraisons.filter(l => l.created_at.startsWith(d.toISOString().split('T')[0])).length
  })

  const progression = partenaire
    ? Math.min(100, Math.round(partenaire.livraisons_mois / partenaire.livraisons_max * 100))
    : 0

  const livraisonsFiltrees = livraisons.filter(l => {
    const matchStatut = filtreStatut === 'tous' || l.statut === filtreStatut
    const q = recherche.toLowerCase()
    const matchRech = !q
      || l.adresse_depart.toLowerCase().includes(q)
      || l.adresse_arrivee.toLowerCase().includes(q)
      || (l.destinataire_nom || '').toLowerCase().includes(q)
      || (l.destinataire_tel || '').includes(q)
    return matchStatut && matchRech
  })

  const inp = 'w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all bg-white placeholder-gray-400'
  const plan = partenaire ? PLAN_CFG[partenaire.plan as keyof typeof PLAN_CFG] : null

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f7f5] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="relative w-16 h-16 mx-auto">
            <div className="w-16 h-16 border-4 border-orange-100 border-t-orange-500 rounded-full animate-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <Bike size={20} className="text-orange-500" />
            </div>
          </div>
          <p className="text-gray-500 text-sm font-medium">Chargement de votre espace…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f7f5] font-sans">

      {/* ── HEADER ── */}
      <nav className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-sm shadow-orange-200">
              <Zap size={15} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-black text-gray-900 tracking-tight text-sm">NYME</span>
            <span className="text-gray-300 text-xs hidden sm:block">/ Partenaires</span>
          </Link>

          <div className="flex items-center gap-1.5">
            {alertes.length > 0 && (
              <button onClick={() => setShowNotifPanel(!showNotifPanel)}
                className="relative p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                <Bell size={16} />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] flex items-center justify-center font-black">
                  {alertes.length}
                </span>
              </button>
            )}
            <button onClick={() => { if (userId) { setRefreshing(true); loadData(userId) } }} disabled={refreshing}
              className="p-2 rounded-lg text-gray-400 hover:bg-gray-100 transition-colors">
              <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-100">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-[10px] font-black">
                {partenaire?.nom_contact?.charAt(0) || '?'}
              </div>
              <span className="text-gray-700 text-xs font-semibold truncate max-w-[100px]">
                {partenaire?.nom_contact?.split(' ')[0]}
              </span>
              {plan && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border ${plan.badge}`}>
                  {plan.emoji}
                </span>
              )}
            </div>
            <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/partenaires/login' }}
              className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors">
              <LogOut size={15} />
            </button>
          </div>
        </div>

        {showNotifPanel && alertes.length > 0 && (
          <div className="absolute top-14 right-4 w-80 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
            {alertes.map((a, i) => (
              <div key={i} className="p-4 flex items-start gap-3 border-b border-gray-50 last:border-0">
                <AlertCircle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                <p className="text-gray-700 text-xs leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        )}

        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex overflow-x-auto gap-0 border-t border-gray-50 scrollbar-hide">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${tab === t.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-200'}`}>
              <t.icon size={12} />{t.label}
              {t.id === 'livraisons' && stats.enCours > 0 && (
                <span className="w-4 h-4 bg-orange-500 text-white text-[9px] font-black rounded-full flex items-center justify-center">
                  {stats.enCours}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 space-y-4">

        {alertes.map((a, i) => (
          <div key={i} className={`p-3.5 rounded-2xl border flex items-center gap-3 text-sm ${a.includes('suspendu') ? 'bg-red-50 border-red-200 text-red-700' : a.includes('validation') ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
            <AlertCircle size={15} className="shrink-0" />
            <span className="flex-1 font-medium text-xs">{a}</span>
            {a.includes('Quota') && (
              <a href="mailto:nyme.contact@gmail.com" className="text-xs font-black underline">Upgrader →</a>
            )}
          </div>
        ))}

        {/* ════════════ DASHBOARD ════════════ */}
        {tab === 'dashboard' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-xl font-black text-gray-900">
                  Bonjour, {partenaire?.nom_contact?.split(' ')[0]} 👋
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <p className="text-gray-500 text-sm font-medium">{partenaire?.entreprise}</p>
                  {plan && (
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-black border ${plan.badge}`}>
                      {plan.emoji} {plan.label}
                    </span>
                  )}
                  <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold border ${partenaire?.statut === 'actif' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}>
                    {partenaire?.statut === 'actif' ? '● Actif' : '⏳ En attente'}
                  </span>
                </div>
              </div>
              <button onClick={() => { setTab('planifier'); setShowForm(true) }}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-bold rounded-xl shadow-sm shadow-orange-200 transition-all whitespace-nowrap">
                <Plus size={14} />Nouvelle livraison
              </button>
            </div>

            {partenaire && plan && (
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">Quota mensuel</p>
                    <p className="text-gray-400 text-xs mt-0.5">{partenaire.livraisons_max - partenaire.livraisons_mois} livraisons restantes</p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black text-gray-900">{partenaire.livraisons_mois}</span>
                    <span className="text-gray-400 text-sm"> / {partenaire.livraisons_max}</span>
                  </div>
                </div>
                <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-700 ${progression >= 100 ? 'bg-red-500' : progression >= 80 ? 'bg-amber-400' : 'bg-gradient-to-r from-orange-400 to-orange-500'}`}
                    style={{ width: `${progression}%` }} />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-gray-300 text-xs">0</span>
                  <span className={`text-xs font-bold ${progression >= 80 ? 'text-amber-600' : 'text-gray-400'}`}>{progression}%</span>
                  <span className="text-gray-300 text-xs">{partenaire.livraisons_max}</span>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { icon: Package,     label: 'Total',        value: stats.total,     sub: '7 jours',                       color: 'bg-blue-500',   spark: spark7, sparkColor: '#3b82f6' },
                { icon: CheckCircle, label: 'Livrées',      value: stats.livrees,   sub: `${stats.txSucces}% succès`,     color: 'bg-green-500',  spark: null,   sparkColor: '#22c55e' },
                { icon: Bike,        label: 'En livraison', value: stats.enCours,   sub: 'maintenant',                    color: stats.enCours > 0 ? 'bg-orange-500' : 'bg-gray-400', spark: null, sparkColor: '#f97316' },
                { icon: Clock,       label: 'En attente',   value: stats.enAttente, sub: 'à traiter',                     color: 'bg-violet-500', spark: null,   sparkColor: '#8b5cf6' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col gap-3">
                  <div className="flex items-start justify-between">
                    <div className={`w-9 h-9 ${s.color} rounded-xl flex items-center justify-center shrink-0`}>
                      <s.icon size={16} className="text-white" />
                    </div>
                    {s.spark && <MiniSparkline data={s.spark} color={s.sparkColor} />}
                  </div>
                  <div>
                    <p className="text-2xl font-black text-gray-900">{s.value}</p>
                    <p className="text-gray-400 text-xs mt-0.5">{s.label}</p>
                    <p className="text-gray-300 text-[10px]">{s.sub}</p>
                  </div>
                </div>
              ))}
            </div>

            {stats.enCours > 0 && (
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 rounded-2xl p-4 text-white">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <p className="font-black text-sm">{stats.enCours} livraison{stats.enCours > 1 ? 's' : ''} en cours</p>
                  </div>
                  <button onClick={() => setTab('carte')} className="text-xs text-white/80 font-semibold flex items-center gap-1 hover:text-white">
                    <Navigation size={11} />Voir carte
                  </button>
                </div>
                <div className="space-y-2">
                  {livraisons.filter(l => l.statut === 'en_cours').slice(0, 2).map(l => (
                    <div key={l.id} onClick={() => setDetail(l)}
                      className="bg-white/15 rounded-xl p-3 flex items-center gap-3 cursor-pointer hover:bg-white/25 transition-colors">
                      <Bike size={14} className="text-white/80 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-xs font-semibold truncate">{l.adresse_arrivee}</p>
                        <p className="text-white/60 text-[10px]">Pour {l.destinataire_nom || '—'}</p>
                      </div>
                      <ArrowUpRight size={12} className="text-white/60 shrink-0" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {coursierFavori && (
              <div className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-sm">
                  {coursierFavori.nom.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-black text-gray-900 text-sm">{coursierFavori.nom}</p>
                    <span className="bg-amber-100 text-amber-700 text-[10px] px-2 py-0.5 rounded-full font-bold border border-amber-200 flex items-center gap-1">
                      <Star size={8} fill="currentColor" />Mon livreur
                    </span>
                  </div>
                  <p className="text-gray-400 text-xs mt-0.5">
                    {livraisons.filter(l => l.coursier_id === coursierFavori.id && l.statut === 'livre').length} livraisons
                    {coursierFavori.note_moyenne ? ` · ⭐ ${coursierFavori.note_moyenne.toFixed(1)}/5` : ''}
                  </p>
                </div>
                <div className={`text-[11px] px-3 py-1.5 rounded-full font-bold flex items-center gap-1 ${coursierFavori.statut === 'disponible' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                  <Circle size={6} fill="currentColor" />
                  {coursierFavori.statut === 'disponible' ? 'Disponible' : 'En course'}
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-50 flex items-center justify-between">
                <h2 className="font-black text-gray-900 text-sm">Livraisons récentes</h2>
                <button onClick={() => setTab('livraisons')} className="text-orange-600 text-xs font-bold hover:underline flex items-center gap-1">
                  Tout voir <ArrowUpRight size={11} />
                </button>
              </div>
              {livraisons.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <Package size={24} className="text-gray-200" />
                  </div>
                  <p className="text-gray-500 text-sm mb-4">Aucune livraison pour l&apos;instant.</p>
                  <button onClick={() => { setTab('planifier'); setShowForm(true) }}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-xl hover:bg-orange-600">
                    <Plus size={13} />Créer ma première livraison
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {livraisons.slice(0, 6).map(l => (
                    <div key={l.id} onClick={() => setDetail(l)}
                      className="p-4 flex items-start gap-3 hover:bg-gray-50 cursor-pointer transition-colors">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-sm ${l.statut === 'en_cours' ? 'bg-orange-100' : l.statut === 'livre' ? 'bg-green-100' : 'bg-gray-100'}`}>
                        {STATUT_CFG[l.statut]?.icon || '📦'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-xs truncate">{l.adresse_depart}</p>
                            <p className="text-gray-400 text-xs truncate">→ {l.adresse_arrivee}</p>
                          </div>
                          <Badge statut={l.statut} />
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                          <span>{fDate(l.created_at)}</span>
                          {l.destinataire_nom && <span>· {l.destinataire_nom}</span>}
                          {l.prix && <span className="text-orange-600 font-bold">{fXOF(l.prix)}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ════════════ LIVRAISONS ════════════ */}
        {tab === 'livraisons' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-900">
                Livraisons <span className="text-gray-300 font-normal text-sm">({livraisons.length})</span>
              </h2>
              <button onClick={() => { setTab('planifier'); setShowForm(true) }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-xl hover:bg-orange-600">
                <Plus size={13} />Nouvelle
              </button>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input placeholder="Adresse, destinataire, téléphone…" value={recherche}
                  onChange={e => setRecherche(e.target.value)} className={`${inp} pl-10`} />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {['tous', 'en_attente', 'en_cours', 'livre', 'annule'].map(s => (
                  <button key={s} onClick={() => setFiltreStatut(s)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${filtreStatut === s ? 'bg-orange-500 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                    {s === 'tous' ? 'Tous' : STATUT_CFG[s]?.label || s}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              {livraisonsFiltrees.length === 0 ? (
                <div className="p-12 text-center">
                  <Package size={28} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Aucune livraison trouvée</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {livraisonsFiltrees.map(l => (
                    <div key={l.id} onClick={() => setDetail(l)}
                      className="p-4 sm:p-5 flex items-start gap-3 hover:bg-gray-50 cursor-pointer transition-colors">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 text-base ${l.statut === 'en_cours' ? 'bg-orange-50' : l.statut === 'livre' ? 'bg-green-50' : 'bg-gray-50'}`}>
                        {STATUT_CFG[l.statut]?.icon || '📦'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-bold text-gray-900 text-sm truncate">{l.adresse_depart}</p>
                            <p className="text-gray-400 text-xs truncate">→ {l.adresse_arrivee}</p>
                          </div>
                          <Badge statut={l.statut} />
                        </div>
                        <div className="flex flex-wrap items-center gap-2.5 mt-2 text-xs text-gray-400">
                          <span>{fDate(l.created_at)}</span>
                          {l.destinataire_nom && <span>· 👤 {l.destinataire_nom}</span>}
                          {l.destinataire_tel && (
                            <a href={`tel:${l.destinataire_tel}`} onClick={e => e.stopPropagation()}
                              className="flex items-center gap-1 text-blue-500 hover:underline">
                              <Phone size={9} />{l.destinataire_tel}
                            </a>
                          )}
                          {l.prix && <span className="text-orange-600 font-bold">{fXOF(l.prix)}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <button onClick={exportCSV}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
              <FileText size={13} />Exporter CSV
            </button>
          </div>
        )}

        {/* ════════════ PLANIFIER ════════════ */}
        {tab === 'planifier' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-900">Planifier une livraison</h2>
              <button onClick={() => setShowForm(!showForm)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-xl hover:bg-orange-600">
                <Plus size={13} />Créer
              </button>
            </div>

            {showForm && (
              <div className="bg-white rounded-2xl p-6 border-2 border-orange-200 shadow-sm space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                    <Package size={18} className="text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-black text-gray-900">Nouvelle livraison</h3>
                    <p className="text-gray-400 text-xs">Votre livreur dédié sera notifié immédiatement</p>
                  </div>
                </div>
                {contacts.length > 0 && (
                  <div>
                    <p className="text-xs font-black text-gray-500 uppercase tracking-wider mb-2">Contact rapide</p>
                    <div className="flex flex-wrap gap-2">
                      {contacts.slice(0, 8).map(c => (
                        <button key={c.id} onClick={() => selectContact(c)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${formLivr.destinataire_nom === c.nom ? 'bg-orange-500 text-white border-orange-500' : 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100'}`}>
                          {c.nom.split(' ')[0]}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">📍 Adresse de départ *</label>
                    <input type="text" placeholder="Ex: Avenue Kwame Nkrumah, Ouagadougou"
                      value={formLivr.adresse_depart}
                      onChange={e => setFormLivr(p => ({ ...p, adresse_depart: e.target.value }))} className={inp} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">🏁 Adresse de destination *</label>
                    <input type="text" placeholder="Ex: Secteur 15, rue des Fleurs"
                      value={formLivr.adresse_arrivee}
                      onChange={e => setFormLivr(p => ({ ...p, adresse_arrivee: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">👤 Nom destinataire *</label>
                    <input type="text" placeholder="Prénom Nom" value={formLivr.destinataire_nom}
                      onChange={e => setFormLivr(p => ({ ...p, destinataire_nom: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">📞 Téléphone *</label>
                    <input type="tel" placeholder="+226 XX XX XX XX" value={formLivr.destinataire_tel}
                      onChange={e => setFormLivr(p => ({ ...p, destinataire_tel: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">💬 WhatsApp</label>
                    <input type="tel" placeholder="+226 XX XX XX XX" value={formLivr.destinataire_whatsapp}
                      onChange={e => setFormLivr(p => ({ ...p, destinataire_whatsapp: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">📅 Date programmée</label>
                    <input type="date" value={formLivr.date_programmee}
                      min={new Date().toISOString().split('T')[0]}
                      onChange={e => setFormLivr(p => ({ ...p, date_programmee: e.target.value }))} className={inp} />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-black text-gray-500 uppercase tracking-wider mb-1.5">📝 Instructions spéciales</label>
                    <textarea placeholder="Fragile, appeler avant livraison, code portail…"
                      value={formLivr.instructions}
                      onChange={e => setFormLivr(p => ({ ...p, instructions: e.target.value }))}
                      className={`${inp} resize-none h-20`} />
                  </div>
                </div>
                <div className="bg-orange-50 border border-orange-100 rounded-xl p-3 flex items-start gap-2">
                  <span className="text-base shrink-0">💡</span>
                  <p className="text-orange-700 text-xs leading-relaxed">
                    Inclus dans votre abonnement <strong>{plan?.label}</strong>. Votre livreur dédié sera notifié sous <strong>{plan?.delai}</strong>.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowForm(false)}
                    className="flex-1 py-3 rounded-xl border-2 border-gray-200 font-bold text-gray-700 hover:bg-gray-50 transition-colors text-sm">
                    Annuler
                  </button>
                  <button onClick={handleCreateLivraison} disabled={submittingLivr}
                    className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-sm disabled:opacity-50 transition-all shadow-sm">
                    {submittingLivr ? '⏳ Création…' : '🚀 Créer la livraison'}
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-50">
                <h3 className="font-black text-gray-900 text-sm">Planning — 30 prochains jours</h3>
              </div>
              <div className="p-4">
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((j, i) => (
                    <div key={i} className="text-center text-[10px] font-black text-gray-300 py-1">{j}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {Array.from({ length: 30 }, (_, i) => {
                    const d = new Date(); d.setDate(d.getDate() + i)
                    const ds = d.toISOString().split('T')[0]
                    const nb = livraisons.filter(l => l.created_at.startsWith(ds)).length
                    return (
                      <div key={i} title={`${d.toLocaleDateString('fr-FR')} — ${nb} livraison(s)`}
                        className={`aspect-square rounded-xl flex flex-col items-center justify-center text-xs font-bold relative ${i === 0 ? 'ring-2 ring-orange-400 ring-offset-1' : ''} ${nb > 0 ? 'bg-orange-500 text-white' : 'bg-gray-50 text-gray-400 hover:bg-gray-100'}`}>
                        {d.getDate()}
                        {nb > 0 && <span className="text-[8px] font-black opacity-80">{nb}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ════════════ CONTACTS ════════════ */}
        {tab === 'contacts' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-900">
                Contacts <span className="text-gray-300 font-normal text-sm">({contacts.length})</span>
              </h2>
              <button onClick={() => { setEditContact(null); setContactForm({ nom: '', telephone: '', whatsapp: '', adresse_habituelle: '' }); setShowContactForm(true) }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-orange-500 text-white text-sm font-bold rounded-xl hover:bg-orange-600">
                <UserPlus size={13} />Ajouter
              </button>
            </div>
            <p className="text-gray-400 text-sm">Vos clients fréquents pour des livraisons en 2 clics.</p>
            {showContactForm && (
              <div className="bg-white rounded-2xl p-6 border-2 border-orange-200 shadow-sm space-y-4">
                <h3 className="font-black text-gray-900">{editContact ? 'Modifier le contact' : 'Nouveau contact'}</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-1.5">Nom *</label>
                    <input type="text" placeholder="Prénom Nom" value={contactForm.nom}
                      onChange={e => setContactForm(p => ({ ...p, nom: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-1.5">Téléphone *</label>
                    <input type="tel" placeholder="+226 XX XX XX XX" value={contactForm.telephone}
                      onChange={e => setContactForm(p => ({ ...p, telephone: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-1.5">WhatsApp</label>
                    <input type="tel" placeholder="+226 XX XX XX XX" value={contactForm.whatsapp}
                      onChange={e => setContactForm(p => ({ ...p, whatsapp: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-1.5">Adresse habituelle</label>
                    <input type="text" placeholder="Ex: Secteur 15…" value={contactForm.adresse_habituelle}
                      onChange={e => setContactForm(p => ({ ...p, adresse_habituelle: e.target.value }))} className={inp} />
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => { setShowContactForm(false); setEditContact(null) }}
                    className="flex-1 py-2.5 rounded-xl border-2 border-gray-200 font-bold text-gray-700 text-sm">Annuler</button>
                  <button onClick={handleSaveContact} disabled={savingContact}
                    className="flex-1 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-sm disabled:opacity-50">
                    {savingContact ? '…' : editContact ? '💾 Modifier' : '✅ Ajouter'}
                  </button>
                </div>
              </div>
            )}
            {contacts.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center border border-gray-100 shadow-sm">
                <BookOpen size={32} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-400 text-sm">Ajoutez vos clients fréquents pour des livraisons rapides.</p>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {contacts.map(c => (
                  <div key={c.id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-orange-400 to-orange-600 rounded-xl flex items-center justify-center text-white font-black">
                      {c.nom.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-gray-900 text-sm">{c.nom}</p>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                        <a href={`tel:${c.telephone}`} className="hover:text-blue-600 flex items-center gap-1">
                          <Phone size={9} />{c.telephone}
                        </a>
                        {c.adresse_habituelle && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin size={9} />{c.adresse_habituelle}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button onClick={() => { setTab('planifier'); setShowForm(true); selectContact(c) }}
                        className="p-2 bg-orange-50 rounded-lg text-orange-600 hover:bg-orange-100 transition-colors" title="Créer livraison">
                        <Package size={12} />
                      </button>
                      <button onClick={() => { setEditContact(c); setContactForm({ nom: c.nom, telephone: c.telephone, whatsapp: c.whatsapp || '', adresse_habituelle: c.adresse_habituelle || '' }); setShowContactForm(true) }}
                        className="p-2 bg-gray-100 rounded-lg text-gray-600 hover:bg-gray-200 transition-colors">
                        <Edit2 size={12} />
                      </button>
                      <button onClick={() => handleDeleteContact(c.id)}
                        className="p-2 bg-red-50 rounded-lg text-red-500 hover:bg-red-100 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════ CARTE ════════════ */}
        {tab === 'carte' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-900">Carte en temps réel</h2>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-gray-500 font-medium">Live</span>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-gray-100 flex flex-wrap gap-4 text-xs">
              <span className="flex items-center gap-2 font-semibold text-gray-600">
                <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse" />
                Disponibles ({coursiers.filter(c => c.statut === 'disponible').length})
              </span>
              <span className="flex items-center gap-2 font-semibold text-gray-600">
                <span className="w-3 h-3 rounded-full bg-orange-400" />
                En livraison ({coursiers.filter(c => c.statut === 'occupe').length})
              </span>
              <span className="flex items-center gap-2 font-semibold text-gray-600">
                <span className="w-3 h-3 rounded-full bg-blue-500" />
                Vos livraisons en cours ({stats.enCours})
              </span>
            </div>
            <div className="h-[420px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
              <MapAdvanced
                coursier={coursiers.find(c => c.lat_actuelle && c.lng_actuelle) ? {
                  lat: coursiers.find(c => c.lat_actuelle)!.lat_actuelle!,
                  lng: coursiers.find(c => c.lng_actuelle)!.lng_actuelle!,
                  nom: 'Coursiers actifs',
                } : undefined}
              />
            </div>
            {coursiers.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-50">
                  <p className="font-black text-gray-900 text-sm">Coursiers actifs ({coursiers.length})</p>
                </div>
                {coursiers.map(c => (
                  <div key={c.id} className="p-4 flex items-center gap-3 border-b border-gray-50 last:border-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${c.statut === 'disponible' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      {c.nom.charAt(0)}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 text-sm">{c.nom}</p>
                      <p className="text-xs text-gray-400">
                        {c.note_moyenne ? `⭐ ${c.note_moyenne.toFixed(1)} · ` : ''}{c.total_courses} courses
                      </p>
                    </div>
                    <div className={`text-[11px] px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 ${c.statut === 'disponible' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                      <Circle size={6} fill="currentColor" />
                      {c.statut === 'disponible' ? 'Disponible' : 'En livraison'}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════ WALLET ════════════ */}
        {tab === 'wallet' && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-gray-900">Wallet & Abonnement</h2>
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
              <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/5" />
              <div className="absolute -right-3 -bottom-10 w-52 h-52 rounded-full bg-white/[0.03]" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Solde wallet</p>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-4xl font-black">{soldeWallet.toLocaleString('fr-FR')}</span>
                      <span className="text-white/70 font-semibold">FCFA</span>
                    </div>
                  </div>
                  <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center">
                    <Wallet size={20} className="text-white" />
                  </div>
                </div>
                {partenaire && plan && (
                  <div className="bg-white/10 rounded-xl p-3 flex items-center justify-between">
                    <div>
                      <p className="text-white/60 text-xs">Plan actuel</p>
                      <p className="font-black text-sm">{plan.emoji} {plan.label}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/60 text-xs">Abonnement</p>
                      <p className="font-black text-sm text-orange-300">
                        {plan.prix === 0 ? 'Sur devis' : `${plan.prix.toLocaleString('fr-FR')} FCFA/mois`}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {partenaire && plan && (
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm space-y-4">
                <h3 className="font-black text-gray-900 flex items-center gap-2">
                  <CreditCard size={15} className="text-orange-500" />Renouveler l&apos;abonnement mensuel
                </h3>
                <div className="bg-gray-50 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-900">{plan.emoji} Plan {plan.label}</p>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {plan.max < 9999 ? `${plan.max} livraisons/mois` : 'Livraisons illimitées'} · Express {plan.delai}
                    </p>
                  </div>
                  <p className="text-2xl font-black text-gray-900">
                    {plan.prix === 0 ? 'Devis' : `${plan.prix.toLocaleString('fr-FR')}`}
                    {plan.prix > 0 && <span className="text-sm text-gray-400 font-normal"> FCFA</span>}
                  </p>
                </div>
                {plan.prix > 0 ? (
                  <>
                    <div className={`rounded-xl p-3 text-sm flex items-center gap-2 ${soldeWallet >= plan.prix ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                      {soldeWallet >= plan.prix ? <CheckCircle size={14} /> : <AlertCircle size={14} />}
                      {soldeWallet >= plan.prix
                        ? `Solde suffisant — il restera ${(soldeWallet - plan.prix).toLocaleString('fr-FR')} FCFA`
                        : `Solde insuffisant — rechargez ${(plan.prix - soldeWallet).toLocaleString('fr-FR')} FCFA`}
                    </div>
                    <button onClick={handlePaiementAbonnement} disabled={soldeWallet < plan.prix}
                      className="w-full py-3.5 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-sm disabled:opacity-40 transition-all shadow-sm">
                      {soldeWallet >= plan.prix ? `💳 Payer ${plan.prix.toLocaleString('fr-FR')} FCFA` : 'Solde insuffisant'}
                    </button>
                  </>
                ) : (
                  <a href="mailto:nyme.contact@gmail.com?subject=Renouvellement plan Enterprise"
                    className="w-full py-3.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-black text-sm transition-all text-center block">
                    📞 Contacter NYME pour le renouvellement
                  </a>
                )}
                <p className="text-gray-400 text-xs text-center">
                  Pour recharger votre wallet : <a href="mailto:nyme.contact@gmail.com" className="text-orange-600 font-semibold">nyme.contact@gmail.com</a>
                </p>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="p-4 border-b border-gray-50">
                <p className="font-black text-gray-900 text-sm">Comparer les plans</p>
              </div>
              <div className="grid grid-cols-3 gap-0 divide-x divide-gray-100">
                {Object.entries(PLAN_CFG).map(([key, cfg]) => (
                  <div key={key} className={`p-4 text-center ${partenaire?.plan === key ? 'bg-orange-50' : ''}`}>
                    <p className="text-xl mb-1">{cfg.emoji}</p>
                    <p className="font-black text-gray-900 text-xs">{cfg.label}</p>
                    <p className="text-orange-600 font-black text-sm mt-1">
                      {cfg.prix === 0 ? 'Devis' : `${(cfg.prix / 1000).toFixed(0)}k`}
                    </p>
                    <p className="text-gray-400 text-[10px]">FCFA/mois</p>
                    <p className="text-gray-500 text-[10px] mt-1">{cfg.max < 9999 ? `${cfg.max} livr.` : '∞ livr.'}</p>
                    {partenaire?.plan === key && (
                      <span className="inline-block mt-2 text-[10px] bg-orange-500 text-white px-2 py-0.5 rounded-full font-black">Actuel</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
                <p className="text-gray-500 text-xs">Pour changer de plan, contactez NYME</p>
                <a href="mailto:nyme.contact@gmail.com?subject=Changement de plan partenaire" className="text-orange-600 text-xs font-black hover:underline">
                  nyme.contact@gmail.com
                </a>
              </div>
            </div>

            {txWallet.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-50">
                  <p className="font-black text-gray-900 text-sm">Historique des transactions</p>
                </div>
                {txWallet.map((tx: any, i) => (
                  <div key={i} className="flex items-center gap-3 p-4 border-b border-gray-50 last:border-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-base ${tx.montant > 0 ? 'bg-green-100' : 'bg-orange-100'}`}>
                      {tx.montant > 0 ? '⬆️' : '⬇️'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-900 text-sm font-bold truncate">{tx.note || tx.type}</p>
                      <p className="text-gray-400 text-xs">{fDate(tx.created_at)}</p>
                    </div>
                    <p className={`font-black text-sm shrink-0 ${tx.montant > 0 ? 'text-green-600' : 'text-red-500'}`}>
                      {tx.montant > 0 ? '+' : ''}{tx.montant.toLocaleString('fr-FR')} FCFA
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════ COMPTE ════════════ */}
        {tab === 'compte' && (
          <div className="space-y-4">
            <h2 className="text-lg font-black text-gray-900">Mon compte</h2>
            {!editingProfil ? (
              <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
                <div className="flex items-center gap-4 mb-5 pb-4 border-b border-gray-50">
                  <div className="w-14 h-14 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center text-white font-black text-2xl shadow-sm">
                    {partenaire?.nom_contact?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1">
                    <p className="font-black text-gray-900">{partenaire?.nom_contact}</p>
                    <p className="text-gray-400 text-sm">{partenaire?.entreprise}</p>
                    {plan && (
                      <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-bold border mt-1 ${plan.badge}`}>
                        {plan.emoji} {plan.label}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setEditingProfil(true)} className="flex items-center gap-1.5 text-orange-600 text-xs font-black hover:underline">
                    <Edit2 size={12} />Modifier
                  </button>
                </div>
                {partenaire && [
                  ['📧 Email pro',    partenaire.email_pro || '—'],
                  ['📞 Téléphone',    partenaire.telephone || '—'],
                  ['📍 Adresse',      (partenaire as any).adresse || '—'],
                  ['📅 Membre depuis', new Date(partenaire.date_debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })],
                ].map(([l, v], i) => (
                  <div key={i} className="flex items-center justify-between py-2.5 border-b border-gray-50 last:border-0">
                    <span className="text-gray-500 text-sm">{l}</span>
                    <span className="font-semibold text-gray-900 text-sm">{v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-5 border-2 border-orange-200 shadow-sm space-y-4">
                <h3 className="font-black text-gray-900">Modifier le profil</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {[
                    { key: 'entreprise',  label: 'Nom entreprise *', type: 'text',  ph: 'Votre entreprise' },
                    { key: 'nom_contact', label: 'Nom contact *',    type: 'text',  ph: 'Votre nom' },
                    { key: 'telephone',   label: 'Téléphone',        type: 'tel',   ph: '+226 XX XX XX XX' },
                    { key: 'email_pro',   label: 'Email pro',        type: 'email', ph: 'contact@entreprise.com' },
                    { key: 'adresse',     label: 'Adresse',          type: 'text',  ph: 'Adresse entreprise' },
                  ].map(f => (
                    <div key={f.key} className={f.key === 'adresse' ? 'sm:col-span-2' : ''}>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-wider mb-1.5">{f.label}</label>
                      <input type={f.type} placeholder={f.ph}
                        value={profilForm[f.key as keyof typeof profilForm]}
                        onChange={e => setProfilForm(p => ({ ...p, [f.key]: e.target.value }))} className={inp} />
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setEditingProfil(false)} className="flex-1 py-3 rounded-xl border-2 border-gray-200 font-bold text-gray-700 text-sm">Annuler</button>
                  <button onClick={handleSaveProfil} disabled={savingProfil}
                    className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-black text-sm disabled:opacity-50">
                    {savingProfil ? '…' : '💾 Sauvegarder'}
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
              <h3 className="font-black text-gray-900 mb-3 flex items-center gap-2 text-sm">
                <ShieldCheck size={14} className="text-orange-500" />Sécurité du compte
              </h3>
              {alertes.length === 0 ? (
                <div className="flex items-center gap-2 text-green-600 text-sm font-semibold">
                  <CheckCircle size={14} />Aucune alerte — compte sécurisé ✓
                </div>
              ) : (
                alertes.map((a, i) => (
                  <div key={i} className="p-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-xs mb-2 flex items-start gap-2">
                    <AlertCircle size={12} className="shrink-0 mt-0.5" />{a}
                  </div>
                ))
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <a href="mailto:nyme.contact@gmail.com"
                className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 hover:border-orange-200 transition-all shadow-sm">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Phone size={15} className="text-orange-600" />
                </div>
                <div>
                  <p className="font-black text-gray-900 text-sm">Contacter NYME</p>
                  <p className="text-gray-400 text-xs">nyme.contact@gmail.com</p>
                </div>
              </a>
              <a href="https://wa.me/22600000000" target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-white rounded-2xl border border-gray-100 hover:border-green-200 transition-all shadow-sm">
                <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center text-lg">💬</div>
                <div>
                  <p className="font-black text-gray-900 text-sm">WhatsApp NYME</p>
                  <p className="text-gray-400 text-xs">Réponse instantanée</p>
                </div>
              </a>
            </div>

            <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/partenaires/login' }}
              className="w-full flex items-center justify-center gap-2 p-4 bg-white rounded-2xl border border-red-100 hover:border-red-300 text-red-600 font-black text-sm transition-all shadow-sm">
              <LogOut size={14} />Se déconnecter
            </button>
          </div>
        )}

        <p className="text-center text-gray-300 text-[11px] py-4">
          © {new Date().getFullYear()} NYME · Partenaires · Ouagadougou, Burkina Faso
        </p>
      </div>

      {/* ══ MODAL DÉTAIL LIVRAISON ══ */}
      {detail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setDetail(null)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto shadow-2xl"
            onClick={e => e.stopPropagation()}>
            <div className="p-5 border-b border-gray-50 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl">
              <div>
                <h3 className="font-black text-gray-900">#{detail.id.slice(0, 8).toUpperCase()}</h3>
                <p className="text-gray-400 text-xs">{fDate(detail.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge statut={detail.statut} />
                <button onClick={() => setDetail(null)} className="p-1.5 rounded-lg hover:bg-gray-100 ml-2">
                  <X size={14} className="text-gray-500" />
                </button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              {detail.lat_depart && detail.lng_depart && detail.lat_arrivee && detail.lng_arrivee && (
                <div className="h-44 rounded-xl overflow-hidden border border-gray-100">
                  <MapAdvanced
                    depart={{ lat: detail.lat_depart, lng: detail.lng_depart, label: detail.adresse_depart }}
                    arrivee={{ lat: detail.lat_arrivee, lng: detail.lng_arrivee, label: detail.adresse_arrivee }}
                  />
                </div>
              )}
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-orange-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Départ</p>
                    <p className="font-bold text-gray-900 text-sm">{detail.adresse_depart}</p>
                  </div>
                </div>
                <div className="ml-3.5 w-px h-4 bg-gray-200" />
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 bg-green-100 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                    <MapPin size={12} className="text-green-600" />
                  </div>
                  <div>
                    <p className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Destination</p>
                    <p className="font-bold text-gray-900 text-sm">{detail.adresse_arrivee}</p>
                  </div>
                </div>
              </div>
              {[
                ['👤 Destinataire', detail.destinataire_nom || '—'],
                ['💰 Prix', detail.prix ? fXOF(detail.prix) : 'Inclus dans votre abonnement'],
                ['📝 Instructions', detail.instructions || 'Aucune'],
              ].map(([l, v], i) => (
                <div key={i} className="flex items-start justify-between gap-3 py-2.5 border-b border-gray-50 last:border-0">
                  <span className="text-gray-500 text-sm shrink-0">{l}</span>
                  <span className="text-gray-900 text-sm text-right font-semibold">{v}</span>
                </div>
              ))}
              {detail.destinataire_tel && (
                <div className="flex gap-2 pt-1">
                  <a href={`tel:${detail.destinataire_tel}`}
                    className="flex-1 py-3 rounded-xl bg-green-500 hover:bg-green-600 text-white font-black text-sm text-center flex items-center justify-center gap-2 transition-colors">
                    📞 Appeler
                  </a>
                  <a href={`https://wa.me/226${detail.destinataire_tel.replace(/\D/g, '')}`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex-1 py-3 rounded-xl bg-[#25D366] hover:bg-[#1da84f] text-white font-black text-sm text-center flex items-center justify-center gap-2 transition-colors">
                    💬 WhatsApp
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
