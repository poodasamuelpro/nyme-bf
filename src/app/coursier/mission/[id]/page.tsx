// src/app/coursier/mission/[id]/page.tsx
'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
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

  const [mission,          setMission]          = useState<MissionWithDetails | null>(null)
  const [loading,          setLoading]          = useState(true)
  const [route,            setRoute]            = useState<RouteResult | null>(null)
  const [messages,         setMessages]         = useState<MessageWithAuthor[]>([])
  const [newMessage,       setNewMessage]       = useState('')
  const [userLocation,     setUserLocation]     = useState<{ lat: number; lng: number } | null>(null)
  const [actionInProgress, setActionInProgress] = useState(false)
  const [currentUserId,    setCurrentUserId]    = useState<string | null>(null)
  const [showChat,         setShowChat]         = useState(false)

  // Refs GPS pour cleanup propre
  const watchIdRef     = useRef<number | null>(null)
  const gpsIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const userIdRef      = useRef<string | null>(null)

  // ── Envoi GPS vers Supabase ─────────────────────────────────────────
  const sendGpsToSupabase = useCallback(async (
    uid: string, lat: number, lng: number, livId: string, speed: number | null
  ) => {
    try {
      await supabase.from('localisation_coursier').insert({
        coursier_id: uid,
        livraison_id: livId,
        latitude: lat,
        longitude: lng,
        vitesse: speed ? Math.round(speed * 3.6 * 100) / 100 : 0,
      })
      await supabase.from('coursiers').update({
        lat_actuelle: lat,
        lng_actuelle: lng,
        derniere_activite: new Date().toISOString(),
      }).eq('id', uid)
    } catch { /* silencieux */ }
  }, [])

  // ── Démarrer GPS tracking ───────────────────────────────────────────
  const startGpsTracking = useCallback((uid: string, livId: string) => {
    if (!navigator.geolocation) return

    // Position immédiate
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude: lat, longitude: lng, speed } = pos.coords
        setUserLocation({ lat, lng })
        sendGpsToSupabase(uid, lat, lng, livId, speed)
      },
      () => {}
    )

    // Watch continu (déclenche sur mouvement)
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
    }
    watchIdRef.current = navigator.geolocation.watchPosition(
      pos => {
        const { latitude: lat, longitude: lng, speed } = pos.coords
        setUserLocation({ lat, lng })
        sendGpsToSupabase(uid, lat, lng, livId, speed)
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
    )

    // Envoi forcé toutes les 5 secondes (même sans mouvement détecté)
    if (gpsIntervalRef.current) clearInterval(gpsIntervalRef.current)
    gpsIntervalRef.current = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        pos => sendGpsToSupabase(uid, pos.coords.latitude, pos.coords.longitude, livId, pos.coords.speed),
        () => {}
      )
    }, 5000)
  }, [sendGpsToSupabase])

  // ── Arrêter GPS tracking ────────────────────────────────────────────
  const stopGpsTracking = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (gpsIntervalRef.current) {
      clearInterval(gpsIntervalRef.current)
      gpsIntervalRef.current = null
    }
  }, [])

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/coursier/login'); return }
    setCurrentUserId(session.user.id)
    userIdRef.current = session.user.id

    const { data: missionData, error: missionError } = await supabase
      .from('livraisons')
      .select('*, client:client_id(*)')
      .eq('id', missionId)
      .single()

    if (missionError || !missionData) {
      toast.error('Mission introuvable')
      router.push('/coursier/dashboard-new')
      return
    }

    setMission(missionData as MissionWithDetails)

    if (missionData.depart_lat && missionData.arrivee_lat) {
      try {
        const r = await mapService.getRoute(
          missionData.depart_lat, missionData.depart_lng,
          missionData.arrivee_lat, missionData.arrivee_lng
        )
        setRoute(r)
      } catch (err) {
        console.error('Erreur calcul itinéraire:', err)
      }
    }

    const convMessages = await communicationService.getConversation(
      session.user.id, missionData.client_id, missionId
    )
    setMessages(convMessages)

    // Démarrer le GPS si la mission est active (pas terminée)
    const isActive = !['livree', 'annulee'].includes(missionData.statut)
    if (isActive) {
      startGpsTracking(session.user.id, missionId)
    }

    setLoading(false)
  }, [missionId, router, startGpsTracking])

  useEffect(() => {
    loadData()
    // Cleanup GPS au démontage — OBLIGATOIRE pour éviter la fuite GPS
    return () => { stopGpsTracking() }
  }, [loadData, stopGpsTracking])

  const handleSendMessage = async () => {
    if (!mission || !newMessage.trim() || !currentUserId) return
    try {
      await communicationService.sendMessage(
        currentUserId, mission.client_id, newMessage.trim(), missionId
      )
      setNewMessage('')
      const convMessages = await communicationService.getConversation(
        currentUserId, mission.client_id, missionId
      )
      setMessages(convMessages)
    } catch {
      toast.error("Erreur lors de l'envoi")
    }
  }

  const handleUpdateStatut = async (newStatut: string) => {
    if (!mission) return
    setActionInProgress(true)
    try {
      const res = await fetch('/api/coursier/livraisons/statut', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          livraison_id: missionId,
          statut: newStatut,
          coursier_id: currentUserId,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Erreur serveur')
      }

      if (newStatut === 'livree') {
        stopGpsTracking() // Arrêter le GPS à la livraison
        toast.success('🎉 Livraison confirmée !')
        router.push('/coursier/dashboard-new')
      } else if (newStatut === 'annulee') {
        stopGpsTracking()
        toast.success('Livraison annulée')
        router.push('/coursier/dashboard-new')
      } else {
        toast.success('Statut mis à jour')
        await loadData()
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la mise à jour')
    } finally {
      setActionInProgress(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-primary-600 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!mission) return null

  const isActive = !['livree', 'annulee'].includes(mission.statut)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header avec bouton retour */}
      <header className="sticky top-0 z-40 bg-primary-600 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 h-16">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              ←
            </button>
            <div className="flex-1">
              <h1 className="font-bold">Détail de mission</h1>
              <p className="text-white/60 text-xs">#{missionId.slice(0, 8).toUpperCase()}</p>
            </div>
            {/* Indicateur GPS actif */}
            {isActive && userLocation && (
              <div className="flex items-center gap-1.5 bg-green-500/20 rounded-lg px-2 py-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-semibold text-green-200">GPS</span>
              </div>
            )}
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
              coursier={userLocation
                ? { lat: userLocation.lat, lng: userLocation.lng, nom: 'Vous' }
                : undefined}
              route={route ?? undefined}
            />
          </div>
        )}

        {/* Route */}
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
                {mission.client.telephone && (
                  <a
                    href={`tel:${mission.client.telephone}`}
                    className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-lg hover:bg-green-200 transition-colors"
                  >
                    📞
                  </a>
                )}
                {mission.client.whatsapp && (
                  <a
                    href={communicationService.getWhatsAppLink
                      ? communicationService.getWhatsAppLink(mission.client.whatsapp)
                      : `https://wa.me/${mission.client.whatsapp}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center text-lg hover:bg-green-200 transition-colors"
                  >
                    💬
                  </a>
                )}
                <button
                  onClick={() => setShowChat(!showChat)}
                  className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-lg hover:bg-blue-200 transition-colors"
                >
                  ✉️
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Infos livraison */}
        <div className="space-y-3">
          {[
            { label: 'Départ',      value: mission.depart_adresse },
            { label: 'Destination', value: mission.arrivee_adresse },
            { label: 'Destinataire', value: `${mission.destinataire_nom} · ${mission.destinataire_tel}` },
          ].map(item => (
            <div key={item.label} className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">{item.label}</p>
              <p className="font-semibold text-gray-900">{item.value}</p>
            </div>
          ))}
          {mission.instructions && (
            <div className="bg-yellow-50 border-l-4 border-yellow-500 rounded-2xl p-4">
              <p className="text-xs text-yellow-600 mb-1">⚠️ Instructions du client</p>
              <p className="font-semibold text-yellow-900">{mission.instructions}</p>
            </div>
          )}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <p className="text-xs text-gray-500 mb-1">Montant</p>
            <p className="text-2xl font-black text-primary-600">
              {(mission.prix_final || mission.prix_calcule).toLocaleString()} XOF
            </p>
            {mission.mode_paiement && (
              <p className="text-xs text-gray-400 mt-1">
                {mission.mode_paiement === 'cash' ? '💵 Espèces' : '📱 Mobile Money'}
              </p>
            )}
          </div>
        </div>

        {/* Chat */}
        {showChat && (
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-gray-900">Chat avec le client</h3>
              <button onClick={() => setShowChat(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <div className="h-40 overflow-y-auto bg-gray-50 rounded-xl p-3 mb-3 space-y-2">
              {messages.length === 0
                ? <p className="text-sm text-gray-400 text-center py-6">Aucun message</p>
                : messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`flex ${msg.expediteur_id === mission.client_id ? 'justify-start' : 'justify-end'}`}
                  >
                    <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${
                      msg.expediteur_id === mission.client_id
                        ? 'bg-gray-200 text-gray-900'
                        : 'bg-primary-500 text-white'
                    }`}>
                      {msg.contenu}
                    </div>
                  </div>
                ))
              }
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Message..."
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-400"
              />
              <button
                onClick={handleSendMessage}
                className="px-4 py-2 rounded-xl bg-primary-500 text-white font-semibold hover:bg-primary-600 transition-colors"
              >
                →
              </button>
            </div>
          </div>
        )}

        {/* ── ACTIONS STATUT ── */}
        {/* 'en_rout_depart' sans 'e' = valeur exacte de la BDD (CHECK constraint SQL) */}
        {mission.statut === 'acceptee' && (
          <button
            onClick={() => handleUpdateStatut('en_rout_depart')}
            disabled={actionInProgress}
            className="w-full py-4 rounded-xl bg-blue-500 text-white font-bold hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {actionInProgress ? '⏳ ...' : '🛵 En route vers le colis'}
          </button>
        )}

        {mission.statut === 'en_rout_depart' && (
          <button
            onClick={() => handleUpdateStatut('colis_recupere')}
            disabled={actionInProgress}
            className="w-full py-4 rounded-xl bg-indigo-500 text-white font-bold hover:bg-indigo-600 disabled:opacity-50 transition-colors"
          >
            {actionInProgress ? '⏳ ...' : '📦 Colis récupéré'}
          </button>
        )}

        {mission.statut === 'colis_recupere' && (
          <button
            onClick={() => handleUpdateStatut('en_route_arrivee')}
            disabled={actionInProgress}
            className="w-full py-4 rounded-xl bg-orange-500 text-white font-bold hover:bg-orange-600 disabled:opacity-50 transition-colors"
          >
            {actionInProgress ? '⏳ ...' : '🚀 En route vers destination'}
          </button>
        )}

        {mission.statut === 'en_route_arrivee' && (
          <button
            onClick={() => handleUpdateStatut('livree')}
            disabled={actionInProgress}
            className="w-full py-4 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 disabled:opacity-50 transition-colors"
          >
            {actionInProgress ? '⏳ ...' : '✅ Marquer livrée'}
          </button>
        )}

        {(mission.statut === 'livree' || mission.statut === 'annulee') && (
          <Link
            href="/coursier/dashboard-new"
            className="block w-full py-4 rounded-xl bg-gray-200 text-gray-700 font-bold text-center hover:bg-gray-300 transition-colors"
          >
            ← Retour au dashboard
          </Link>
        )}

        {/* Bouton annulation (si course encore active) */}
        {isActive && !['livree'].includes(mission.statut) && (
          <button
            onClick={() => {
              if (confirm('Êtes-vous sûr de vouloir annuler cette livraison ?')) {
                handleUpdateStatut('annulee')
              }
            }}
            disabled={actionInProgress}
            className="w-full py-3 rounded-xl border-2 border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            Annuler la livraison
          </button>
        )}
      </main>
    </div>
  )
}
