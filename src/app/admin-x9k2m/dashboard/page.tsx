'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import {
  Zap, LogOut, Users, Package, TrendingUp, ShieldCheck, Plus, X,
  AlertCircle, CheckCircle, RefreshCw, Eye, Building2, User, Phone,
  Mail, Loader2, BarChart3, Wallet, FileCheck, Search, Ban, UserCheck,
  Send, DollarSign, CreditCard, ArrowDownLeft, ChevronDown, ChevronUp,
  Truck, Clock, XCircle, CheckCircle2, AlertTriangle, Ruler, Calculator,
  PlusCircle, Trash2, Info,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ──────────────────────────────────────────────────────────────────────
interface BaremeAdmin {
  id: string
  km_min: number
  km_max: number
  prix_par_km: number
  label: string
  ordre: number
  actif: boolean
}

interface ConfigAdmin {
  id: string
  frais_fixe_immediate: number
  frais_fixe_urgente: number
  frais_fixe_programmee: number
  prix_minimum: number
  multiplicateur_urgente: number
  multiplicateur_programmee: number
  multiplicateur_pluie: number
  pluie_actif: boolean
  commission_immediate: number
  commission_urgente: number
  commission_programmee: number
  tarif_km: number
  tarif_minute: number
  frais_fixe: number
  commission_pct: number
  actif: boolean
}

interface PartenaireAdmin {
  id: string
  user_id: string
  entreprise: string
  nom_contact: string
  telephone: string | null
  email_pro: string | null
  plan: 'starter' | 'business' | 'enterprise'
  statut: 'actif' | 'suspendu' | 'en_attente' | 'rejete'
  livraisons_max: number
  livraisons_mois: number
  taux_commission: number
  date_debut: string
  created_at: string
}

interface CoursierAdmin {
  id: string
  nom: string
  email: string
  telephone: string
  statut_verification: 'en_attente' | 'verifie' | 'rejete'
  statut: 'hors_ligne' | 'disponible' | 'occupe'
  cni_recto_url: string
  cni_verso_url: string
  permis_url: string
  total_gains: number
  total_courses: number
  created_at: string
  wallet_solde?: number
}

interface ClientAdmin {
  id: string
  nom: string
  email: string
  telephone: string
  est_actif: boolean
  est_verifie: boolean
  created_at: string
  total_livraisons?: number
}

interface LivraisonAdmin {
  id: string
  client_nom: string
  coursier_nom: string
  statut: string
  type: string
  depart_adresse: string
  arrivee_adresse: string
  prix_final: number
  created_at: string
}

interface WalletAdmin {
  id: string
  user_id: string
  solde: number
  total_gains: number
  total_retraits: number
  created_at: string
  utilisateur?: { nom: string; email: string; role: string }
}

// ── Configs ────────────────────────────────────────────────────────────────────
const PLAN_CFG = {
  starter:    { label: 'Starter',    color: 'text-green-600 bg-green-50 border-green-200'   },
  business:   { label: 'Business',   color: 'text-orange-600 bg-orange-50 border-orange-200' },
  enterprise: { label: 'Enterprise', color: 'text-purple-600 bg-purple-50 border-purple-200' },
}

const STATUT_CFG: Record<string, { label: string; color: string; dot: string }> = {
  actif:       { label: 'Actif',       color: 'text-green-600 bg-green-50 border-green-200',  dot: 'bg-green-500'  },
  en_attente:  { label: 'En attente',  color: 'text-amber-600 bg-amber-50 border-amber-200',  dot: 'bg-amber-400'  },
  suspendu:    { label: 'Suspendu',    color: 'text-red-600 bg-red-50 border-red-200',         dot: 'bg-red-500'    },
  rejete:      { label: 'Rejeté',      color: 'text-gray-600 bg-gray-50 border-gray-200',      dot: 'bg-gray-400'   },
  verifie:     { label: 'Vérifié',     color: 'text-green-600 bg-green-50 border-green-200',   dot: 'bg-green-500'  },
  hors_ligne:  { label: 'Hors ligne',  color: 'text-gray-600 bg-gray-50 border-gray-200',      dot: 'bg-gray-400'   },
  disponible:  { label: 'Disponible',  color: 'text-green-600 bg-green-50 border-green-200',   dot: 'bg-green-500'  },
  occupe:      { label: 'Occupé',      color: 'text-blue-600 bg-blue-50 border-blue-200',       dot: 'bg-blue-500'   },
}

const ONGLETS = [
  { id: 'overview',       label: 'Vue générale',   icon: BarChart3   },
  { id: 'partenaires',    label: 'Partenaires',     icon: Building2   },
  { id: 'coursiers',      label: 'Coursiers',       icon: Truck       },
  { id: 'clients',        label: 'Clients',         icon: Users       },
  { id: 'livraisons',     label: 'Courses',         icon: Package     },
  { id: 'wallet',         label: 'Wallet/Finances', icon: Wallet      },
  { id: 'tarification',   label: 'Tarification',    icon: TrendingUp  },
  { id: 'creation',       label: 'Actions Admin',   icon: Plus        },
]

const CONFIG_LABELS: Record<string, { label: string; unit: string; desc: string }> = {
  frais_fixe_immediate:   { label: 'Frais fixes immédiat',          unit: 'XOF', desc: 'Base de calcul pour une course immédiate'                         },
  frais_fixe_urgente:     { label: 'Frais fixes urgente',           unit: 'XOF', desc: 'Base pour course urgente (avant multiplicateur)'                  },
  frais_fixe_programmee:  { label: 'Frais fixes programmée',        unit: 'XOF', desc: 'Base pour course programmée (avant multiplicateur)'               },
  prix_minimum:           { label: 'Prix minimum',                   unit: 'XOF', desc: 'Prix plancher absolu quel que soit le trajet'                     },
  multiplicateur_urgente: { label: 'Multiplicateur urgente',         unit: '×',   desc: 'Coefficient appliqué aux courses urgentes (ex: 1.25 = +25%)'     },
  multiplicateur_programmee: { label: 'Multiplicateur programmée',  unit: '×',   desc: 'Coefficient pour courses programmées (ex: 0.90 = -10%)'          },
  multiplicateur_pluie:   { label: 'Multiplicateur pluie',          unit: '×',   desc: 'Coefficient météo si pluie activée'                               },
  commission_immediate:   { label: 'Commission NYME immédiat',      unit: 'XOF', desc: 'Commission fixe NYME pour course immédiate'                       },
  commission_urgente:     { label: 'Commission NYME urgente',       unit: 'XOF', desc: 'Commission fixe NYME pour course urgente'                         },
  commission_programmee:  { label: 'Commission NYME programmée',    unit: 'XOF', desc: 'Commission fixe NYME pour course programmée'                      },
  pluie_actif:            { label: 'Météo activée',                  unit: '',    desc: 'Activer le surcoût lors de la pluie'                              },
}

// ── Utilitaires ────────────────────────────────────────────────────────────────
function simulerPrix(
  distanceKm: number,
  type: 'immediate' | 'urgente' | 'programmee',
  baremes: BaremeAdmin[],
  config: ConfigAdmin,
  pluie = false,
): number {
  let prix =
    type === 'urgente'    ? (config.frais_fixe_urgente    || 800) :
    type === 'programmee' ? (config.frais_fixe_programmee || 800) :
                            (config.frais_fixe_immediate  || 800)

  let kmRestant = distanceKm
  const sorted = [...baremes].filter(b => b.actif).sort((a, b) => a.ordre - b.ordre)

  for (const b of sorted) {
    if (kmRestant <= 0) break
    const km = Math.min(kmRestant, b.km_max - b.km_min)
    prix += km * b.prix_par_km
    kmRestant -= km
  }
  if (kmRestant > 0 && sorted.length > 0) {
    prix += kmRestant * sorted[sorted.length - 1].prix_par_km
  }

  if (type === 'urgente')    prix *= (config.multiplicateur_urgente    || 1.25)
  if (type === 'programmee') prix *= (config.multiplicateur_programmee || 0.90)
  if (pluie && config.pluie_actif) prix *= (config.multiplicateur_pluie || 1.15)

  return Math.max(config.prix_minimum || 800, Math.round(prix))
}

// ── Composant Badge ────────────────────────────────────────────────────────────
function Badge({ statut }: { statut: string }) {
  const cfg = STATUT_CFG[statut] || STATUT_CFG.en_attente
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  )
}

// ── Composant TarificationPanel ────────────────────────────────────────────────
interface TarificationPanelProps {
  baremes: BaremeAdmin[]
  configTarif: ConfigAdmin | null
  loadingTarifs: boolean
  savingTarif: string | null
  editBareme: BaremeAdmin | null
  setEditBareme: (b: BaremeAdmin | null) => void
  saveBareme: (b: BaremeAdmin) => void
  saveConfig: () => void
  setConfigTarif: (c: ConfigAdmin) => void
  loadTarifs: () => void
  token?: string
}

function TarificationPanel({
  baremes,
  configTarif,
  loadingTarifs,
  savingTarif,
  editBareme,
  setEditBareme,
  saveBareme,
  saveConfig,
  setConfigTarif,
  loadTarifs,
  token,
}: TarificationPanelProps) {
  const [simDist, setSimDist]   = useState(5)
  const [simType, setSimType]   = useState<'immediate' | 'urgente' | 'programmee'>('immediate')
  const [simPluie, setSimPluie] = useState(false)
  const [addMode, setAddMode]   = useState(false)
  const [newBareme, setNewBareme] = useState({ km_min: 0, km_max: 0, prix_par_km: 0, label: '', ordre: 0 })
  const [saving, setSaving]     = useState(false)

  const chartPoints = useMemo(() => {
    if (!configTarif || baremes.length === 0) return []
    return Array.from({ length: 26 }, (_, i) => ({
      km:          i,
      immediate:   simulerPrix(i, 'immediate',   baremes, configTarif),
      urgente:     simulerPrix(i, 'urgente',     baremes, configTarif),
      programmee:  simulerPrix(i, 'programmee',  baremes, configTarif),
    }))
  }, [baremes, configTarif])

  const maxPrice = useMemo(() => Math.max(...chartPoints.map(p => p.urgente), 1), [chartPoints])

  const simResult = useMemo(() => {
    if (!configTarif || baremes.length === 0) return null
    const immediate   = simulerPrix(simDist, 'immediate',   baremes, configTarif, simPluie)
    const urgente     = simulerPrix(simDist, 'urgente',     baremes, configTarif, simPluie)
    const programmee  = simulerPrix(simDist, 'programmee',  baremes, configTarif, simPluie)
    const commission  =
      simType === 'urgente'    ? configTarif.commission_urgente    :
      simType === 'programmee' ? configTarif.commission_programmee :
                                  configTarif.commission_immediate
    const prixFinal =
      simType === 'immediate'   ? immediate   :
      simType === 'urgente'     ? urgente     : programmee
    return { immediate, urgente, programmee, prixFinal, gainCoursier: prixFinal - commission, commission }
  }, [simDist, simType, simPluie, baremes, configTarif])

  const handleAddBareme = async () => {
    if (!token) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/tarifs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(newBareme),
      })
      if (res.ok) {
        setAddMode(false)
        setNewBareme({ km_min: 0, km_max: 0, prix_par_km: 0, label: '', ordre: 0 })
        loadTarifs()
      }
    } finally {
      setSaving(false)
    }
  }

  if (loadingTarifs) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={32} className="animate-spin text-[#0A2E8A]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-black text-[#0A2E8A]">Tarification</h2>
        <button
          onClick={loadTarifs}
          className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all"
        >
          <RefreshCw size={12} /> Actualiser
        </button>
      </div>

      {/* ── SIMULATEUR DE PRIX ── */}
      <div className="bg-gradient-to-br from-[#0A2E8A] to-[#1A4FBF] rounded-2xl p-6 text-white">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <Calculator size={16} className="text-[#E87722]" /> Simulateur de prix
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <div>
            <label className="text-white/60 text-xs uppercase tracking-wide block mb-1.5">Distance (km)</label>
            <input
              type="number" min="0.5" max="50" step="0.5" value={simDist}
              onChange={e => setSimDist(parseFloat(e.target.value) || 1)}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm font-bold focus:outline-none focus:border-[#E87722]"
            />
          </div>
          <div>
            <label className="text-white/60 text-xs uppercase tracking-wide block mb-1.5">Type de course</label>
            <select
              value={simType}
              onChange={e => setSimType(e.target.value as 'immediate' | 'urgente' | 'programmee')}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm font-bold focus:outline-none focus:border-[#E87722]"
            >
              <option value="immediate">Immédiate</option>
              <option value="urgente">Urgente</option>
              <option value="programmee">Programmée</option>
            </select>
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <div
                className={`w-10 h-5 rounded-full transition-colors ${simPluie ? 'bg-[#E87722]' : 'bg-white/20'} relative`}
                onClick={() => setSimPluie(!simPluie)}
              >
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${simPluie ? 'translate-x-5' : ''}`} />
              </div>
              <span className="text-white/80 text-xs">🌧️ Pluie</span>
            </label>
          </div>
        </div>
        {simResult && (
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Immédiate',  value: simResult.immediate,   active: simType === 'immediate'   },
              { label: 'Urgente',    value: simResult.urgente,     active: simType === 'urgente'     },
              { label: 'Programmée', value: simResult.programmee,  active: simType === 'programmee'  },
            ].map(r => (
              <div key={r.label} className={`rounded-xl p-3 text-center transition-all ${r.active ? 'bg-[#E87722]' : 'bg-white/10'}`}>
                <p className="text-white/70 text-xs">{r.label}</p>
                <p className="text-white font-black text-lg">{r.value.toLocaleString('fr-FR')}</p>
                <p className="text-white/60 text-xs">XOF</p>
              </div>
            ))}
            <div className="col-span-3 grid grid-cols-2 gap-3 mt-2">
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-white/60 text-xs">Commission NYME</p>
                <p className="text-[#E87722] font-black">{simResult.commission.toLocaleString('fr-FR')} XOF</p>
              </div>
              <div className="bg-white/10 rounded-xl p-3">
                <p className="text-white/60 text-xs">Gain coursier net</p>
                <p className="text-green-400 font-black">{simResult.gainCoursier.toLocaleString('fr-FR')} XOF</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── GRAPHIQUE BARÈME (SVG natif) ── */}
      {chartPoints.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <BarChart3 size={16} className="text-[#0A2E8A]" /> Courbes de prix par km
          </h3>
          <div className="overflow-x-auto">
            <svg viewBox="0 0 520 220" className="w-full min-w-[400px]" style={{ fontFamily: 'sans-serif' }}>
              {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                const y   = 20 + (1 - pct) * 180
                const val = Math.round(maxPrice * pct / 100) * 100
                return (
                  <g key={pct}>
                    <line x1="40" y1={y} x2="510" y2={y} stroke="#f1f5f9" strokeWidth="1" />
                    <text x="35" y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
                      {val.toLocaleString('fr')}
                    </text>
                  </g>
                )
              })}
              {[
                { key: 'immediate',  color: '#0A2E8A', label: 'Immédiate'  },
                { key: 'urgente',    color: '#E87722', label: 'Urgente'    },
                { key: 'programmee', color: '#22C55E', label: 'Programmée' },
              ].map(({ key, color, label }) => {
                const points = chartPoints.map((p, i) => {
                  const x = 40 + (i / 25) * 470
                  const y = 20 + (1 - (p[key as keyof typeof p] as number) / maxPrice) * 180
                  return `${x},${y}`
                }).join(' ')
                return (
                  <g key={key}>
                    <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
                  </g>
                )
              })}
              {[0, 5, 10, 15, 20, 25].map(km => {
                const x = 40 + (km / 25) * 470
                return (
                  <g key={km}>
                    <line x1={x} y1="200" x2={x} y2="205" stroke="#cbd5e1" strokeWidth="1" />
                    <text x={x} y="214" textAnchor="middle" fontSize="9" fill="#94a3b8">{km}km</text>
                  </g>
                )
              })}
              {[
                { color: '#0A2E8A', label: 'Immédiate',  x: 50  },
                { color: '#E87722', label: 'Urgente',    x: 155 },
                { color: '#22C55E', label: 'Programmée', x: 255 },
              ].map(({ color, label, x }) => (
                <g key={label}>
                  <rect x={x} y="6" width="10" height="4" rx="2" fill={color} />
                  <text x={x + 13} y="12" fontSize="9" fill="#475569">{label}</text>
                </g>
              ))}
            </svg>
          </div>
          <p className="text-xs text-slate-400 mt-2">* Prix en XOF — Distance de 0 à 25 km</p>
        </div>
      )}

      {/* ── BARÈMES PAR TRANCHE ── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Ruler size={16} className="text-[#E87722]" /> Barèmes par tranche kilométrique
          </h3>
          <button
            onClick={() => setAddMode(!addMode)}
            className="flex items-center gap-1.5 px-3 py-2 bg-[#E87722] text-white rounded-xl text-xs font-bold hover:bg-[#d06a1a] transition-all"
          >
            <PlusCircle size={12} /> Ajouter
          </button>
        </div>

        {addMode && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { key: 'km_min',      label: 'Km min',       type: 'number', step: '0.5'  },
              { key: 'km_max',      label: 'Km max',       type: 'number', step: '0.5'  },
              { key: 'prix_par_km', label: 'Prix/km (XOF)', type: 'number', step: '10'  },
              { key: 'label',       label: 'Label',        type: 'text',   step: undefined },
              { key: 'ordre',       label: 'Ordre',        type: 'number', step: '1'    },
            ].map(f => (
              <div key={f.key}>
                <label className="text-xs font-bold text-amber-700 block mb-1">{f.label}</label>
                <input
                  type={f.type}
                  step={f.step}
                  value={(newBareme as unknown as Record<string, unknown>)[f.key] as string}
                  onChange={e => setNewBareme({
                    ...newBareme,
                    [f.key]: f.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value,
                  })}
                  className="w-full px-2 py-1.5 border border-amber-300 rounded-lg text-sm focus:outline-none focus:border-amber-500 bg-white"
                />
              </div>
            ))}
            <div className="col-span-full flex gap-2">
              <button
                onClick={handleAddBareme}
                disabled={saving}
                className="px-4 py-2 bg-[#E87722] text-white rounded-xl text-xs font-bold hover:bg-[#d06a1a] flex items-center gap-1.5 disabled:opacity-60"
              >
                {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />} Ajouter
              </button>
              <button
                onClick={() => setAddMode(false)}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200"
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Tranche</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Km min</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Km max</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Prix/km (XOF)</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Statut</th>
                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {[...baremes].sort((a, b) => a.ordre - b.ordre).map(b => (
                <>
                  <tr key={b.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-800 text-sm">{b.label}</p>
                      <p className="text-xs text-slate-400">Ordre {b.ordre}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 font-bold">{b.km_min} km</td>
                    <td className="px-4 py-3 text-sm text-slate-700 font-bold">{b.km_max} km</td>
                    <td className="px-4 py-3">
                      <span className="font-black text-[#E87722] text-base">{b.prix_par_km.toLocaleString('fr-FR')}</span>
                      <span className="text-slate-400 text-xs ml-1">XOF/km</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold ${b.actif ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                        {b.actif ? '✓ Actif' : '✗ Inactif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setEditBareme(editBareme?.id === b.id ? null : { ...b })}
                        className="px-2.5 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-blue-100 hover:text-blue-700 transition-all"
                      >
                        {editBareme?.id === b.id ? 'Annuler' : '✏️ Modifier'}
                      </button>
                    </td>
                  </tr>
                  {editBareme?.id === b.id && (
                    <tr key={`edit-${b.id}`}>
                      <td colSpan={6} className="px-4 py-4 bg-blue-50 border-b border-blue-100">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                          {[
                            { key: 'km_min',      label: 'Km min'         },
                            { key: 'km_max',      label: 'Km max'         },
                            { key: 'prix_par_km', label: 'Prix/km (XOF)'  },
                            { key: 'ordre',       label: 'Ordre'          },
                          ].map(f => (
                            <div key={f.key}>
                              <label className="text-xs font-bold text-blue-700 block mb-1">{f.label}</label>
                              <input
                                type="number"
                                step={f.key === 'prix_par_km' ? '10' : '0.5'}
                                value={(editBareme as unknown as Record<string, unknown>)[f.key] as number}
                                onChange={e => setEditBareme({ ...editBareme, [f.key]: parseFloat(e.target.value) || 0 })}
                                className="w-full px-2.5 py-2 border border-blue-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#0A2E8A]"
                              />
                            </div>
                          ))}
                          <div>
                            <label className="text-xs font-bold text-blue-700 block mb-1">Label</label>
                            <input
                              type="text"
                              value={editBareme.label}
                              onChange={e => setEditBareme({ ...editBareme, label: e.target.value })}
                              className="w-full px-2.5 py-2 border border-blue-200 rounded-lg text-sm bg-white focus:outline-none focus:border-[#0A2E8A]"
                            />
                          </div>
                          <div className="flex items-end">
                            <label className="flex items-center gap-2 cursor-pointer pb-2">
                              <input
                                type="checkbox"
                                checked={editBareme.actif}
                                onChange={e => setEditBareme({ ...editBareme, actif: e.target.checked })}
                                className="w-4 h-4"
                              />
                              <span className="text-xs font-bold text-blue-700">Actif</span>
                            </label>
                          </div>
                        </div>
                        <button
                          onClick={() => saveBareme(editBareme)}
                          disabled={savingTarif === b.id}
                          className="px-4 py-2 bg-[#0A2E8A] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 hover:bg-[#0d38a5] disabled:opacity-60"
                        >
                          {savingTarif === b.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={12} />}
                          Enregistrer
                        </button>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {baremes.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-sm">Aucun barème configuré</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── CONFIGURATION GLOBALE ── */}
      {configTarif && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
          <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp size={16} className="text-[#0A2E8A]" /> Paramètres globaux
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(CONFIG_LABELS)
              .filter(([key]) => key in configTarif)
              .map(([key, meta]) => (
                <div key={key} className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-1">
                    <label className="text-xs font-bold text-slate-600">{meta.label}</label>
                    <span title={meta.desc} className="cursor-help">
                      <Info size={10} className="text-slate-400" />
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mb-2">{meta.desc}</p>
                  {key === 'pluie_actif' ? (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={configTarif.pluie_actif}
                        onChange={e => setConfigTarif({ ...configTarif, pluie_actif: e.target.checked })}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-bold text-slate-700">
                        {configTarif.pluie_actif ? 'Activé 🌧️' : 'Désactivé'}
                      </span>
                    </label>
                  ) : (
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={(configTarif as unknown as Record<string, unknown>)[key] as number}
                        onChange={e => setConfigTarif({ ...configTarif, [key]: parseFloat(e.target.value) || 0 })}
                        className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:border-[#0A2E8A] bg-white"
                      />
                      {meta.unit && <span className="text-xs text-slate-500 shrink-0">{meta.unit}</span>}
                    </div>
                  )}
                </div>
              ))}
          </div>
          <button
            onClick={saveConfig}
            disabled={savingTarif === 'config'}
            className="mt-5 px-5 py-2.5 bg-[#0A2E8A] text-white rounded-xl text-sm font-bold hover:bg-[#0d38a5] transition-all flex items-center gap-2 disabled:opacity-60"
          >
            {savingTarif === 'config' ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
            Sauvegarder la configuration
          </button>
        </div>
      )}
    </div>
  )
}

// ── Composant principal ────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter()
  const [adminUser, setAdminUser]     = useState<any>(null)
  const [partenaires, setPartenaires] = useState<PartenaireAdmin[]>([])
  const [coursiers, setCoursiers]     = useState<CoursierAdmin[]>([])
  const [clients, setClients]         = useState<ClientAdmin[]>([])
  const [livraisons, setLivraisons]   = useState<LivraisonAdmin[]>([])
  const [wallets, setWallets]         = useState<WalletAdmin[]>([])
  const [loading, setLoading]         = useState(true)
  const [refreshing, setRefreshing]   = useState(false)
  const [onglet, setOnglet]           = useState('overview')
  const [recherche, setRecherche]     = useState('')
  const [error, setError]             = useState('')
  const [success, setSuccess]         = useState('')

  const [formPartenaire, setFormPartenaire] = useState({
    entreprise: '', nom_contact: '', email: '', telephone: '', plan: 'starter', adresse: '',
  })
  const [formAdmin, setFormAdmin] = useState({ email: '', nom: '' })
  const [creating, setCreating]   = useState(false)

  const [modalPaiement, setModalPaiement] = useState<{
    coursier: CoursierAdmin | null; montant: string; description: string
  }>({ coursier: null, montant: '', description: '' })

  const [openDoc, setOpenDoc] = useState<string | null>(null)

  const [baremes, setBaremes]           = useState<BaremeAdmin[]>([])
  const [configTarif, setConfigTarif]   = useState<ConfigAdmin | null>(null)
  const [loadingTarifs, setLoadingTarifs] = useState(false)
  const [savingTarif, setSavingTarif]   = useState<string | null>(null)
  const [editBareme, setEditBareme]     = useState<BaremeAdmin | null>(null)

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

  // ── Auth & Chargement ──────────────────────────────────────────────────────
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
        supabase.from('partenaires').select('*').order('created_at', { ascending: false }),
        supabase.from('coursiers')
          .select('*, utilisateurs(nom, email, telephone)')
          .order('created_at', { ascending: false }),
        supabase.from('utilisateurs')
          .select('id, nom, email, telephone, est_actif, est_verifie, created_at')
          .eq('role', 'client')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('livraisons')
          .select('*, client:utilisateurs!livraisons_client_id_fkey(nom), coursier:utilisateurs!livraisons_coursier_id_fkey(nom)')
          .order('created_at', { ascending: false })
          .limit(100),
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

  // ── Tarification ───────────────────────────────────────────────────────────
  const loadTarifs = useCallback(async () => {
    setLoadingTarifs(true)
    try {
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      const res  = await fetch('/api/admin/tarifs', {
        headers: { 'Authorization': `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.baremes) setBaremes(data.baremes)
      if (data.config)  setConfigTarif(data.config)
    } catch (err: any) {
      setError('Erreur chargement tarifs: ' + err.message)
    } finally {
      setLoadingTarifs(false)
    }
  }, [])

  const saveBareme = async (bareme: BaremeAdmin) => {
    setSavingTarif(bareme.id)
    try {
      const session = await supabase.auth.getSession()
      const token   = session.data.session?.access_token
      const res = await fetch('/api/admin/tarifs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ type: 'bareme', id: bareme.id, data: bareme }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess(`Barème "${bareme.label}" mis à jour`)
      setEditBareme(null)
      loadTarifs()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingTarif(null)
    }
  }

  const saveConfig = async () => {
    if (!configTarif) return
    setSavingTarif('config')
    try {
      const session = await supabase.auth.getSession()
      const token   = session.data.session?.access_token
      const res = await fetch('/api/admin/tarifs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ type: 'config', data: configTarif }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSuccess('Configuration tarifaire mise à jour')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSavingTarif(null)
    }
  }

  useEffect(() => {
    if (onglet === 'tarification' && baremes.length === 0) {
      loadTarifs()
    }
  }, [onglet, loadTarifs])

  // ── Actions partenaires ────────────────────────────────────────────────────
  const updateStatutPartenaire = async (id: string, statut: string) => {
    setError(''); setSuccess('')
    const { error: err } = await supabase
      .from('partenaires').update({ statut, updated_at: new Date().toISOString() }).eq('id', id)
    if (err) setError(err.message)
    else { setSuccess(`Statut partenaire mis à jour : ${statut}`); loadData() }
  }

  // ── Actions coursiers ──────────────────────────────────────────────────────
  const validerCoursier = async (id: string, statut: string) => {
    setError(''); setSuccess('')
    const { error: err } = await supabase
      .from('coursiers').update({ statut_verification: statut }).eq('id', id)
    if (err) setError(err.message)
    else { setSuccess(`Coursier ${statut === 'verifie' ? 'vérifié' : 'rejeté'} avec succès`); loadData() }
  }

  // ── Paiement coursier ──────────────────────────────────────────────────────
  const payerCoursier = async () => {
    if (!modalPaiement.coursier || !modalPaiement.montant) return
    setCreating(true); setError('')
    try {
      const session = await supabase.auth.getSession()
      const token   = session.data.session?.access_token
      const res = await fetch('/api/admin/payer-coursier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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

  // ── Actions clients ────────────────────────────────────────────────────────
  const toggleClientActif = async (id: string, actif: boolean) => {
    setError(''); setSuccess('')
    const { error: err } = await supabase
      .from('utilisateurs').update({ est_actif: actif, updated_at: new Date().toISOString() }).eq('id', id)
    if (err) setError(err.message)
    else { setSuccess(`Client ${actif ? 'activé' : 'désactivé'}`); loadData() }
  }

  // ── Création partenaire ────────────────────────────────────────────────────
  const handleCreatePartenaire = async (e: React.FormEvent) => {
    e.preventDefault(); setCreating(true); setError(''); setSuccess('')
    try {
      const session = await supabase.auth.getSession()
      const token   = session.data.session?.access_token
      const res = await fetch('/api/admin/create-partenaire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(formPartenaire),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erreur création')
      setSuccess('✅ Partenaire créé et email envoyé !')
      setFormPartenaire({ entreprise: '', nom_contact: '', email: '', telephone: '', plan: 'starter', adresse: '' })
      loadData()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  // ── Promotion admin ────────────────────────────────────────────────────────
  const handlePromoteAdmin = async (e: React.FormEvent) => {
    e.preventDefault(); setCreating(true); setError(''); setSuccess('')
    try {
      const session = await supabase.auth.getSession()
      const token   = session.data.session?.access_token
      const res = await fetch('/api/admin/create-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
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

  // ── Filtres ────────────────────────────────────────────────────────────────
  const partsFiltered = partenaires.filter(p =>
    recherche === '' ||
    p.entreprise.toLowerCase().includes(recherche.toLowerCase()) ||
    p.nom_contact.toLowerCase().includes(recherche.toLowerCase()) ||
    (p.email_pro || '').toLowerCase().includes(recherche.toLowerCase())
  )

  const coursFiltered = coursiers.filter(c =>
    recherche === '' ||
    (c.nom   || '').toLowerCase().includes(recherche.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(recherche.toLowerCase())
  )

  const clientsFiltered = clients.filter(c =>
    recherche === '' ||
    c.nom.toLowerCase().includes(recherche.toLowerCase()) ||
    c.email.toLowerCase().includes(recherche.toLowerCase())
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-[#0A2E8A]" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* ── Navbar ── */}
      <nav className="bg-[#0A2E8A] sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-2">
              <Zap size={20} className="text-[#E87722]" />
              <span className="font-black text-white text-lg tracking-tight">NYME ADMIN</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadData}
                className="flex items-center gap-1.5 text-sm text-white/70 hover:text-white transition-colors"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              </button>
              <span className="text-white/80 text-sm font-medium hidden sm:block">{adminUser?.nom}</span>
              <button
                onClick={async () => { await supabase.auth.signOut(); router.replace('/admin-x9k2m/login') }}
                className="flex items-center gap-1.5 text-sm text-red-300 hover:text-red-100 transition-colors"
              >
                <LogOut size={16} /> Quitter
              </button>
            </div>
          </div>

          {/* Onglets */}
          <div className="flex overflow-x-auto gap-0 scrollbar-hide -mb-px">
            {ONGLETS.map(o => (
              <button
                key={o.id}
                onClick={() => { setOnglet(o.id); setRecherche('') }}
                className={`flex items-center gap-1.5 py-3 px-3 text-xs font-semibold border-b-2 transition-all whitespace-nowrap ${
                  onglet === o.id
                    ? 'border-[#E87722] text-[#E87722]'
                    : 'border-transparent text-white/60 hover:text-white'
                }`}
              >
                <o.icon size={14} />
                {o.label}
                {o.id === 'partenaires' && stats.partenaires_attente > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-amber-500 text-white rounded-full text-[10px] font-black">
                    {stats.partenaires_attente}
                  </span>
                )}
                {o.id === 'coursiers' && stats.coursiers_attente > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 bg-rose-500 text-white rounded-full text-[10px] font-black">
                    {stats.coursiers_attente}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* ── Main ── */}
      <main className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Alertes globales */}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2"><AlertCircle size={16} />{error}</div>
            <X size={16} className="cursor-pointer shrink-0" onClick={() => setError('')} />
          </div>
        )}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2"><CheckCircle2 size={16} />{success}</div>
            <X size={16} className="cursor-pointer shrink-0" onClick={() => setSuccess('')} />
          </div>
        )}

        {/* ── VUE GÉNÉRALE ── */}
        {onglet === 'overview' && (
          <div className="space-y-6">
            <h1 className="text-2xl font-black text-[#0A2E8A]">Vue générale</h1>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { label: 'Partenaires',       value: stats.partenaires_total,                            sub: `${stats.partenaires_actifs} actifs`,   icon: Building2, color: 'bg-blue-600'   },
                { label: 'Coursiers',          value: stats.coursiers_total,                              sub: `${stats.coursiers_verifies} vérifiés`, icon: Truck,     color: 'bg-orange-500' },
                { label: 'Clients',            value: stats.clients_total,                                sub: `${stats.clients_actifs} actifs`,       icon: Users,     color: 'bg-green-600'  },
                { label: 'Livraisons',         value: stats.livraisons_total,                             sub: 'Ce mois',                              icon: Package,   color: 'bg-purple-600' },
                { label: 'CA Estimé (FCFA)',   value: stats.ca_total.toLocaleString('fr-FR'),             sub: 'Total',                                icon: TrendingUp,color: 'bg-teal-600'   },
                { label: 'Soldes Wallets',     value: stats.wallets_total_solde.toLocaleString('fr-FR'),  sub: 'FCFA total',                           icon: Wallet,    color: 'bg-indigo-600' },
                { label: 'En attente',         value: stats.partenaires_attente,                          sub: 'Partenaires',                          icon: Clock,     color: 'bg-amber-500'  },
                { label: 'Docs à vérifier',   value: stats.coursiers_attente,                            sub: 'Coursiers',                            icon: FileCheck, color: 'bg-rose-500'   },
              ].map((card, i) => (
                <div key={i} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${card.color} text-white shrink-0`}>
                    <card.icon size={18} />
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
                  <AlertTriangle size={16} /> {stats.partenaires_attente} partenaire(s) en attente de validation
                </h3>
                <div className="space-y-2">
                  {partenaires.filter(p => p.statut === 'en_attente').slice(0, 5).map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{p.entreprise}</p>
                        <p className="text-slate-500 text-xs">{p.nom_contact} • {p.email_pro}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateStatutPartenaire(p.id, 'actif')}
                          className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold hover:bg-green-600 hover:text-white transition-all"
                        >
                          ✓ Valider
                        </button>
                        <button
                          onClick={() => updateStatutPartenaire(p.id, 'rejete')}
                          className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-all"
                        >
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
                  <FileCheck size={16} /> {stats.coursiers_attente} coursier(s) avec documents à vérifier
                </h3>
                <div className="space-y-2">
                  {coursiers.filter(c => c.statut_verification === 'en_attente').slice(0, 5).map(c => (
                    <div key={c.id} className="flex items-center justify-between bg-white rounded-xl p-3 shadow-sm">
                      <div>
                        <p className="font-bold text-slate-800 text-sm">{c.nom}</p>
                        <p className="text-slate-500 text-xs">{c.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => validerCoursier(c.id, 'verifie')}
                          className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-xs font-bold hover:bg-green-600 hover:text-white transition-all"
                        >
                          ✓ Vérifier
                        </button>
                        <button
                          onClick={() => validerCoursier(c.id, 'rejete')}
                          className="px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-all"
                        >
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
            <button onClick={() => setOnglet('overview')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0A2E8A] font-semibold transition-colors">
              <ArrowDownLeft size={15} /> Retour
            </button>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-[#0A2E8A]">Partenaires ({partenaires.length})</h2>
              <button
                onClick={() => setOnglet('creation')}
                className="flex items-center gap-2 px-4 py-2 bg-[#0A2E8A] text-white rounded-xl text-sm font-bold hover:bg-[#0d38a5] transition-all"
              >
                <Plus size={16} /> Nouveau
              </button>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text" placeholder="Rechercher..." value={recherche}
                onChange={e => setRecherche(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#0A2E8A] text-sm"
              />
            </div>
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
                        <td className="px-5 py-4"><Badge statut={p.statut} /></td>
                        <td className="px-5 py-4">
                          <p className="text-sm font-bold text-slate-700">{p.livraisons_mois}/{p.livraisons_max}</p>
                          <div className="w-16 h-1.5 bg-slate-100 rounded-full mt-1">
                            <div
                              className="h-full bg-[#0A2E8A] rounded-full"
                              style={{ width: `${Math.min(100, (p.livraisons_mois / p.livraisons_max) * 100)}%` }}
                            />
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex flex-wrap gap-1.5">
                            {p.statut !== 'actif' && (
                              <button
                                onClick={() => updateStatutPartenaire(p.id, 'actif')}
                                className="px-2.5 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-600 hover:text-white transition-all flex items-center gap-1"
                              >
                                <UserCheck size={11} /> Activer
                              </button>
                            )}
                            {p.statut !== 'suspendu' && (
                              <button
                                onClick={() => updateStatutPartenaire(p.id, 'suspendu')}
                                className="px-2.5 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-all flex items-center gap-1"
                              >
                                <Ban size={11} /> Suspendre
                              </button>
                            )}
                            {p.statut !== 'rejete' && (
                              <button
                                onClick={() => updateStatutPartenaire(p.id, 'rejete')}
                                className="px-2.5 py-1.5 bg-gray-50 text-gray-700 rounded-lg text-xs font-bold hover:bg-gray-600 hover:text-white transition-all flex items-center gap-1"
                              >
                                <XCircle size={11} /> Rejeter
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
            <button onClick={() => setOnglet('overview')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0A2E8A] font-semibold transition-colors">
              <ArrowDownLeft size={15} /> Retour
            </button>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-[#0A2E8A]">Coursiers ({coursiers.length})</h2>
              <div className="flex gap-2 text-xs">
                <span className="px-2.5 py-1 bg-green-100 text-green-700 rounded-full font-bold">{stats.coursiers_verifies} vérifiés</span>
                <span className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-full font-bold">{stats.coursiers_attente} en attente</span>
              </div>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text" placeholder="Rechercher un coursier..." value={recherche}
                onChange={e => setRecherche(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#0A2E8A] text-sm"
              />
            </div>
            <div className="space-y-3">
              {coursFiltered.map(c => (
                <div key={c.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                  <div className="p-5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
                        <User size={18} className="text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-bold text-slate-800">{c.nom}</p>
                          <Badge statut={c.statut_verification} />
                          <Badge statut={c.statut} />
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{c.email} • {c.telephone}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {c.total_courses || 0} courses • Gains: {(c.total_gains || 0).toLocaleString('fr-FR')} FCFA
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 shrink-0">
                      <button
                        onClick={() => setOpenDoc(openDoc === c.id ? null : c.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-bold hover:bg-blue-100 hover:text-blue-700 transition-all"
                      >
                        <Eye size={12} /> Docs
                        {openDoc === c.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                      {c.statut_verification !== 'verifie' && (
                        <button
                          onClick={() => validerCoursier(c.id, 'verifie')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-600 hover:text-white transition-all"
                        >
                          <UserCheck size={12} /> Vérifier
                        </button>
                      )}
                      {c.statut_verification !== 'rejete' && (
                        <button
                          onClick={() => validerCoursier(c.id, 'rejete')}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-700 rounded-lg text-xs font-bold hover:bg-red-600 hover:text-white transition-all"
                        >
                          <XCircle size={12} /> Rejeter
                        </button>
                      )}
                      <button
                        onClick={() => setModalPaiement({ coursier: c, montant: '', description: '' })}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-50 text-orange-700 rounded-lg text-xs font-bold hover:bg-orange-500 hover:text-white transition-all"
                      >
                        <DollarSign size={12} /> Payer
                      </button>
                    </div>
                  </div>
                  {openDoc === c.id && (
                    <div className="border-t border-slate-100 px-5 py-4 bg-slate-50 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { label: 'CNI Recto', url: c.cni_recto_url },
                        { label: 'CNI Verso', url: c.cni_verso_url },
                        { label: 'Permis',    url: c.permis_url    },
                      ].map(doc => (
                        <div key={doc.label} className="bg-white rounded-xl border border-slate-200 p-3">
                          <p className="text-xs font-bold text-slate-500 mb-2">{doc.label}</p>
                          {doc.url ? (
                            <a href={doc.url} target="_blank" rel="noreferrer"
                              className="text-xs text-blue-600 underline hover:text-blue-800">
                              Voir le document
                            </a>
                          ) : (
                            <p className="text-xs text-slate-400 italic">Non fourni</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {coursFiltered.length === 0 && (
                <div className="text-center py-10 text-slate-400 text-sm">Aucun coursier trouvé</div>
              )}
            </div>
          </div>
        )}

        {/* ── CLIENTS ── */}
        {onglet === 'clients' && (
          <div className="space-y-5">
            <button onClick={() => setOnglet('overview')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0A2E8A] font-semibold transition-colors">
              <ArrowDownLeft size={15} /> Retour
            </button>
            <h2 className="text-xl font-black text-[#0A2E8A]">Clients ({clients.length})</h2>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text" placeholder="Rechercher un client..." value={recherche}
                onChange={e => setRecherche(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:outline-none focus:border-[#0A2E8A] text-sm"
              />
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
                          <Badge statut={c.est_actif ? 'actif' : 'suspendu'} />
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-400">
                          {new Date(c.created_at).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="px-5 py-4">
                          <button
                            onClick={() => toggleClientActif(c.id, !c.est_actif)}
                            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                              c.est_actif
                                ? 'bg-red-50 text-red-700 hover:bg-red-600 hover:text-white'
                                : 'bg-green-50 text-green-700 hover:bg-green-600 hover:text-white'
                            }`}
                          >
                            {c.est_actif ? <><Ban size={11} /> Désactiver</> : <><UserCheck size={11} /> Activer</>}
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
            <button onClick={() => setOnglet('overview')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0A2E8A] font-semibold transition-colors">
              <ArrowDownLeft size={15} /> Retour
            </button>
            <h2 className="text-xl font-black text-[#0A2E8A]">Courses ({livraisons.length})</h2>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[800px]">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Client</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Coursier</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Trajet</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Statut</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Prix</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {livraisons.map(l => (
                      <tr key={l.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4 text-sm font-bold text-slate-800">{l.client_nom}</td>
                        <td className="px-5 py-4 text-sm text-slate-600">{l.coursier_nom}</td>
                        <td className="px-5 py-4 max-w-[200px]">
                          <p className="text-xs text-slate-600 truncate">{l.depart_adresse}</p>
                          <p className="text-xs text-slate-400 truncate">→ {l.arrivee_adresse}</p>
                        </td>
                        <td className="px-5 py-4"><Badge statut={l.statut} /></td>
                        <td className="px-5 py-4 text-sm font-bold text-slate-700">
                          {(l.prix_final || 0).toLocaleString('fr-FR')} FCFA
                        </td>
                        <td className="px-5 py-4 text-xs text-slate-400">
                          {new Date(l.created_at).toLocaleDateString('fr-FR')}
                        </td>
                      </tr>
                    ))}
                    {livraisons.length === 0 && (
                      <tr><td colSpan={6} className="px-5 py-10 text-center text-slate-400 text-sm">Aucune course</td></tr>
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
            <button onClick={() => setOnglet('overview')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0A2E8A] font-semibold transition-colors">
              <ArrowDownLeft size={15} /> Retour
            </button>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-[#0A2E8A]">Wallet / Finances</h2>
              <div className="text-sm font-bold text-slate-600">
                Total en circulation:{' '}
                <span className="text-[#0A2E8A]">{stats.wallets_total_solde.toLocaleString('fr-FR')} FCFA</span>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left min-w-[700px]">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Utilisateur</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Rôle</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Solde</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Total Gains</th>
                      <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase">Total Retraits</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {wallets.map(w => (
                      <tr key={w.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-800 text-sm">{w.utilisateur?.nom || '—'}</p>
                          <p className="text-xs text-slate-400">{w.utilisateur?.email || '—'}</p>
                        </td>
                        <td className="px-5 py-4">
                          <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-bold capitalize">
                            {w.utilisateur?.role || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-sm font-bold text-green-700">
                          {(w.solde || 0).toLocaleString('fr-FR')} FCFA
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          {(w.total_gains || 0).toLocaleString('fr-FR')} FCFA
                        </td>
                        <td className="px-5 py-4 text-sm text-slate-600">
                          {(w.total_retraits || 0).toLocaleString('fr-FR')} FCFA
                        </td>
                      </tr>
                    ))}
                    {wallets.length === 0 && (
                      <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400 text-sm">Aucun wallet</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── TARIFICATION ── */}
        {onglet === 'tarification' && (
          <div className="space-y-5">
            <button onClick={() => setOnglet('overview')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0A2E8A] font-semibold transition-colors">
              <ArrowDownLeft size={15} /> Retour
            </button>
            <TarificationPanel
              baremes={baremes}
              configTarif={configTarif}
              loadingTarifs={loadingTarifs}
              savingTarif={savingTarif}
              editBareme={editBareme}
              setEditBareme={setEditBareme}
              saveBareme={saveBareme}
              saveConfig={saveConfig}
              setConfigTarif={setConfigTarif}
              loadTarifs={loadTarifs}
              token={adminUser?.access_token}
            />
          </div>
        )}

        {/* ── ACTIONS ADMIN ── */}
        {onglet === 'creation' && (
          <div className="space-y-6 max-w-2xl">
            <button onClick={() => setOnglet('overview')} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-[#0A2E8A] font-semibold transition-colors">
              <ArrowDownLeft size={15} /> Retour
            </button>
            <h2 className="text-xl font-black text-[#0A2E8A]">Actions Admin</h2>

            {/* Créer partenaire */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Building2 size={16} className="text-[#0A2E8A]" /> Créer un partenaire
              </h3>
              <form onSubmit={handleCreatePartenaire} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Entreprise *</label>
                    <input
                      type="text" required value={formPartenaire.entreprise}
                      onChange={e => setFormPartenaire({ ...formPartenaire, entreprise: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0A2E8A]"
                      placeholder="Nom entreprise"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Contact *</label>
                    <input
                      type="text" required value={formPartenaire.nom_contact}
                      onChange={e => setFormPartenaire({ ...formPartenaire, nom_contact: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0A2E8A]"
                      placeholder="Nom du contact"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Email *</label>
                    <input
                      type="email" required value={formPartenaire.email}
                      onChange={e => setFormPartenaire({ ...formPartenaire, email: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0A2E8A]"
                      placeholder="email@entreprise.com"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Téléphone</label>
                    <input
                      type="tel" value={formPartenaire.telephone}
                      onChange={e => setFormPartenaire({ ...formPartenaire, telephone: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0A2E8A]"
                      placeholder="+226 XX XX XX XX"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Plan *</label>
                    <select
                      value={formPartenaire.plan}
                      onChange={e => setFormPartenaire({ ...formPartenaire, plan: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0A2E8A] bg-white"
                    >
                      <option value="starter">Starter</option>
                      <option value="business">Business</option>
                      <option value="enterprise">Enterprise</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 block mb-1">Adresse</label>
                    <input
                      type="text" value={formPartenaire.adresse}
                      onChange={e => setFormPartenaire({ ...formPartenaire, adresse: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0A2E8A]"
                      placeholder="Adresse"
                    />
                  </div>
                </div>
                <button
                  type="submit" disabled={creating}
                  className="w-full py-3 bg-[#0A2E8A] text-white rounded-xl font-bold hover:bg-[#0d38a5] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {creating ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                  Créer le partenaire
                </button>
              </form>
            </div>

            {/* Promouvoir admin */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
              <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#0A2E8A]" /> Promouvoir en Admin
              </h3>
              <form onSubmit={handlePromoteAdmin} className="space-y-3">
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Email *</label>
                  <input
                    type="email" required value={formAdmin.email}
                    onChange={e => setFormAdmin({ ...formAdmin, email: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0A2E8A]"
                    placeholder="email@exemple.com"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 block mb-1">Nom</label>
                  <input
                    type="text" value={formAdmin.nom}
                    onChange={e => setFormAdmin({ ...formAdmin, nom: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-[#0A2E8A]"
                    placeholder="Nom complet"
                  />
                </div>
                <button
                  type="submit" disabled={creating}
                  className="w-full py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 transition-all flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {creating ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Promouvoir Admin
                </button>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* ── Modal Paiement Coursier ── */}
      {modalPaiement.coursier && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-black text-slate-800 text-lg">
                Payer {modalPaiement.coursier.nom}
              </h3>
              <button
                onClick={() => setModalPaiement({ coursier: null, montant: '', description: '' })}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Montant (FCFA) *</label>
                <input
                  type="number" min="1" value={modalPaiement.montant}
                  onChange={e => setModalPaiement({ ...modalPaiement, montant: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0A2E8A] text-lg font-bold"
                  placeholder="Ex: 5000"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-500 block mb-1">Description</label>
                <input
                  type="text" value={modalPaiement.description}
                  onChange={e => setModalPaiement({ ...modalPaiement, description: e.target.value })}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0A2E8A]"
                  placeholder="Paiement semaine, bonus..."
                />
              </div>
              <button
                onClick={payerCoursier}
                disabled={creating || !modalPaiement.montant}
                className="w-full py-3 bg-[#E87722] text-white rounded-xl font-bold hover:bg-[#d06a1a] transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {creating ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                Envoyer le paiement
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
