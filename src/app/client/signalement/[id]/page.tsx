// src/app/client/signalement/[id]/page.tsx — NOUVEAU FICHIER
'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Livraison } from '@/lib/supabase'
import { ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const MOTIFS = [
  'Comportement inapproprié ou agressif',
  'Colis endommagé ou manquant',
  'Livraison non effectuée (fraude)',
  'Retard excessif non justifié',
  'Escroquerie / vol',
  'Fausse confirmation de livraison',
  'Conduite dangereuse',
  'Autre problème',
]

export default function SignalementPage() {
  const params = useParams()
  const router = useRouter()
  const livId  = params.id as string

  const [userId,      setUserId]      = useState<string | null>(null)
  const [livraison,   setLivraison]   = useState<Livraison & { coursier?: { id?: string; nom?: string } } | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [motif,       setMotif]       = useState('')
  const [description, setDescription] = useState('')
  const [submitting,  setSubmitting]  = useState(false)
  const [done,        setDone]        = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: u } = await supabase.from('utilisateurs').select('role').eq('id', session.user.id).single()
      if (!u || u.role !== 'client') { router.replace('/login'); return }
      setUserId(session.user.id)

      const { data: liv } = await supabase.from('livraisons')
        .select('*, coursier:coursier_id(id, nom)')
        .eq('id', livId).eq('client_id', session.user.id).single()

      if (!liv) { router.replace('/client/dashboard'); return }
      setLivraison(liv as Livraison & { coursier?: { id?: string; nom?: string } })
      setLoading(false)
    }
    init()
  }, [livId, router])

  const handleSubmit = async () => {
    if (!userId || !livraison) return
    if (!motif) { toast.error('Sélectionnez un motif'); return }
    setSubmitting(true)
    try {
      const coursierId = livraison.coursier_id

      const { error } = await supabase.from('signalements').insert({
        signalant_id: userId,
        signale_id:   coursierId || userId, // fallback userId si pas de coursier
        livraison_id: livId,
        motif,
        description: description || null,
        statut: 'en_attente',
      })
      if (error) throw error

      // Notification dans la table (sera vue par admin)
      await supabase.from('notifications').insert({
        user_id: userId, // notif de confirmation au client
        type: 'signalement_envoye',
        titre: '✅ Signalement enregistré',
        message: `Votre signalement pour la livraison #${livId.slice(0,8).toUpperCase()} a bien été reçu. Nous traiterons votre demande sous 24h.`,
        data: { livraison_id: livId, motif },
        lu: false,
      })

      setDone(true)
    } catch { toast.error('Erreur lors de l\'envoi du signalement') }
    finally { setSubmitting(false) }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-100 border-t-nyme-primary rounded-full animate-spin"/></div>

  if (done) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 max-w-sm w-full text-center">
        <CheckCircle size={52} className="text-green-500 mx-auto mb-4"/>
        <h2 className="font-black text-gray-900 text-2xl mb-2">Signalement envoyé</h2>
        <p className="text-gray-500 text-sm mb-6">Notre équipe examinera votre signalement dans les 24 heures ouvrables. Vous serez notifié du résultat.</p>
        <div className="space-y-2">
          <button onClick={() => router.replace('/client/dashboard')} className="w-full py-3 bg-nyme-primary text-white rounded-xl font-bold hover:bg-nyme-primary-dark">
            Retour au dashboard
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center"><ArrowLeft size={16} className="text-gray-700"/></button>
          <h1 className="font-heading font-bold text-gray-900">Signaler un problème</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-5">
        {/* Info livraison */}
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5"/>
          <div>
            <p className="font-bold text-red-700 text-sm">Livraison #{livId.slice(0,8).toUpperCase()}</p>
            {livraison?.coursier && <p className="text-red-600 text-xs mt-0.5">Coursier : {(livraison.coursier as { nom?: string }).nom || '—'}</p>}
          </div>
        </div>

        {/* Motif */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 space-y-3">
          <h2 className="font-bold text-gray-900">Quel est le problème ? *</h2>
          <div className="space-y-2">
            {MOTIFS.map(m => (
              <button key={m} onClick={() => setMotif(m)}
                className={`w-full p-3.5 rounded-xl text-left border-2 font-semibold text-sm transition-all ${motif === m ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 text-gray-700 hover:border-gray-300 bg-white'}`}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 space-y-3">
          <h2 className="font-bold text-gray-900">Description détaillée (optionnel)</h2>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={5}
            placeholder="Décrivez en détail ce qui s'est passé : heure, lieu, comportement observé..."
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-red-400 resize-none"/>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
          <p className="text-amber-700 text-xs font-medium">⚠️ Les signalements abusifs entraîneront des mesures sur votre compte. Merci de signaler uniquement des problèmes réels.</p>
        </div>

        <button onClick={handleSubmit} disabled={submitting || !motif}
          className="w-full py-4 rounded-xl bg-red-500 text-white font-black text-base hover:bg-red-600 disabled:opacity-50 transition-colors">
          {submitting ? '⏳ Envoi en cours...' : '⚠️ Envoyer le signalement'}
        </button>
      </main>
    </div>
  )
}
