// src/app/client/evaluation/[id]/page.tsx — VERSION AMÉLIORÉE
// Ajoute : favori coursier, lien signalement, protection double soumission
'use client'
import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Livraison, Utilisateur } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { ArrowLeft, Star, Heart, AlertTriangle, CheckCircle } from 'lucide-react'

export default function EvaluationPage() {
  const params  = useParams()
  const router  = useRouter()
  const livId   = params.id as string

  const [userId,    setUserId]    = useState<string | null>(null)
  const [livraison, setLivraison] = useState<Livraison | null>(null)
  const [coursier,  setCoursier]  = useState<Utilisateur | null>(null)
  const [loading,   setLoading]   = useState(true)
  const [note,      setNote]      = useState(5)
  const [hoverNote, setHoverNote] = useState(0)
  const [commentaire, setCommentaire] = useState('')
  const [ajouterFavori, setAjouterFavori] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [done,      setDone]      = useState(false)
  const [dejaNote,  setDejaNote]  = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: u } = await supabase.from('utilisateurs').select('role').eq('id', session.user.id).single()
      if (!u || u.role !== 'client') { router.replace('/login'); return }
      setUserId(session.user.id)

      const { data: liv } = await supabase.from('livraisons')
        .select('*, coursier:coursier_id(id, nom, avatar_url, note_moyenne, telephone)')
        .eq('id', livId).single()

      if (!liv || liv.client_id !== session.user.id) { router.replace('/client/dashboard'); return }
      if (liv.statut !== 'livree') { toast.error('La livraison n\'est pas encore terminée'); router.back(); return }
      setLivraison(liv as Livraison)
      setCoursier((liv as unknown as { coursier: Utilisateur }).coursier)

      // Vérifier déjà noté
      const { data: ex } = await supabase.from('evaluations').select('id').eq('livraison_id', livId).eq('evaluateur_id', session.user.id).single()
      if (ex) setDejaNote(true)
      setLoading(false)
    }
    init()
  }, [livId, router])

  const handleSubmit = async () => {
    if (!userId || !livraison?.coursier_id || !coursier) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('evaluations').insert({
        livraison_id:  livId,
        evaluateur_id: userId,
        evalue_id:     livraison.coursier_id,
        note,
        commentaire: commentaire || null,
      })
      if (error) {
        if (error.code === '23505') { setDejaNote(true); toast.error('Vous avez déjà évalué cette livraison'); return }
        throw error
      }

      // Ajouter en favori
      if (ajouterFavori) {
        await supabase.from('coursiers_favoris').upsert(
          { client_id: userId, coursier_id: livraison.coursier_id },
          { onConflict: 'client_id,coursier_id' }
        )
      }

      // Notif au coursier
      await supabase.from('notifications').insert({
        user_id: livraison.coursier_id,
        type: 'evaluation_reçue',
        titre: `⭐ Évaluation reçue : ${note}/5`,
        message: commentaire ? `"${commentaire.slice(0, 100)}"` : `Vous avez reçu ${note} étoile(s) pour la livraison #${livId.slice(0,8).toUpperCase()}`,
        data: { livraison_id: livId, note },
        lu: false,
      })

      setDone(true)
    } catch { toast.error('Erreur lors de l\'envoi') }
    finally { setSubmitting(false) }
  }

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-10 h-10 border-4 border-blue-100 border-t-nyme-primary rounded-full animate-spin"/></div>

  if (dejaNote) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 shadow-sm text-center max-w-sm w-full">
        <CheckCircle size={52} className="text-green-500 mx-auto mb-4"/>
        <h2 className="font-black text-gray-900 text-xl mb-2">Déjà évalué ✓</h2>
        <p className="text-gray-500 text-sm mb-6">Vous avez déjà évalué cette livraison.</p>
        <button onClick={() => router.replace('/client/dashboard')} className="w-full py-3 bg-nyme-primary text-white rounded-xl font-bold">Retour</button>
      </div>
    </div>
  )

  if (done) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 shadow-sm text-center max-w-sm w-full">
        <div className="text-6xl mb-4">🎉</div>
        <h2 className="font-black text-gray-900 text-xl mb-2">Merci pour votre avis !</h2>
        <p className="text-gray-500 text-sm">Vous avez attribué <strong>{note} étoile{note > 1 ? 's' : ''}</strong> à {coursier?.nom}.</p>
        {ajouterFavori && <p className="text-green-600 text-sm mt-2">❤️ {coursier?.nom} ajouté à vos coursiers favoris</p>}
        <div className="space-y-2 mt-6">
          <button onClick={() => router.replace('/client/nouvelle-livraison')} className="w-full py-3 bg-nyme-primary text-white rounded-xl font-bold">📦 Nouvelle livraison</button>
          <button onClick={() => router.replace('/client/dashboard')} className="w-full py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-bold">← Dashboard</button>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center"><ArrowLeft size={16} className="text-gray-700"/></button>
          <h1 className="font-heading font-bold text-gray-900">Évaluer la livraison</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-5">

        {/* Coursier */}
        {coursier && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-nyme-primary to-nyme-orange rounded-full flex items-center justify-center text-white font-black text-3xl mx-auto mb-3">{coursier.nom?.charAt(0)}</div>
            <h2 className="font-black text-gray-900 text-xl">{coursier.nom}</h2>
            <p className="text-gray-400 text-sm">Note actuelle : ⭐ {coursier.note_moyenne?.toFixed(1) || 'Nouveau'}/5</p>
            <p className="text-gray-300 text-xs mt-1">Livraison #{livId.slice(0,8).toUpperCase()}</p>
          </div>
        )}

        {/* Étoiles */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 text-center space-y-4">
          <p className="font-bold text-gray-900 text-lg">Comment était cette livraison ?</p>
          <div className="flex justify-center gap-3">
            {[1,2,3,4,5].map(n => (
              <button key={n} onMouseEnter={() => setHoverNote(n)} onMouseLeave={() => setHoverNote(0)} onClick={() => setNote(n)} className="transition-transform hover:scale-110 active:scale-95">
                <Star size={44} className={`${n <= (hoverNote || note) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200'} transition-colors`}/>
              </button>
            ))}
          </div>
          <p className="text-lg font-black text-gray-800">
            {note === 5 ? '🌟 Excellent !' : note === 4 ? '😊 Très bien' : note === 3 ? '😐 Correct' : note === 2 ? '😕 Décevant' : '😞 Très décevant'}
          </p>
        </div>

        {/* Commentaire */}
        <div className="bg-white rounded-2xl p-5 border border-gray-100 space-y-3">
          <label className="block font-bold text-gray-900">Commentaire (optionnel)</label>
          <textarea value={commentaire} onChange={e => setCommentaire(e.target.value)} rows={4}
            placeholder={note >= 4 ? 'Excellent, livraison rapide et soignée...' : 'Décrivez ce qui pourrait être amélioré...'}
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-nyme-primary resize-none"/>
        </div>

        {/* Ajouter en favori */}
        <button onClick={() => setAjouterFavori(!ajouterFavori)}
          className={`w-full p-4 rounded-2xl border-2 flex items-center gap-3 transition-all ${ajouterFavori ? 'border-pink-400 bg-pink-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
          <Heart size={22} className={ajouterFavori ? 'text-pink-500 fill-pink-500' : 'text-gray-300'}/>
          <div className="flex-1 text-left">
            <p className="font-bold text-gray-900 text-sm">Ajouter {coursier?.nom} à mes favoris</p>
            <p className="text-gray-400 text-xs">Le retrouver facilement pour de futures livraisons</p>
          </div>
          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${ajouterFavori ? 'border-pink-400 bg-pink-400' : 'border-gray-300'}`}>
            {ajouterFavori && <div className="w-2.5 h-2.5 bg-white rounded-full"/>}
          </div>
        </button>

        {/* Lien signalement */}
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-center gap-3">
          <AlertTriangle size={18} className="text-red-500 shrink-0"/>
          <div className="flex-1">
            <p className="text-red-700 font-semibold text-sm">Un problème avec cette livraison ?</p>
            <p className="text-red-500 text-xs">Colis endommagé, comportement inapproprié...</p>
          </div>
          <button onClick={() => router.push(`/client/signalement/${livId}`)} className="text-xs bg-red-500 text-white px-3 py-2 rounded-xl font-bold hover:bg-red-600 shrink-0">
            Signaler
          </button>
        </div>

        <button onClick={handleSubmit} disabled={submitting}
          className="w-full py-4 rounded-xl bg-nyme-orange text-white font-black text-base hover:bg-orange-600 disabled:opacity-50 transition-colors">
          {submitting ? '⏳ Envoi...' : '⭐ Envoyer mon évaluation'}
        </button>
      </main>
    </div>
  )
}
