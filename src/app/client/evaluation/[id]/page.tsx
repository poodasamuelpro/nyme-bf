// src/app/client/evaluation/[id]/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Livraison, Utilisateur } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function EvaluationPage() {
  const params = useParams()
  const router = useRouter()
  const livraisonId = params.id as string

  const [livraison, setLivraison] = useState<Livraison | null>(null)
  const [coursier, setCoursier] = useState<Utilisateur | null>(null)
  const [loading, setLoading] = useState(true)
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const [reportReason, setReportReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [tab, setTab] = useState<'evaluation' | 'report'>('evaluation')

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data } = await supabase.from('livraisons')
        .select('*, coursier:coursier_id(id, nom, avatar_url, note_moyenne)')
        .eq('id', livraisonId).single()
      if (!data || data.client_id !== session.user.id) { router.push('/client/dashboard'); return }
      setLivraison(data as Livraison)
      setCoursier(data.coursier as Utilisateur)
      setLoading(false)
    }
    init()
  }, [livraisonId, router])

  const handleSubmitEvaluation = async () => {
    if (!livraison || !coursier) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('evaluations').insert({
        livraison_id: livraisonId,
        evaluateur_id: livraison.client_id,
        evalue_id: coursier.id,
        note: rating,
        commentaire: comment,
        type: 'client_vers_coursier',
      })
      if (error) throw error

      const { data: evaluations } = await supabase.from('evaluations').select('note').eq('evalue_id', coursier.id)
      if (evaluations?.length) {
        const avg = evaluations.reduce((s, e) => s + e.note, 0) / evaluations.length
        await supabase.from('utilisateurs').update({ note_moyenne: parseFloat(avg.toFixed(2)) }).eq('id', coursier.id)
      }

      toast.success('Évaluation enregistrée !')
      router.push('/client/dashboard')
    } catch { toast.error("Erreur lors de l'évaluation") }
    finally { setSubmitting(false) }
  }

  const handleSubmitReport = async () => {
    if (!livraison || !coursier || !reportReason) { toast.error('Sélectionnez un motif'); return }
    setSubmitting(true)
    try {
      const { error } = await supabase.from('signalements').insert({
        livraison_id: livraisonId,
        signalataire_id: livraison.client_id,
        signale_id: coursier.id,
        motif: reportReason,
        description: comment,
        statut: 'en_attente',
      })
      if (error) throw error
      toast.success('Signalement enregistré.')
      router.push('/client/dashboard')
    } catch { toast.error('Erreur lors du signalement') }
    finally { setSubmitting(false) }
  }

  if (loading) return <div className="min-h-screen bg-primary-600 flex items-center justify-center"><div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" /></div>
  if (!livraison || !coursier) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-primary-600 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 h-16">
            <button onClick={() => router.back()} className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">←</button>
            <div><h1 className="font-bold">Évaluation</h1><p className="text-white/60 text-xs">#{livraisonId.slice(0, 8).toUpperCase()}</p></div>
          </div>
        </div>
      </header>

      <div className="sticky top-16 z-30 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex">
          {(['evaluation', 'report'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${tab === t ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-600'}`}>
              {t === 'evaluation' ? '⭐ Évaluation' : '⚠️ Signalement'}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-24 space-y-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm flex items-center gap-4">
          <div className="w-16 h-16 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-bold text-2xl">{coursier.nom?.charAt(0) || '?'}</div>
          <div><h2 className="text-xl font-bold text-gray-900">{coursier.nom}</h2><p className="text-sm text-gray-500">⭐ {coursier.note_moyenne || 'Nouveau'}/5</p></div>
        </div>

        {tab === 'evaluation' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm">
              <label className="block text-sm font-semibold text-gray-700 mb-4">Note</label>
              <div className="flex gap-2 justify-center mb-3">
                {[1,2,3,4,5].map(star => (
                  <button key={star} onClick={() => setRating(star)} className="text-4xl transition-transform hover:scale-125">
                    {star <= rating ? '⭐' : '☆'}
                  </button>
                ))}
              </div>
              <p className="text-center text-lg font-bold text-primary-600">{rating}/5</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Commentaire (optionnel)</label>
              <textarea placeholder="Partagez votre expérience..." value={comment} onChange={e => setComment(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-400 resize-none h-24" />
            </div>
            <button onClick={handleSubmitEvaluation} disabled={submitting}
              className="w-full py-4 rounded-xl bg-primary-500 text-white font-bold hover:bg-primary-600 disabled:opacity-50">
              {submitting ? 'Enregistrement...' : '✅ Enregistrer l\'évaluation'}
            </button>
          </div>
        )}

        {tab === 'report' && (
          <div className="space-y-6">
            <div className="bg-red-50 rounded-2xl p-4 border border-red-200">
              <p className="text-sm text-red-700">⚠️ Signalez uniquement les comportements inappropriés. Votre signalement sera examiné par notre équipe.</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Motif *</label>
              <select value={reportReason} onChange={e => setReportReason(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-400">
                <option value="">-- Sélectionnez un motif --</option>
                <option value="comportement_inapproprie">Comportement inapproprié</option>
                <option value="colis_endommage">Colis endommagé</option>
                <option value="non_livraison">Non-livraison</option>
                <option value="arnaque">Arnaque/Fraude</option>
                <option value="insulte">Insulte/Harcèlement</option>
                <option value="autre">Autre</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Détails (optionnel)</label>
              <textarea placeholder="Décrivez le problème..." value={comment} onChange={e => setComment(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-400 resize-none h-24" />
            </div>
            <button onClick={handleSubmitReport} disabled={submitting || !reportReason}
              className="w-full py-4 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 disabled:opacity-50">
              {submitting ? 'Envoi...' : '⚠️ Envoyer le signalement'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}
