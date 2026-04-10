// src/components/calls/CallProvider.tsx
// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER GLOBAL D'APPELS WEBRTC — NYME
// À placer dans src/app/layout.tsx (après AuthProvider)
// Gère : init WebRTC, appels entrants (modal), appel actif (UI overlay)
// Visible partout dans l'app : dashboard, suivi, mission, messages, etc.
// ═══════════════════════════════════════════════════════════════════════════
'use client'
import { useEffect, useState, useCallback, createContext, useContext } from 'react'
import { supabase } from '@/lib/supabase'
import { webrtcCallService, type CallWithNames, type CallRecord } from '@/services/webrtc-call-service'
import IncomingCallModal from '@/components/calls/IncomingCallModal'
import ActiveCallUI from '@/components/calls/ActiveCallUI'
import toast from 'react-hot-toast'

// ── Contexte d'appel ─────────────────────────────────────────────────────────

interface CallContextType {
  isInCall:       boolean
  currentCallId:  string | null
  startCall: (params: {
    destinataireId: string
    livraisonId?:   string
  }) => Promise<string | null>
  hangUp:  () => Promise<void>
}

const CallContext = createContext<CallContextType>({
  isInCall:      false,
  currentCallId: null,
  startCall:     async () => null,
  hangUp:        async () => {},
})

export const useCall = () => useContext(CallContext)

// ── Provider ─────────────────────────────────────────────────────────────────

export default function CallProvider({ children }: { children: React.ReactNode }) {
  const [userId,        setUserId]        = useState<string | null>(null)
  const [userRole,      setUserRole]      = useState<'client' | 'coursier' | 'admin'>('client')
  const [incomingCall,  setIncomingCall]  = useState<CallWithNames | null>(null)
  const [activeCall,    setActiveCall]    = useState<CallRecord | null>(null)
  const [remoteStream,  setRemoteStream]  = useState<MediaStream | null>(null)
  const [remoteUserName,setRemoteName]    = useState('Interlocuteur')
  const [remoteAvatar,  setRemoteAvatar]  = useState<string | null>(null)
  const [callStatus,    setCallStatus]    = useState<'connecting' | 'connected' | 'ended'>('connecting')
  const [isInCall,      setIsInCall]      = useState(false)
  const [currentCallId, setCurrentCallId] = useState<string | null>(null)

  // ── Initialisation session ────────────────────────────────────────────────

  useEffect(() => {
    let mounted = true

    const initUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user || !mounted) return

      const uid = session.user.id
      setUserId(uid)

      // Récupérer le rôle depuis la table utilisateurs
      const { data: user } = await supabase
        .from('utilisateurs')
        .select('role')
        .eq('id', uid)
        .single()

      const role = (user?.role as 'client' | 'coursier' | 'admin') || 'client'
      setUserRole(role)

      // Initialiser le service WebRTC avec les handlers
      await webrtcCallService.init(uid, {
        onIncomingCall: (call: CallWithNames) => {
          if (!mounted) return
          setIncomingCall(call)
        },

        onCallAccepted: (call: CallRecord) => {
          if (!mounted) return
          setCallStatus('connected')
          toast.success('📞 Appel connecté !', { duration: 2000 })
          void call
        },

        onCallEnded: (call: CallRecord) => {
          if (!mounted) return
          setCallStatus('ended')
          setTimeout(() => {
            setActiveCall(null)
            setRemoteStream(null)
            setIsInCall(false)
            setCurrentCallId(null)
          }, 1500)
          toast(`📞 Appel terminé${call.duree_secondes ? ` — ${formatDuration(call.duree_secondes)}` : ''}`)
        },

        onCallRefused: () => {
          if (!mounted) return
          setActiveCall(null)
          setRemoteStream(null)
          setIsInCall(false)
          setCurrentCallId(null)
          toast('📞 Appel refusé', { icon: '❌' })
        },

        onRemoteStream: (stream: MediaStream) => {
          if (!mounted) return
          setRemoteStream(stream)
          setCallStatus('connected')
        },

        onError: (msg: string) => {
          toast.error(msg)
          setActiveCall(null)
          setRemoteStream(null)
          setIsInCall(false)
          setCurrentCallId(null)
        },
      })
    }

    initUser()

    // Réinitialiser à la déconnexion
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        webrtcCallService.destroy()
        setUserId(null)
        setIncomingCall(null)
        setActiveCall(null)
        setIsInCall(false)
        setCurrentCallId(null)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // ── Accepter un appel entrant ────────────────────────────────────────────

  const handleAcceptIncoming = useCallback(async () => {
    if (!incomingCall) return

    const callId = incomingCall.id
    setIncomingCall(null)
    setActiveCall(incomingCall)
    setRemoteName(incomingCall.appelant_nom || 'Interlocuteur')
    setRemoteAvatar(incomingCall.appelant_avatar || null)
    setCallStatus('connecting')
    setIsInCall(true)
    setCurrentCallId(callId)

    const ok = await webrtcCallService.acceptCall(callId)
    if (!ok) {
      setActiveCall(null)
      setIsInCall(false)
      setCurrentCallId(null)
    }
  }, [incomingCall])

  // ── Refuser un appel entrant ─────────────────────────────────────────────

  const handleRefuseIncoming = useCallback(async () => {
    if (!incomingCall) return
    await webrtcCallService.refuseCall(incomingCall.id)
    setIncomingCall(null)
  }, [incomingCall])

  // ── Initier un appel sortant ─────────────────────────────────────────────

  const startCall = useCallback(async (params: {
    destinataireId: string
    livraisonId?:   string
  }): Promise<string | null> => {
    if (!userId) {
      toast.error('Vous devez être connecté pour appeler')
      return null
    }
    if (isInCall) {
      toast.error('Vous êtes déjà en communication')
      return null
    }

    // Récupérer le nom du destinataire pour l'affichage
    const { data: dest } = await supabase
      .from('utilisateurs')
      .select('nom, avatar_url')
      .eq('id', params.destinataireId)
      .single()

    setRemoteName(dest?.nom || 'Interlocuteur')
    setRemoteAvatar(dest?.avatar_url || null)
    setCallStatus('connecting')
    setIsInCall(true)

    const callId = await webrtcCallService.startCall({
      appelantId:     userId,
      appelantRole:   userRole,
      destinataireId: params.destinataireId,
      livraisonId:    params.livraisonId,
    })

    if (!callId) {
      setIsInCall(false)
      return null
    }

    setCurrentCallId(callId)

    // Appel fictif pour activer l'UI — sera mis à jour via Realtime
    setActiveCall({
      id:              callId,
      livraison_id:    params.livraisonId || null,
      appelant_id:     userId,
      appelant_role:   userRole,
      destinataire_id: params.destinataireId,
      statut:          'en_attente',
      offer_sdp:       null,
      answer_sdp:      null,
      ice_candidates:  [],
      duree_secondes:  null,
      debut_at:        null,
      fin_at:          null,
      created_at:      new Date().toISOString(),
      updated_at:      new Date().toISOString(),
    })

    return callId
  }, [userId, userRole, isInCall])

  // ── Raccrocher ────────────────────────────────────────────────────────────

  const hangUp = useCallback(async () => {
    await webrtcCallService.endCall()
    setActiveCall(null)
    setRemoteStream(null)
    setIsInCall(false)
    setCurrentCallId(null)
    setCallStatus('ended')
  }, [])

  // ── Helpers ───────────────────────────────────────────────────────────────

  const formatDuration = (sec: number): string => {
    if (sec < 60) return `${sec}s`
    const m = Math.floor(sec / 60)
    const s = sec % 60
    return s > 0 ? `${m}min ${s}s` : `${m}min`
  }

  return (
    <CallContext.Provider value={{ isInCall, currentCallId, startCall, hangUp }}>
      {children}

      {/* Modal appel entrant — visible partout dans l'app */}
      {incomingCall && !isInCall && (
        <IncomingCallModal
          call={incomingCall}
          onAccept={handleAcceptIncoming}
          onRefuse={handleRefuseIncoming}
        />
      )}

      {/* UI appel en cours — visible partout dans l'app */}
      {activeCall && isInCall && (
        <ActiveCallUI
          remoteStream={remoteStream}
          remoteUserName={remoteUserName}
          remoteAvatar={remoteAvatar}
          onHangUp={hangUp}
          onToggleMute={() => webrtcCallService.toggleMute()}
          callStatus={callStatus}
        />
      )}
    </CallContext.Provider>
  )
}