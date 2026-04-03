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

interface MissionWithDetails extends Livraison {
  client?: Utilisateur
}

export default function MissionPage() {
  const params = useParams()
  const router = useRouter()
  const missionId = params.id as string

  const [mission, setMission] = useState<MissionWithDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [route, setRoute] = useState<RouteResult | null>(null)
  const [messages, setMessages] = useState<MessageWithAuthor[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [actionInProgress, setActionInProgress] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }
    setCurrentUserId(session.user.id)

    // Modification pour pointer sur 'utilisateurs' via client_id
    const { data: missionData, error: missionError } = await supabase
      .from('livraisons')
      .select('*, client:client_id(*)') 
      .eq('id', missionId)
      .single()

    if (missionError || !missionData) { 
      toast.error("Mission introuvable")
      router.push('/coursier/dashboard-new')
      return 
    }

    setMission(missionData as MissionWithDetails)

    // Utilisation des noms corrigés : depart_lat / arrivee_lat
    if (missionData.depart_lat && missionData.arrivee_lat) {
      try {
        const r = await mapService.getRoute(
          missionData.depart_lat, 
          missionData.depart_lng, 
          missionData.arrivee_lat, 
          missionData.arrivee_lng
        )
        setRoute(r)
      } catch (err) {
        console.error("Erreur calcul itinéraire:", err)
      }
    }

    const convMessages = await communicationService.getConversation(session.user.id, missionData.client_id, missionId)
    setMessages(convMessages)

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setUserLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        err => console.error("Erreur géo:", err)
      )
    }
    setLoading(false)
  }, [missionId, router])

  useEffect(() => { loadData() }, [loadData])

  const handleSendMessage = async () => {
    if (!mission || !newMessage.trim() || !currentUserId) return
    try {
      await communicationService.sendMessage(currentUserId, mission.client_id, newMessage.trim(), missionId)
      setNewMessage('')
      // On recharge juste les messages pour éviter un flash de chargement complet
      const convMessages = await communicationService.getConversation(currentUserId, mission.client_id, missionId)
      setMessages(convMessages)
    } catch { toast.error("Erreur lors de l'envoi") }
  }

  const handleUpdateStatut = async (newStatut: string) => {
    if (!mission) return
    setActionInProgress(true)
    try {
      const res = await fetch('/api/coursier/livraisons/statut', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ livraison_id: missionId, statut: newStatut, coursier_id: currentUserId }),
      })
      if (!res.ok) throw new Error()
      toast.success(newStatut === 'livree' ? '🎉 Livraison confirmée !' : 'Statut mis à jour')
      if (newStatut === 'livree') router.push('/coursier/dashboard-new')
      else await loadData()
    } catch { toast.error('Erreur lors de la mise à jour') }
    finally { setActionInProgress(false) }
  }

  if (loading) return (
    <div className="min-h-screen bg-primary-600 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!mission) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-primary-600 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 h-16">
            <button onClick={() => router.back()} className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30">←</button>
            <div>
              <h1 className="font-bold">Détail de mission</h1>
              <p className="text-white/60 text-xs">#{missionId.slice(0, 8).toUpperCase()}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-4">
        {/* Carte */}
        {mission.depart_lat && (
          <div className="h-72 rounded-2xl overflow-hidden border border-gray-200">
            <MapAdvanced
              depart={{ lat: mission.depart_lat, lng: mission.depart_lng, label: mission.depart_adresse }}
              arrivee={{ lat: mission.arrivee_lat, lng: mission.arrivee_lng, label: mission.arrivee_adresse }}
              coursier={userLocation ? { lat: userLocation.lat, lng: userLocation.lng, nom: 'Vous' } : undefined}
              route={route ?? undefined}
            />
          </div>
        )}

        {/* Route infos */}
        {route && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">Distance</p>
              <p className="text-2xl font-black text-primary-600">{route.distance.toFixed(1)} km</p>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">Durée estimée</p>
              <p className="text-2xl font-black text-primary-600">{Math.round(route.duration / 60)} min</p>
            </div>
          </div>
        )}

        {/* Client */}
        {mission.client && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3">Client</h3>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-100 rounded-full flex items-center justify-center text-primary-600 font-bold text-lg">
                  {mission.client.nom?.charAt(0) || '?'}
                </div>
                <div>
                  <p className="font-bold text-gray-900">{mission.client.nom}</p>
                  <p className="text-xs text-gray-500">Client NYME</p>
                </div>
              </div>
              <div className="flex gap-2">
                <a href={`tel:${mission.client.telephone}`} className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-lg hover:bg-green-200">📞</a>
                <a href={communicationService.getWhatsAppLink(mission.client.whatsapp || mission.client.telephone || '')} target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-lg hover:bg-green-200">💬</a>
              </div>
            </div>
          </div>
        )}

        {/* Détails livraison */}
        <div className="space-y-3">
          {[
            { label: 'Départ', value: mission.depart_adresse },
            { label: 'Destination', value: mission.arrivee_adresse },
            { label: 'Destinataire', value: `${mission.destinataire_nom} — ${mission.destinataire_tel}` },
          ].map(item => (
            <div key={item.label} className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">{item.label}</p>
              <p className="font-semibold text-gray-900">{item.value}</p>
            </div>
          ))}
          {mission.instructions && (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-2xl p-4">
              <p className="text-xs text-yellow-600 mb-1">Instructions</p>
              <p className="font-semibold text-yellow-900">{mission.instructions}</p>
            </div>
          )}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Montant</p>
            <p className="text-2xl font-black text-primary-600">{(mission.prix_final || mission.prix_calcule).toLocaleString()} XOF</p>
          </div>
        </div>

        {/* Chat */}
        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <h3 className="font-bold text-gray-900 mb-3">Chat avec le client</h3>
          <div className="h-40 overflow-y-auto bg-gray-50 rounded-xl p-3 mb-3 space-y-2">
            {messages.length === 0
              ? <p className="text-sm text-gray-400 text-center py-6">Aucun message</p>
              : messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.expediteur_id === mission.client_id ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${msg.expediteur_id === mission.client_id ? 'bg-gray-200 text-gray-900' : 'bg-primary-500 text-white'}`}>
                    {msg.contenu}
                  </div>
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

        {/* Actions statut */}
        {mission.statut === 'acceptee' && (
          <button onClick={() => handleUpdateStatut('en_route_depart')} disabled={actionInProgress}
            className="w-full py-4 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 disabled:opacity-50">
            {actionInProgress ? '...' : '🛵 En route vers le colis'}
          </button>
        )}
        {mission.statut === 'en_route_depart' && (
          <button onClick={() => handleUpdateStatut('colis_recupere')} disabled={actionInProgress}
            className="w-full py-4 rounded-xl bg-indigo-500 text-white font-bold hover:bg-indigo-600 disabled:opacity-50">
            {actionInProgress ? '...' : '📦 Colis récupéré'}
          </button>
        )}
        {mission.statut === 'colis_recupere' && (
          <button onClick={() => handleUpdateStatut('en_route_arrivee')} disabled={actionInProgress}
            className="w-full py-4 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 disabled:opacity-50">
            {actionInProgress ? '...' : '🚀 En route vers destination'}
          </button>
        )}
        {mission.statut === 'en_route_arrivee' && (
          <button onClick={() => handleUpdateStatut('livree')} disabled={actionInProgress}
            className="w-full py-4 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 disabled:opacity-50">
            {actionInProgress ? '...' : '✅ Marquer livrée'}
          </button>
        )}
        {mission.statut === 'livree' && (
          <Link href="/coursier/dashboard-new" className="block w-full py-4 rounded-xl bg-gray-200 text-gray-700 font-bold text-center hover:bg-gray-300">
            ← Retour au dashboard
          </Link>
        )}
      </main>
    </div>
  )
}
