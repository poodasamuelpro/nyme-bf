// src/app/client/suivi/[id]/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { mapService } from '@/services/map-service'
import { communicationService } from '@/services/communication-service'
import type { MessageWithAuthor } from '@/services/communication-service'
import type { RouteResult } from '@/services/map-service'
import type { Livraison, Utilisateur } from '@/lib/supabase'
import toast from 'react-hot-toast'

const MapAdvanced = dynamic(() => import('@/components/MapAdvanced'), { ssr: false })

interface LivraisonWithDetails extends Livraison {
  coursier?: Utilisateur
}

const STATUT_COLORS: Record<string, string> = {
  en_attente: 'bg-yellow-100 text-yellow-700',
  acceptee: 'bg-blue-100 text-blue-700',
  en_route_depart: 'bg-purple-100 text-purple-700',
  colis_recupere: 'bg-indigo-100 text-indigo-700',
  en_route_arrivee: 'bg-orange-100 text-orange-700',
  livree: 'bg-green-100 text-green-700',
  annulee: 'bg-red-100 text-red-700',
}

const STATUT_LABELS: Record<string, string> = {
  en_attente: '⏳ En attente d\'un coursier',
  acceptee: '✅ Course acceptée',
  en_route_depart: '🛵 Coursier en route',
  colis_recupere: '📦 Colis récupéré',
  en_route_arrivee: '🚀 En cours de livraison',
  livree: '🎉 Livraison effectuée',
  annulee: '❌ Annulée',
}

export default function SuiviPage() {
  const params = useParams()
  const router = useRouter()
  const livraisonId = params.id as string

  const [livraison, setLivraison] = useState<LivraisonWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [route, setRoute] = useState<RouteResult | null>(null)
  const [showChat, setShowChat] = useState(false)
  const [messages, setMessages] = useState<MessageWithAuthor[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setCurrentUserId(session.user.id)

    const { data } = await supabase
      .from('livraisons')
      .select('*, coursier:coursier_id(id, nom, avatar_url, note_moyenne, telephone)')
      .eq('id', livraisonId).single()

    if (!data || data.client_id !== session.user.id) { router.push('/client/dashboard'); return }
    setLivraison(data as LivraisonWithDetails)

    if (data.depart_lat && data.arrivee_lat) {
      try {
        const r = await mapService.getRoute(data.depart_lat, data.depart_lng, data.arrivee_lat, data.arrivee_lng)
        setRoute(r)
      } catch { /* ignore */ }
    }

    if (data.coursier_id) {
      const msgs = await communicationService.getConversation(session.user.id, data.coursier_id, livraisonId)
      setMessages(msgs)
    }

    setLoading(false)
  }, [livraisonId, router])

  useEffect(() => {
    loadData()
    const channel = supabase.channel(`suivi-${livraisonId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'livraisons', filter: `id=eq.${livraisonId}` }, () => loadData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [livraisonId, loadData])

  const handleSendMessage = async () => {
    if (!livraison?.coursier_id || !newMessage.trim() || !currentUserId) return
    try {
      await communicationService.sendMessage(currentUserId, livraison.coursier_id, newMessage.trim(), livraisonId)
      setNewMessage('')
      await loadData()
    } catch { toast.error("Erreur lors de l'envoi") }
  }

  if (loading) return (
    <div className="min-h-screen bg-primary-600 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!livraison) return null

  const isCompleted = ['livree', 'annulee'].includes(livraison.statut)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-primary-600 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 h-16">
            <button onClick={() => router.back()} className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30">←</button>
            <div>
              <h1 className="font-bold">Suivi de livraison</h1>
              <p className="text-white/60 text-xs">#{livraisonId.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-4">
        {/* Statut */}
        <div className={`rounded-2xl p-4 ${STATUT_COLORS[livraison.statut] || 'bg-gray-100 text-gray-700'}`}>
          <p className="font-bold text-lg">{STATUT_LABELS[livraison.statut] || livraison.statut}</p>
        </div>

        {/* Carte */}
        {livraison.depart_lat && (
          <div className="h-72 rounded-2xl overflow-hidden border border-gray-200">
            <MapAdvanced
              depart={{ lat: livraison.depart_lat, lng: livraison.depart_lng, label: livraison.depart_adresse }}
              arrivee={{ lat: livraison.arrivee_lat, lng: livraison.arrivee_lng, label: livraison.arrivee_adresse }}
              route={route ?? undefined}
            />
          </div>
        )}

        {/* Route */}
        {route && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm"><p className="text-xs text-gray-500 mb-1">Distance</p><p className="text-2xl font-black text-primary-600">{route.distance.toFixed(1)} km</p></div>
            <div className="bg-white rounded-2xl p-4 shadow-sm"><p className="text-xs text-gray-500 mb-1">Durée estimée</p><p className="text-2xl font-black text-primary-600">{Math.round(route.duration / 60)} min</p></div>
          </div>
        )}

        {/* Coursier */}
        {livraison.coursier && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3">Votre coursier</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-bold text-lg">{livraison.coursier.nom?.charAt(0) || '?'}</div>
                <div>
                  <p className="font-bold text-gray-900">{livraison.coursier.nom}</p>
                  <p className="text-xs text-gray-500">⭐ {livraison.coursier.note_moyenne || 'Nouveau'}/5</p>
                </div>
              </div>
              <div className="flex gap-2">
                {livraison.coursier.telephone && <a href={`tel:${livraison.coursier.telephone}`} className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-lg hover:bg-green-200">📞</a>}
                <button onClick={() => setShowChat(!showChat)} className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-lg hover:bg-blue-200">💬</button>
              </div>
            </div>
          </div>
        )}

        {/* Chat */}
        {showChat && livraison.coursier && (
          <div className="bg-white rounded-2xl p-4 shadow-sm border-2 border-primary-200">
            <h3 className="font-bold text-gray-900 mb-3">Chat avec {livraison.coursier.nom}</h3>
            <div className="h-48 overflow-y-auto bg-gray-50 rounded-xl p-3 mb-3 space-y-2">
              {messages.length === 0
                ? <p className="text-sm text-gray-400 text-center py-8">Aucun message</p>
                : messages.map(msg => (
                  <div key={msg.id} className={`flex ${msg.expediteur_id === livraison.client_id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${msg.expediteur_id === livraison.client_id ? 'bg-primary-500 text-white' : 'bg-gray-200 text-gray-900'}`}>{msg.contenu}</div>
                  </div>
                ))
              }
            </div>
            <div className="flex gap-2">
              <input type="text" placeholder="Message..." value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-400" />
              <button onClick={handleSendMessage} className="px-4 py-2 rounded-xl bg-primary-500 text-white font-semibold hover:bg-primary-600">→</button>
            </div>
          </div>
        )}

        {/* Détails */}
        <div className="space-y-3">
          <div className="bg-white rounded-2xl p-4 shadow-sm"><p className="text-xs text-gray-500 mb-1">Départ</p><p className="font-semibold text-gray-900">{livraison.depart_adresse}</p></div>
          <div className="bg-white rounded-2xl p-4 shadow-sm"><p className="text-xs text-gray-500 mb-1">Destination</p><p className="font-semibold text-gray-900">{livraison.arrivee_adresse}</p></div>
          <div className="bg-white rounded-2xl p-4 shadow-sm"><p className="text-xs text-gray-500 mb-1">Montant</p><p className="text-2xl font-black text-primary-600">{(livraison.prix_final || livraison.prix_calcule).toLocaleString()} XOF</p></div>
        </div>

        {/* Actions fin */}
        {isCompleted && (
          <div className="space-y-3">
            {livraison.statut === 'livree' && (
              <Link href={`/client/evaluation/${livraisonId}`} className="block w-full py-3 rounded-xl bg-primary-500 text-white font-bold text-center hover:bg-primary-600">⭐ Évaluer cette livraison</Link>
            )}
            <Link href="/client/dashboard" className="block w-full py-3 rounded-xl border-2 border-gray-200 text-gray-700 font-bold text-center hover:bg-gray-50">← Retour au dashboard</Link>
          </div>
        )}
      </main>
    </div>
  )
}
