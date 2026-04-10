// src/services/firebase-notification-service.ts
// ═══════════════════════════════════════════════════════════════════════════
// SERVICE FIREBASE CLOUD MESSAGING (FCM) — NYME
// Envoi de notifications push via l'API HTTP FCM v1 (REST, pas SDK Admin)
// Variables requises : FIREBASE_PROJECT_ID, FIREBASE_SERVICE_ACCOUNT_JSON
// Compatible : Next.js Edge / Serverless (pas de dépendance firebase-admin)
// ═══════════════════════════════════════════════════════════════════════════

import { supabaseAdmin } from '@/lib/supabase-admin'

// ── Types ────────────────────────────────────────────────────────────────────

export interface FCMNotificationPayload {
  title:      string
  body:       string
  imageUrl?:  string
  data?:      Record<string, string>
  clickAction?: string
}

export interface FCMSendResult {
  success:   boolean
  messageId?: string
  error?:    string
}

// ── Cache du token d'accès ───────────────────────────────────────────────────

let cachedAccessToken: string | null    = null
let tokenExpiry:       number           = 0

// ── Classe principale ────────────────────────────────────────────────────────

class FirebaseNotificationService {
  private projectId:      string | null = null
  private serviceAccount: Record<string, string> | null = null

  constructor() {
    this.projectId = process.env.FIREBASE_PROJECT_ID?.trim() || null
    const svcAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
    if (svcAccountJson) {
      try {
        this.serviceAccount = JSON.parse(svcAccountJson)
      } catch {
        console.error('[FCM] FIREBASE_SERVICE_ACCOUNT_JSON invalide — JSON malformé')
      }
    }
  }

  // ── Token d'accès OAuth2 ────────────────────────────────────────────────

  /**
   * Obtient un token d'accès OAuth2 pour l'API FCM v1.
   * Utilise le service account JSON pour créer un JWT et l'échanger contre un token.
   * Le token est mis en cache jusqu'à expiration.
   */
  private async getAccessToken(): Promise<string | null> {
    if (!this.serviceAccount) {
      console.error('[FCM] Service account non configuré (FIREBASE_SERVICE_ACCOUNT_JSON)')
      return null
    }

    // Retourner le token en cache s'il est encore valide (marge de 60s)
    if (cachedAccessToken && Date.now() < tokenExpiry - 60000) {
      return cachedAccessToken
    }

    try {
      const {
        client_email: clientEmail,
        private_key:  privateKey,
      } = this.serviceAccount as { client_email: string; private_key: string }

      if (!clientEmail || !privateKey) {
        console.error('[FCM] Service account invalide (client_email ou private_key manquant)')
        return null
      }

      const now        = Math.floor(Date.now() / 1000)
      const expiration = now + 3600  // 1 heure

      // Créer le JWT header et payload
      const header  = { alg: 'RS256', typ: 'JWT' }
      const payload = {
        iss:   clientEmail,
        sub:   clientEmail,
        aud:   'https://oauth2.googleapis.com/token',
        iat:   now,
        exp:   expiration,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
      }

      const encodedHeader  = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
      const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
      const signingInput   = `${encodedHeader}.${encodedPayload}`

      // Signer avec la clé privée RSA
      const pemKey = privateKey.replace(/\\n/g, '\n')
      const cryptoKey = await crypto.subtle.importKey(
        'pkcs8',
        this.pemToArrayBuffer(pemKey),
        { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
        false,
        ['sign']
      )

      const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        cryptoKey,
        new TextEncoder().encode(signingInput)
      )

      const encodedSig = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')

      const jwt = `${signingInput}.${encodedSig}`

      // Échanger le JWT contre un access token
      const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion:  jwt,
        }),
      })

      const data = await res.json() as { access_token?: string; expires_in?: number; error?: string }

      if (!res.ok || !data.access_token) {
        console.error('[FCM] Échange JWT échoué:', data.error || res.status)
        return null
      }

      cachedAccessToken = data.access_token
      tokenExpiry       = Date.now() + (data.expires_in || 3600) * 1000
      return cachedAccessToken

    } catch (err) {
      console.error('[FCM] getAccessToken error:', err)
      return null
    }
  }

  // ── Envoi d'une notification à un token FCM ──────────────────────────────

  /**
   * Envoie une notification push à un token FCM spécifique.
   */
  async sendToToken(
    fcmToken:    string,
    payload:     FCMNotificationPayload
  ): Promise<FCMSendResult> {
    if (!this.projectId) {
      return { success: false, error: 'FIREBASE_PROJECT_ID non configuré' }
    }

    const accessToken = await this.getAccessToken()
    if (!accessToken) {
      return { success: false, error: 'Token d\'accès FCM indisponible' }
    }

    const message: Record<string, unknown> = {
      token:        fcmToken,
      notification: {
        title: payload.title,
        body:  payload.body,
        ...(payload.imageUrl ? { image: payload.imageUrl } : {}),
      },
      android: {
        notification: {
          sound:       'default',
          click_action: payload.clickAction || 'FLUTTER_NOTIFICATION_CLICK',
          channel_id:  'nyme_channel_high',
        },
        priority: 'HIGH',
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    }

    // Ajouter les données supplémentaires si présentes
    if (payload.data && Object.keys(payload.data).length > 0) {
      message.data = payload.data
    }

    try {
      const res = await fetch(
        `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ message }),
        }
      )

      const data = await res.json() as { name?: string; error?: { message: string } }

      if (!res.ok) {
        const errMsg = data.error?.message || `HTTP ${res.status}`
        console.error(`[FCM] Envoi échoué pour token ${fcmToken.slice(0, 20)}... : ${errMsg}`)
        return { success: false, error: errMsg }
      }

      return { success: true, messageId: data.name }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[FCM] sendToToken exception:', msg)
      return { success: false, error: msg }
    }
  }

  // ── Envoi vers un utilisateur Supabase ───────────────────────────────────

  /**
   * Envoie une notification push à un utilisateur par son ID Supabase.
   * Récupère automatiquement le fcm_token depuis la table utilisateurs.
   * Insère aussi la notification dans la table notifications (in-app).
   */
  async sendToUser(
    userId:       string,
    payload:      FCMNotificationPayload,
    type?:        string
  ): Promise<FCMSendResult> {
    // Récupérer le FCM token de l'utilisateur
    const { data: user, error } = await supabaseAdmin
      .from('utilisateurs')
      .select('fcm_token')
      .eq('id', userId)
      .single()

    if (error || !user?.fcm_token) {
      // Pas de token FCM — l'utilisateur n'a pas activé les notifications push
      // On insère quand même la notification in-app
      return { success: false, error: 'Utilisateur sans token FCM' }
    }

    return this.sendToToken(user.fcm_token, payload)
  }

  /**
   * Envoie une notification à plusieurs utilisateurs en parallèle.
   * Ignore silencieusement ceux sans token FCM.
   */
  async sendToMultipleUsers(
    userIds:  string[],
    payload:  FCMNotificationPayload
  ): Promise<{ userId: string; result: FCMSendResult }[]> {
    const results = await Promise.allSettled(
      userIds.map(async uid => ({
        userId: uid,
        result: await this.sendToUser(uid, payload),
      }))
    )

    return results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<{ userId: string; result: FCMSendResult }>).value)
  }

  /**
   * Envoie une notification de statut de livraison au client et au coursier.
   * Insère aussi dans la table notifications.
   */
  async notifyLivraisonStatut(params: {
    clientId:    string
    coursierId?: string
    livraisonId: string
    statut:      string
    titre:       string
    message:     string
  }): Promise<void> {
    const data: Record<string, string> = {
      livraison_id: params.livraisonId,
      statut:       params.statut,
      type:         'statut_livraison',
    }

    const payload: FCMNotificationPayload = {
      title:       params.titre,
      body:        params.message,
      data,
      clickAction: 'FLUTTER_NOTIFICATION_CLICK',
    }

    // Notifier client
    await this.sendToUser(params.clientId, payload, 'statut_livraison')

    // Notifier coursier si présent
    if (params.coursierId) {
      await this.sendToUser(params.coursierId, payload, 'statut_livraison')
    }
  }

  /**
   * Notifie les coursiers disponibles d'une nouvelle demande de livraison.
   */
  async notifyNewLivraisonToCoursiers(
    coursierIds: string[],
    livraisonId: string,
    prixCalc:    number
  ): Promise<void> {
    if (coursierIds.length === 0) return

    const payload: FCMNotificationPayload = {
      title: '🛵 Nouvelle course disponible !',
      body:  `${prixCalc.toLocaleString('fr-FR')} XOF — Acceptez avant les autres !`,
      data: {
        livraison_id: livraisonId,
        type:         'nouvelle_course',
        prix:         String(prixCalc),
      },
      clickAction: 'FLUTTER_NOTIFICATION_CLICK',
    }

    await this.sendToMultipleUsers(coursierIds, payload)
  }

  // ── Vérification de disponibilité ────────────────────────────────────────

  /**
   * Vérifie si le service FCM est correctement configuré.
   */
  isConfigured(): boolean {
    return !!(this.projectId && this.serviceAccount)
  }

  // ── Utilitaires ──────────────────────────────────────────────────────────

  /**
   * Convertit une clé PEM en ArrayBuffer pour Web Crypto API.
   */
  private pemToArrayBuffer(pem: string): ArrayBuffer {
    const lines = pem
      .replace('-----BEGIN PRIVATE KEY-----', '')
      .replace('-----END PRIVATE KEY-----', '')
      .replace(/\s/g, '')
    const binary = atob(lines)
    const buffer = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      buffer[i] = binary.charCodeAt(i)
    }
    return buffer.buffer
  }
}

// ── Singleton exporté ─────────────────────────────────────────────────────────
export const firebaseNotificationService = new FirebaseNotificationService()