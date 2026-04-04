// src/app/client/propositions/[id]/page.tsx
// Négociation de prix style InDrive — le client voit les propositions des coursiers
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Livraison, Utilisateur } from '@/lib/supabase'
import { ArrowLeft, Star, MapPin, Clock, Check, X, TrendingUp, TrendingDown } from 'lucide-react'
import toast from 'react-hot-toast'

interface Proposition {
  id: string
  livraison_id: string
  auteur_id: string
  role_auteur: 'client' | 'coursier'
  montant: number
  statut: 'en_attente' | 'accepte' | 'refuse'
  created_at: string
  auteur?: {
    nom: string | null
    avatar_url: string | null
    note_moyenne: number
    total_courses: number
  }
}

export default function PropositionsPage() {
  const params = useParams()
  const router = useRouter()
  const livraisonId = params.id as string

  const [userId,       setUserId]       = useState<string | null>(null)
  const [livraison,    setLivraison]    = useState<Livraison | null>(null)
  const [propositions, setPropositions] = useState<Proposition[]>([])
  const [loading,      setLoading]      = useState(true)
  const [accepting,    setAccepting]    = useState<string | null>(null)
  const [maProposition, setMaProposition] = useState('')
  const [submitting,   setSubmitting]   = useState(false)

  const fXOF = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' XOF'

  const loadData = useCallback(async (uid: string) => {
    // Charger la livraison
    const { data: liv } = await supabase
      .from('livraisons')
      .select('*, coursier:coursier_id(id, nom, avatar_url, note_moyenne, telephone)')
      .eq('id', livraisonId).single()
    if (!liv || liv.client_id !== uid) { router.replace('/client/dashboard'); return }
    setLivraison(liv as Livraison)

    // Charger les propositions avec infos auteur
    const { data: props } = await supabase
      .from('propositions_prix')
      .select(`*, auteur:auteur_id(nom, avatar_url)`)
      .eq('livraison_id', livraisonId)
      .order('created_at', { ascending: false })

    if (props && props.length > 0) {
      // Enrichir avec les stats coursier
      const coursierIds = props.filter((p: any) => p.role_auteur === 'coursier').map((p: any) => p.auteur_id)
      let coursierStats: Record<string, { note_moyenne: number; total_courses: number }> = {}
      if (coursierIds.length > 0) {
        const { data: stats } = await supabase.from('coursiers').select('id, note_moyenne, total_courses').in('id', coursierIds)
        if (stats) stats.forEach((s: any) => { coursierStats[s.id] = s })
      }
      setPropositions(props.map((p: any) => ({
        ...p,
        auteur: {
          ...p.auteur,
          note_moyenne: coursierStats[p.auteur_id]?.note_moyenne || 0,
          total_courses: coursierStats[p.auteur_id]?.total_courses || 0,
        }
      })))
    } else setPropositions([])
  }, [livraisonId, router])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: u } = await supabase.from('utilisateurs').select('role').eq('id', session.user.id).single()
      if (!u || u.role !== 'client') { router.replace('/login'); return }
      setUserId(session.user.id)
      await loadData(session.user.id)
      setLoading(false)
    }
    init()

    // Realtime — nouvelles propositions en temps réel
    const channel = supabase.channel(`propositions-${livraisonId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'propositions_prix', filter: `livraison_id=eq.${livraisonId}` },
        async () => {
          const session = await supabase.auth.getSession()
          if (session.data.session) await loadData(session.data.session.user.id)
          toast('Nouvelle proposition reçue !', { icon: '🛵' })
        })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [livraisonId, router, loadData])

  // Client propose/modifie son prix
  const handleMaProposition = async () => {
    if (!userId || !livraison) return
    const montant = parseFloat(maProposition)
    if (!montant || montant < 500) { toast.error('Montant minimum 500 XOF'); return }
    setSubmitting(true)
    try {
      // Refuser les anciennes propositions client
      await supabase.from('propositions_prix').update({ statut: 'refuse' })
        .eq('livraison_id', livraisonId).eq('auteur_id', userId).eq('statut', 'en_attente')

      const { error } = await supabase.from('propositions_prix').insert({
        livraison_id: livraisonId,
        auteur_id: userId,
        role_auteur: 'client',
        montant,
        statut: 'en_attente',
      })
      if (error) throw error
      toast.success('Proposition envoyée !')
      setMaProposition('')
      await loadData(userId)
    } catch (err: unknown) {
      toast.error('Erreur envoi proposition')
    } finally { setSubmitting(false) }
  }

  // Client accepte une proposition d'un coursier
  const handleAccepter = async (proposition: Proposition) => {
    if (!userId || !livraison) return
    setAccepting(proposition.id)
    try {
      // 1. Marquer proposition comme acceptée
      const { error: e1 } = await supabase.from('propositions_prix').update({ statut: 'accepte' }).eq('id', proposition.id)
      if (e1) throw e1

      // 2. Mettre à jour le prix final de la livraison + assigner le coursier
      const { error: e2 } = await supabase.from('livraisons').update({
        prix_final: proposition.montant,
        coursier_id: proposition.auteur_id,
        statut: 'acceptee',
      }).eq('id', livraisonId)
      if (e2) throw e2

      // 3. Refuser toutes les autres
      await supabase.from('propositions_prix').update({ statut: 'refuse' })
        .eq('livraison_id', livraisonId).neq('id', proposition.id).eq('statut', 'en_attente')

      // 4. Notifier le coursier
      await supabase.from('notifications').insert({
        user_id: proposition.auteur_id,
        type: 'course_acceptee',
        titre: '🎉 Course acceptée !',
        message: `Votre proposition de ${fXOF(proposition.montant)} a été acceptée`,
        data: { livraison_id: livraisonId },
        lu: false,
      })

      toast.success('Coursier sélectionné ! Suivi en cours.')
      router.replace(`/client/suivi/${livraisonId}`)
    } catch (err) {
      toast.error('Erreur lors de l\'acceptation')
    } finally { setAccepting(null) }
  }

  const propositionsCoursiers = propositions.filter(p => p.role_auteur === 'coursier' && p.statut === 'en_attente')
  const maPropositionActuelle = propositions.find(p => p.role_auteur === 'client' && p.auteur_id === userId && p.statut !== 'refuse')

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )
  if (!livraison) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <ArrowLeft size={16} className="text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="font-heading font-bold text-gray-900">Propositions de prix</h1>
            <p className="text-gray-400 text-xs">{propositionsCoursiers.length} coursier(s) ont répondu</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-5 pb-24 space-y-5">
        {/* Résumé livraison */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><MapPin size={16} className="text-blue-600" /></div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-gray-900 text-sm truncate">{livraison.depart_adresse}</p>
              <p className="text-gray-400 text-xs truncate">→ {livraison.arrivee_adresse}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-xs">Prix calculé</p>
              <p className="font-black text-blue-600 text-lg">{fXOF(livraison.prix_calcule)}</p>
            </div>
            {maPropositionActuelle && (
              <div className="text-right">
                <p className="text-gray-500 text-xs">Ma proposition</p>
                <p className="font-black text-orange-600 text-lg">{fXOF(maPropositionActuelle.montant)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Ma proposition */}
        {livraison.statut === 'en_attente' && (
          <div className="bg-white rounded-2xl p-5 border border-blue-200 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3">💬 Proposer mon prix</h3>
            <p className="text-gray-500 text-xs mb-3">Proposez un prix différent pour attirer plus de coursiers ou ajuster selon votre budget.</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <input type="number" placeholder="Ex: 2500" value={maProposition}
                  onChange={e => setMaProposition(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 pr-16" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold">XOF</span>
              </div>
              <button onClick={handleMaProposition} disabled={submitting}
                className="px-4 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 disabled:opacity-50">
                {submitting ? '...' : 'Envoyer'}
              </button>
            </div>
          </div>
        )}

        {/* Propositions des coursiers */}
        <div>
          <h2 className="font-bold text-gray-900 mb-3">🛵 Propositions des coursiers ({propositionsCoursiers.length})</h2>

          {propositionsCoursiers.length === 0 ? (
            <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
              <Clock size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="font-semibold text-gray-700">En attente de propositions</p>
              <p className="text-gray-400 text-sm mt-1">Les coursiers disponibles vont proposer leurs prix en temps réel</p>
            </div>
          ) : (
            <div className="space-y-3">
              {propositionsCoursiers.sort((a, b) => a.montant - b.montant).map(p => {
                const diff = p.montant - livraison.prix_calcule
                const isLower = diff < 0
                return (
                  <div key={p.id} className={`bg-white rounded-2xl p-4 border shadow-sm transition-all ${accepting === p.id ? 'border-green-300 bg-green-50' : 'border-gray-100 hover:border-blue-200'}`}>
                    <div className="flex items-start gap-4">
                      {/* Avatar */}
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-black text-lg shrink-0">
                        {p.auteur?.nom?.charAt(0) || '?'}
                      </div>

                      {/* Infos coursier */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-gray-900">{p.auteur?.nom || 'Coursier'}</p>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              <span className="flex items-center gap-0.5"><Star size={10} className="text-yellow-400" />{p.auteur?.note_moyenne?.toFixed(1) || '—'}</span>
                              <span>•</span>
                              <span>{p.auteur?.total_courses || 0} courses</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-black text-xl text-gray-900">{fXOF(p.montant)}</p>
                            <div className={`flex items-center gap-0.5 justify-end text-xs font-semibold ${isLower ? 'text-green-600' : 'text-red-500'}`}>
                              {isLower ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
                              {isLower ? '' : '+'}{Math.abs(diff).toLocaleString()} vs calculé
                            </div>
                          </div>
                        </div>

                        <div className="flex gap-2 mt-3">
                          <button onClick={() => handleAccepter(p)} disabled={!!accepting}
                            className="flex-1 py-2.5 rounded-xl bg-green-500 text-white font-bold text-sm hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-1.5">
                            {accepting === p.id ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Check size={14} />}
                            Accepter
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Historique toutes propositions */}
        {propositions.filter(p => p.statut === 'refuse').length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100"><h3 className="font-bold text-gray-900 text-sm">Historique</h3></div>
            {propositions.filter(p => p.statut !== 'en_attente').map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 border-b border-gray-50 last:border-0 opacity-60">
                <span className="text-sm">{p.statut === 'accepte' ? '✅' : '❌'}</span>
                <p className="text-sm text-gray-600 flex-1">{p.auteur?.nom || (p.role_auteur === 'client' ? 'Vous' : 'Coursier')} — {fXOF(p.montant)}</p>
                <span className="text-xs text-gray-400">{p.statut}</span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
