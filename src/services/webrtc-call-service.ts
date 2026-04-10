// src/services/webrtc-call-service.ts — MODIFIÉ
// ═══════════════════════════════════════════════════════════════════════════
// SERVICE D'APPELS WEBRTC — NYME
// Appels audio uniquement (pas vidéo) via WebRTC + Supabase Realtime
// Signalisation : table calls_webrtc + webrtc_ice_candidates
//
// MISE À JOUR : Intégration Cloudflare TURN Service
//   - Les credentials TURN sont générés dynamiquement côté serveur
//   - Endpoint : GET /api/calls/turn-credentials (auth requise)
//   - TTL credentials : 24h (renouvelés à chaque init)
//   - Fallback : STUN Google si Cloudflare indisponible
//
// CLOUDFLARE TURN CONFIG :
//   Serveurs ICE fournis par Cloudflare :
//   - stun:stun.cloudflare.com:3478
//   - turn:turn.cloudflare.com:3478?transport=udp
//   - turn:turn.cloudflare.com:3478?transport=tcp
//   - turns:turn.cloudflare.com:5349?transport=tcp
// ═══════════════════════════════════════════════════════════════════════════

import { supabase } from '@/lib/supabase'

// ── Types ────────────────────────────────────────────────────────────────────

export type CallStatut = 'en_attente' | 'en_cours' | 'termine' | 'refuse' | 'manque' | 'annule'
export type CallerRole = 'client' | 'coursier' | 'admin'

export interface CallRecord {
  id:               string
  livraison_id:     string | null
  appelant_id:      string
  appelant_role:    CallerRole
  destinataire_id:  string
  statut:           CallStatut
  offer_sdp:        string | null
  answer_sdp:       string | null
  ice_candidates:   unknown[]
  duree_secondes:   number | null
  debut_at:         string | null
  fin_at:           string | null
  created_at:       string
  updated_at:       string
}

export interface CallWithNames extends CallRecord {
  appelant_nom?:         string
  appelant_avatar?:      string | null
  destinataire_nom?:     string
  destinataire_avatar?:  string | null
}

// Callbacks fournis par le composant UI
export interface CallHandlers {
  onIncomingCall:     (call: CallWithNames) => void
  onCallAccepted:     (call: CallRecord)    => void
  onCallEnded:        (call: CallRecord)    => void
  onRemoteStream:     (stream: MediaStream) => void
  onIceCandidate:     (candidate: RTCIceCandidateInit) => void
  onError:            (msg: string)         => void
  onCallRefused:      (call: CallRecord)    => void
}

// Structure des credentials TURN renvoyés par /api/calls/turn-credentials
interface TurnCredentialsResponse {
  success:    boolean
  source:     'cloudflare_turn' | 'fallback_stun'
  iceServers: RTCIceServer[]
  ttl:        number
  warning?:   string
}

// ── Configuration WebRTC par défaut (STUN seulement) ─────────────────────────
// Utilisé comme fallback ultime si l'API /api/calls/turn-credentials échoue

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  // STUN Cloudflare — premier choix
  { urls: 'stun:stun.cloudflare.com:3478' },
  // STUN Google — backup fiable
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

// ── Cache des credentials TURN ────────────────────────────────────────────────
// Les credentials sont mis en cache pour éviter des appels API à chaque appel
// TTL du cache : 23h (les credentials Cloudflare durent 24h)

interface CachedTurnCredentials {
  iceServers: RTCIceServer[]
  source:     string
  fetchedAt:  number   // timestamp ms
}

const TURN_CACHE_TTL_MS = 23 * 60 * 60 * 1000  // 23 heures
let _turnCache: CachedTurnCredentials | null = null

// ── Classe principale ────────────────────────────────────────────────────────

class WebRTCCallService {
  private peerConnection: RTCPeerConnection | null = null
  private localStream:    MediaStream | null       = null
  private currentCallId:  string | null            = null
  private currentUserId:  string | null            = null
  private handlers:       Partial<CallHandlers>    = {}
  private signalingChannel: ReturnType<typeof supabase.channel> | null = null
  private iceChannel:       ReturnType<typeof supabase.channel> | null = null
  private cleanupTimeout:   NodeJS.Timeout | null  = null

  // ── Récupération des credentials TURN Cloudflare ─────────────────────────

  /**
   * Récupère les credentials TURN depuis l'API backend /api/calls/turn-credentials.
   * Utilise un cache côté client (TTL 23h) pour éviter les appels API répétés.
   * Fallback sur STUN Google si l'API est indisponible.
   *
   * IMPORTANT : Les credentials contiennent un username et credential générés
   * dynamiquement par Cloudflare Calls TURN Service pour l'utilisateur courant.
   * Ils sont liés au Turn Token ID : 77f00ae2cb584d4141b0efb842de5425
   */
  private async getTurnIceServers(): Promise<RTCIceServer[]> {
    // Retourner le cache si encore valide
    if (_turnCache && (Date.now() - _turnCache.fetchedAt) < TURN_CACHE_TTL_MS) {
      console.log(`[WebRTC] TURN credentials depuis cache (source: ${_turnCache.source})`)
      return _turnCache.iceServers
    }

    try {
      const response = await fetch('/api/calls/turn-credentials', {
        method:  'GET',
        headers: { 'Content-Type': 'application/json' },
        signal:  AbortSignal.timeout(8000),
      })

      if (!response.ok) {
        console.warn('[WebRTC] /api/calls/turn-credentials HTTP', response.status, '— fallback STUN')
        return DEFAULT_ICE_SERVERS
      }

      const data = await response.json() as TurnCredentialsResponse

      if (!data.success || !data.iceServers?.length) {
        console.warn('[WebRTC] Réponse TURN invalide — fallback STUN')
        return DEFAULT_ICE_SERVERS
      }

      // Mettre en cache
      _turnCache = {
        iceServers: data.iceServers,
        source:     data.source,
        fetchedAt:  Date.now(),
      }

      if (data.warning) {
        console.warn('[WebRTC] TURN warning:', data.warning)
      }

      console.log(`[WebRTC] TURN credentials chargés depuis ${data.source}:`, data.iceServers.map(s => s.urls).flat())
      return data.iceServers

    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (err instanceof Error && err.name === 'AbortError') {
        console.warn('[WebRTC] Timeout récupération TURN credentials — fallback STUN')
      } else {
        console.warn('[WebRTC] Erreur récupération TURN credentials:', msg, '— fallback STUN')
      }
      return DEFAULT_ICE_SERVERS
    }
  }

  /**
   * Invalide le cache des credentials TURN (ex : après un échec de connexion).
   * Le prochain appel forcera un nouveau fetch depuis l'API.
   */
  static invalidateTurnCache(): void {
    _turnCache = null
    console.log('[WebRTC] Cache TURN invalidé')
  }

  // ── Initialisation ──────────────────────────────────────────────────────

  /**
   * Initialise le service pour un utilisateur connecté.
   * À appeler dans useEffect une seule fois par session.
   * Lance l'écoute des appels entrants via Supabase Realtime.
   * Précharge les credentials TURN en arrière-plan pour un démarrage rapide.
   */
  async init(userId: string, handlers: Partial<CallHandlers>): Promise<void> {
    this.currentUserId = userId
    this.handlers = handlers
    await this.listenForIncomingCalls(userId)

    // Précharger les credentials TURN en arrière-plan
    // (ne bloque pas l'init, améliore la latence au premier appel)
    this.getTurnIceServers().catch(err => {
      console.warn('[WebRTC] Préchargement TURN échoué:', err)
    })
  }

  /**
   * Écoute les appels entrants pour cet utilisateur.
   * Déclenche handlers.onIncomingCall quand un nouveau call arrive.
   */
  private async listenForIncomingCalls(userId: string): Promise<void> {
    // Nettoyer le canal précédent
    if (this.signalingChannel) {
      await supabase.removeChannel(this.signalingChannel)
    }

    this.signalingChannel = supabase
      .channel(`incoming-calls-${userId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'calls_webrtc',
          filter: `destinataire_id=eq.${userId}`,
        },
        async (payload) => {
          const call = payload.new as CallRecord
          if (call.statut !== 'en_attente') return

          // Récupérer les noms pour l'affichage
          const callWithNames = await this.enrichCallWithNames(call)
          this.handlers.onIncomingCall?.(callWithNames)
        }
      )
      .on(
        'postgres_changes',
        {
          event:  'UPDATE',
          schema: 'public',
          table:  'calls_webrtc',
          filter: `appelant_id=eq.${userId}`,
        },
        async (payload) => {
          const call = payload.new as CallRecord
          if (call.id !== this.currentCallId) return

          if (call.statut === 'en_cours' && call.answer_sdp) {
            // L'autre personne a accepté : définir la réponse SDP
            await this.handleAnswer(call.answer_sdp)
            this.handlers.onCallAccepted?.(call)
          } else if (['termine', 'refuse', 'annule', 'manque'].includes(call.statut)) {
            if (call.statut === 'refuse') {
              this.handlers.onCallRefused?.(call)
            } else {
              this.handlers.onCallEnded?.(call)
            }
            await this.cleanup()
          }
        }
      )
      .subscribe()
  }

  // ── Appel sortant ────────────────────────────────────────────────────────

  /**
   * Initie un appel audio vers un destinataire.
   * Crée la ligne dans calls_webrtc et envoie l'offre SDP.
   * Utilise les credentials TURN Cloudflare pour la traversée NAT.
   *
   * @returns L'ID de l'appel créé ou null en cas d'échec
   */
  async startCall(params: {
    appelantId:      string
    appelantRole:    CallerRole
    destinataireId:  string
    livraisonId?:    string
  }): Promise<string | null> {
    try {
      // Récupérer les credentials TURN Cloudflare
      const iceServers = await this.getTurnIceServers()

      // Demander accès micro
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate:       16000,
        },
        video: false,
      })

      // Créer la connexion WebRTC avec les credentials TURN Cloudflare
      this.peerConnection = new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 10,
      })
      this.setupPeerConnectionHandlers()

      // Ajouter les pistes audio locales
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!)
      })

      // Créer l'offre SDP
      const offer = await this.peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      })
      await this.peerConnection.setLocalDescription(offer)

      // Insérer l'appel dans Supabase
      const { data, error } = await supabase
        .from('calls_webrtc')
        .insert({
          appelant_id:     params.appelantId,
          appelant_role:   params.appelantRole,
          destinataire_id: params.destinataireId,
          livraison_id:    params.livraisonId || null,
          statut:          'en_attente',
          offer_sdp:       JSON.stringify(offer),
        })
        .select()
        .single()

      if (error || !data) {
        console.error('[WebRTC] Erreur création appel:', error?.message)
        this.handlers.onError?.('Impossible de créer l\'appel')
        await this.cleanup()
        return null
      }

      this.currentCallId = data.id

      // Écouter les candidats ICE du destinataire
      await this.listenForRemoteIceCandidates(data.id, params.destinataireId)

      // Timeout de 45 secondes si pas de réponse
      this.cleanupTimeout = setTimeout(async () => {
        if (this.currentCallId === data.id) {
          await this.updateCallStatus(data.id, 'manque')
          this.handlers.onCallEnded?.({ ...data, statut: 'manque' })
          await this.cleanup()
        }
      }, 45000)

      return data.id
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[WebRTC] startCall error:', msg)
      this.handlers.onError?.(
        msg.includes('NotAllowedError') || msg.includes('Permission')
          ? 'Accès au microphone refusé. Vérifiez les permissions du navigateur.'
          : 'Impossible de démarrer l\'appel'
      )
      await this.cleanup()
      return null
    }
  }

  // ── Répondre à un appel entrant ──────────────────────────────────────────

  /**
   * Accepte un appel entrant.
   * Récupère l'offre SDP, crée une réponse et met à jour Supabase.
   * Utilise les credentials TURN Cloudflare pour la traversée NAT.
   */
  async acceptCall(callId: string): Promise<boolean> {
    try {
      // Récupérer les credentials TURN Cloudflare
      const iceServers = await this.getTurnIceServers()

      // Récupérer l'offre depuis Supabase
      const { data: callData, error } = await supabase
        .from('calls_webrtc')
        .select('*')
        .eq('id', callId)
        .single()

      if (error || !callData?.offer_sdp) {
        this.handlers.onError?.('Appel introuvable ou expiré')
        return false
      }

      // Demander accès micro
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate:       16000,
        },
        video: false,
      })

      // Créer la connexion WebRTC avec les credentials TURN Cloudflare
      this.peerConnection = new RTCPeerConnection({
        iceServers,
        iceCandidatePoolSize: 10,
      })
      this.setupPeerConnectionHandlers()

      // Ajouter les pistes audio locales
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!)
      })

      // Définir l'offre distante
      const offerSdp = JSON.parse(callData.offer_sdp) as RTCSessionDescriptionInit
      await this.peerConnection.setRemoteDescription(new RTCSessionDescription(offerSdp))

      // Créer la réponse
      const answer = await this.peerConnection.createAnswer()
      await this.peerConnection.setLocalDescription(answer)

      this.currentCallId = callId

      // Mettre à jour Supabase avec la réponse + statut en_cours
      await supabase
        .from('calls_webrtc')
        .update({
          statut:     'en_cours',
          answer_sdp: JSON.stringify(answer),
          debut_at:   new Date().toISOString(),
        })
        .eq('id', callId)

      // Envoyer les candidats ICE de l'appelant qui ont peut-être été reçus avant
      await this.processPendingIceCandidates(callId, callData.appelant_id)

      // Écouter les nouveaux candidats ICE de l'appelant
      await this.listenForRemoteIceCandidates(callId, callData.appelant_id)

      return true
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[WebRTC] acceptCall error:', msg)
      this.handlers.onError?.(
        msg.includes('NotAllowedError')
          ? 'Accès au microphone refusé.'
          : 'Impossible de répondre à l\'appel'
      )
      await this.cleanup()
      return false
    }
  }

  /**
   * Refuse un appel entrant.
   */
  async refuseCall(callId: string): Promise<void> {
    await this.updateCallStatus(callId, 'refuse')
  }

  /**
   * Termine l'appel en cours (les deux côtés peuvent l'appeler).
   */
  async endCall(): Promise<void> {
    if (!this.currentCallId) return
    await this.updateCallStatus(this.currentCallId, 'termine', {
      fin_at: new Date().toISOString(),
    })
    await this.cleanup()
  }

  /**
   * Coupe/découpe le microphone local.
   */
  toggleMute(): boolean {
    if (!this.localStream) return false
    const audioTrack = this.localStream.getAudioTracks()[0]
    if (!audioTrack) return false
    audioTrack.enabled = !audioTrack.enabled
    return !audioTrack.enabled  // true = muet
  }

  /**
   * Retourne le flux audio local pour l'affichage.
   */
  getLocalStream(): MediaStream | null {
    return this.localStream
  }

  // ── Signalisation ICE ────────────────────────────────────────────────────

  /**
   * Écoute les candidats ICE distants via Supabase Realtime.
   */
  private async listenForRemoteIceCandidates(
    callId:   string,
    remoteUserId: string
  ): Promise<void> {
    if (this.iceChannel) {
      await supabase.removeChannel(this.iceChannel)
    }

    this.iceChannel = supabase
      .channel(`ice-${callId}-${remoteUserId}`)
      .on(
        'postgres_changes',
        {
          event:  'INSERT',
          schema: 'public',
          table:  'webrtc_ice_candidates',
          filter: `call_id=eq.${callId}`,
        },
        async (payload) => {
          const row = payload.new as { user_id: string; candidate: string }
          if (row.user_id === this.currentUserId) return  // ignorer les nôtres
          if (!this.peerConnection) return

          try {
            const candidate = new RTCIceCandidate(JSON.parse(row.candidate))
            await this.peerConnection.addIceCandidate(candidate)
          } catch (e) {
            console.warn('[WebRTC] addIceCandidate error:', e)
          }
        }
      )
      .subscribe()
  }

  /**
   * Traite les candidats ICE déjà présents en base (arrivés avant la connexion).
   */
  private async processPendingIceCandidates(
    callId:   string,
    remoteUserId: string
  ): Promise<void> {
    if (!this.peerConnection) return

    const { data } = await supabase
      .from('webrtc_ice_candidates')
      .select('candidate')
      .eq('call_id', callId)
      .eq('user_id', remoteUserId)

    for (const row of data || []) {
      try {
        await this.peerConnection.addIceCandidate(
          new RTCIceCandidate(JSON.parse(row.candidate))
        )
      } catch (e) {
        console.warn('[WebRTC] pending ICE candidate error:', e)
      }
    }
  }

  // ── Gestion interne de la PeerConnection ────────────────────────────────

  private setupPeerConnectionHandlers(): void {
    if (!this.peerConnection) return

    // Flux audio distant reçu → transmettre au composant UI
    this.peerConnection.ontrack = (event) => {
      if (event.streams && event.streams[0]) {
        this.handlers.onRemoteStream?.(event.streams[0])
      }
    }

    // Candidat ICE local généré → l'envoyer via Supabase
    this.peerConnection.onicecandidate = async (event) => {
      if (!event.candidate || !this.currentCallId || !this.currentUserId) return
      try {
        await supabase.from('webrtc_ice_candidates').insert({
          call_id:   this.currentCallId,
          user_id:   this.currentUserId,
          candidate: JSON.stringify(event.candidate.toJSON()),
        })
      } catch (e) {
        console.warn('[WebRTC] ICE candidate insert error:', e)
      }
    }

    // Changements d'état de connexion ICE
    this.peerConnection.oniceconnectionstatechange = () => {
      const state = this.peerConnection?.iceConnectionState
      console.log('[WebRTC] ICE state:', state)
      if (state === 'failed') {
        // Invalider le cache TURN et signaler l'erreur
        WebRTCCallService.invalidateTurnCache()
        this.handlers.onError?.('Connexion perdue. Vérifiez votre réseau.')
      }
      if (state === 'disconnected') {
        this.handlers.onError?.('Connexion instable. Vérifiez votre réseau.')
      }
      if (state === 'closed') {
        this.cleanup()
      }
    }

    // Changements d'état de connexion
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState
      console.log('[WebRTC] Connection state:', state)
      if (state === 'connected') {
        console.log('[WebRTC] ✅ Appel connecté via Cloudflare TURN !')
      }
      if (state === 'failed') {
        WebRTCCallService.invalidateTurnCache()
        this.handlers.onError?.('Impossible d\'établir la connexion audio.')
      }
    }
  }

  /**
   * Applique la réponse SDP reçue de l'autre participant.
   */
  private async handleAnswer(answerSdpJson: string): Promise<void> {
    if (!this.peerConnection) return
    try {
      const answerSdp = JSON.parse(answerSdpJson) as RTCSessionDescriptionInit
      if (this.peerConnection.signalingState === 'have-local-offer') {
        await this.peerConnection.setRemoteDescription(new RTCSessionDescription(answerSdp))
      }
    } catch (e) {
      console.error('[WebRTC] handleAnswer error:', e)
    }
  }

  // ── Utilitaires ──────────────────────────────────────────────────────────

  private async updateCallStatus(
    callId: string,
    statut: CallStatut,
    extra?: Record<string, unknown>
  ): Promise<void> {
    await supabase
      .from('calls_webrtc')
      .update({ statut, ...extra })
      .eq('id', callId)
  }

  private async enrichCallWithNames(call: CallRecord): Promise<CallWithNames> {
    try {
      const { data: appelant } = await supabase
        .from('utilisateurs')
        .select('nom, avatar_url')
        .eq('id', call.appelant_id)
        .single()

      const { data: destinataire } = await supabase
        .from('utilisateurs')
        .select('nom, avatar_url')
        .eq('id', call.destinataire_id)
        .single()

      return {
        ...call,
        appelant_nom:        appelant?.nom || 'Inconnu',
        appelant_avatar:     appelant?.avatar_url || null,
        destinataire_nom:    destinataire?.nom || 'Inconnu',
        destinataire_avatar: destinataire?.avatar_url || null,
      }
    } catch {
      return { ...call }
    }
  }

  /**
   * Nettoyage complet : fermer PeerConnection, libérer micro,
   * supprimer les canaux Realtime.
   */
  async cleanup(): Promise<void> {
    if (this.cleanupTimeout) {
      clearTimeout(this.cleanupTimeout)
      this.cleanupTimeout = null
    }

    if (this.localStream) {
      this.localStream.getTracks().forEach(t => t.stop())
      this.localStream = null
    }

    if (this.peerConnection) {
      this.peerConnection.ontrack       = null
      this.peerConnection.onicecandidate = null
      this.peerConnection.onconnectionstatechange = null
      this.peerConnection.oniceconnectionstatechange = null
      this.peerConnection.close()
      this.peerConnection = null
    }

    if (this.iceChannel) {
      await supabase.removeChannel(this.iceChannel)
      this.iceChannel = null
    }

    this.currentCallId = null
  }

  /**
   * Destruction complète du service (désinscription de tous les canaux).
   */
  async destroy(): Promise<void> {
    await this.cleanup()
    if (this.signalingChannel) {
      await supabase.removeChannel(this.signalingChannel)
      this.signalingChannel = null
    }
    this.handlers = {}
    this.currentUserId = null
  }

  // ── Getters ──────────────────────────────────────────────────────────────

  isInCall(): boolean {
    return this.peerConnection !== null && this.currentCallId !== null
  }

  getCurrentCallId(): string | null {
    return this.currentCallId
  }

  /**
   * Récupère l'historique des appels d'un utilisateur.
   */
  async getCallHistory(userId: string, limit = 20): Promise<CallWithNames[]> {
    const { data, error } = await supabase
      .from('calls_webrtc')
      .select(`
        *,
        appelant:appelant_id(nom, avatar_url),
        destinataire:destinataire_id(nom, avatar_url)
      `)
      .or(`appelant_id.eq.${userId},destinataire_id.eq.${userId}`)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error || !data) return []

    return data.map((row: CallRecord & {
      appelant?: { nom: string; avatar_url?: string }
      destinataire?: { nom: string; avatar_url?: string }
    }) => ({
      ...row,
      appelant_nom:        row.appelant?.nom || 'Inconnu',
      appelant_avatar:     row.appelant?.avatar_url || null,
      destinataire_nom:    row.destinataire?.nom || 'Inconnu',
      destinataire_avatar: row.destinataire?.avatar_url || null,
    }))
  }
}

// ── Singleton exporté ─────────────────────────────────────────────────────────
export const webrtcCallService = new WebRTCCallService()