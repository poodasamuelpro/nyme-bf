// src/components/shared/StatutTimeline.tsx — NOUVEAU FICHIER
// Timeline de progression livraison réutilisable (client + coursier)
// Affiche l'historique des changements de statut depuis statuts_livraison
'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { StatutLivraison } from '@/lib/supabase'
import { CheckCircle, Circle, Clock } from 'lucide-react'

const ETAPES: Array<{ statut: string; label: string; emoji: string; desc: string }> = [
  { statut: 'en_attente',       label: 'Demande créée',      emoji: '🕐', desc: 'En attente d\'un coursier' },
  { statut: 'acceptee',         label: 'Coursier assigné',   emoji: '✅', desc: 'Coursier accepté la mission' },
  { statut: 'en_rout_depart',   label: 'En route',           emoji: '🛵', desc: 'Coursier en route vers le colis' },
  { statut: 'colis_recupere',   label: 'Colis récupéré',     emoji: '📦', desc: 'Colis pris en charge' },
  { statut: 'en_route_arrivee', label: 'En livraison',       emoji: '🚀', desc: 'En route vers la destination' },
  { statut: 'livree',           label: 'Livraison effectuée', emoji: '🎉', desc: 'Livraison confirmée' },
]

const fDateHeure = (d: string) =>
  new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(new Date(d))

interface Props {
  livraisonId:    string
  statutActuel:   string
}

export default function StatutTimeline({ livraisonId, statutActuel }: Props) {
  const [historique, setHistorique] = useState<StatutLivraison[]>([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('statuts_livraison')
        .select('*')
        .eq('livraison_id', livraisonId)
        .order('changed_at', { ascending: true })
      setHistorique((data || []) as StatutLivraison[])
      setLoading(false)
    }
    load()
  }, [livraisonId])

  const currentIndex = ETAPES.findIndex(e => e.statut === statutActuel)
  const isAnnulee    = statutActuel === 'annulee'

  const getChangedAt = (statut: string): string | null => {
    const found = historique.find(h => h.statut === statut)
    return found ? found.changed_at : null
  }

  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4">
      <div className="animate-pulse space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-gray-200" />
            <div className="flex-1 h-4 bg-gray-200 rounded" />
          </div>
        ))}
      </div>
    </div>
  )

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-50">
        <h3 className="font-bold text-gray-900 text-sm">Progression de la livraison</h3>
      </div>

      <div className="p-4 space-y-0">
        {isAnnulee ? (
          <div className="flex items-center gap-3 py-3 bg-red-50 rounded-xl px-4">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-500 text-lg">❌</div>
            <div>
              <p className="font-bold text-red-800 text-sm">Livraison annulée</p>
              <p className="text-xs text-red-500">{getChangedAt('annulee') ? fDateHeure(getChangedAt('annulee')!) : '—'}</p>
            </div>
          </div>
        ) : ETAPES.map((etape, idx) => {
          const isPast    = idx < currentIndex
          const isCurrent = idx === currentIndex
          const isFuture  = idx > currentIndex
          const changedAt = getChangedAt(etape.statut)
          const isLast    = idx === ETAPES.length - 1

          return (
            <div key={etape.statut} className="relative flex items-start gap-3">
              {/* Ligne verticale */}
              {!isLast && (
                <div className={`absolute left-3.5 top-7 w-0.5 h-6 ${isPast || isCurrent ? 'bg-blue-300' : 'bg-gray-200'}`} />
              )}

              {/* Icône statut */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 border-2 transition-all ${
                isPast
                  ? 'bg-green-500 border-green-500'
                  : isCurrent
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white'
              }`}>
                {isPast ? (
                  <CheckCircle size={14} className="text-white" />
                ) : isCurrent ? (
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
                ) : (
                  <Circle size={12} className="text-gray-300" />
                )}
              </div>

              {/* Contenu */}
              <div className={`flex-1 pb-5 ${isFuture ? 'opacity-40' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`text-sm font-bold ${isCurrent ? 'text-blue-700' : isPast ? 'text-gray-900' : 'text-gray-400'}`}>
                      {etape.emoji} {etape.label}
                    </p>
                    {isCurrent && (
                      <p className="text-xs text-blue-500 mt-0.5">{etape.desc}</p>
                    )}
                  </div>
                  {changedAt && (
                    <span className="text-[10px] text-gray-400 shrink-0 ml-2 mt-0.5">
                      {fDateHeure(changedAt)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}