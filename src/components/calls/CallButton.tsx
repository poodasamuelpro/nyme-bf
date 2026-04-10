// src/components/calls/CallButton.tsx
// ═══════════════════════════════════════════════════════════════════════════
// BOUTON D'APPEL WEBRTC — NYME
// Bouton réutilisable pour déclencher un appel audio WebRTC.
// À placer partout où un appel est possible : suivi, mission, profil, etc.
// Gère automatiquement l'état (en appel / disponible / loading).
// ═══════════════════════════════════════════════════════════════════════════
'use client'
import { useState } from 'react'
import { Phone, PhoneCall } from 'lucide-react'
import toast from 'react-hot-toast'
import { webrtcCallService, type CallerRole } from '@/services/webrtc-call-service'

interface Props {
  /** ID de l'utilisateur qui appelle (l'utilisateur connecté) */
  appelantId:     string
  /** Rôle de l'appelant */
  appelantRole:   CallerRole
  /** ID du destinataire */
  destinataireId: string
  /** ID de la livraison liée (optionnel, pour la traçabilité) */
  livraisonId?:   string
  /** Style visuel : 'icon' = bouton rond icône, 'full' = bouton plein texte */
  variant?:       'icon' | 'full' | 'mini'
  /** Classes CSS supplémentaires */
  className?:     string
  /** Titre/tooltip du bouton (optionnel) */
  title?:         string
  /** Callback appelé quand l'appel démarre avec succès */
  onCallStarted?: (callId: string) => void
}

export default function CallButton({
  appelantId,
  appelantRole,
  destinataireId,
  livraisonId,
  variant = 'icon',
  className = '',
  title,
  onCallStarted,
}: Props) {
  const [loading, setLoading] = useState(false)

  const handleCall = async () => {
    if (loading) return

    // Vérifier la compatibilité WebRTC du navigateur
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Votre navigateur ne supporte pas les appels. Utilisez Chrome ou Firefox.')
      return
    }

    setLoading(true)
    try {
      const callId = await webrtcCallService.startCall({
        appelantId,
        appelantRole,
        destinataireId,
        livraisonId,
      })

      if (callId) {
        toast.success('📞 Appel en cours... En attente de réponse', { duration: 3000 })
        onCallStarted?.(callId)
      } else {
        toast.error('Impossible de démarrer l\'appel. Réessayez.')
      }
    } catch (err) {
      console.error('[CallButton] error:', err)
      toast.error('Erreur lors du démarrage de l\'appel')
    } finally {
      setLoading(false)
    }
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={handleCall}
        disabled={loading}
        title={title ?? 'Appel audio'}
        aria-label={title ?? 'Appeler'}
        className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 ${
          loading
            ? 'bg-gray-100 cursor-wait'
            : 'bg-green-100 hover:bg-green-200 text-green-700'
        } ${className}`}
      >
        {loading
          ? <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          : <Phone size={18} />
        }
      </button>
    )
  }

  if (variant === 'mini') {
    return (
      <button
        onClick={handleCall}
        disabled={loading}
        title={title ?? 'Appel audio'}
        aria-label={title ?? 'Appeler'}
        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 ${
          loading
            ? 'bg-gray-100 cursor-wait'
            : 'bg-green-100 hover:bg-green-200 text-green-700'
        } ${className}`}
      >
        {loading
          ? <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
          : <Phone size={14} />
        }
      </button>
    )
  }

  // variant === 'full'
  return (
    <button
      onClick={handleCall}
      disabled={loading}
      title={title ?? 'Appel audio'}
      aria-label={title ?? 'Appeler'}
      className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-50 ${
        loading
          ? 'bg-gray-100 text-gray-400 cursor-wait'
          : 'bg-green-500 text-white hover:bg-green-600 shadow-sm shadow-green-200'
      } ${className}`}
    >
      {loading ? (
        <>
          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          <span>Appel...</span>
        </>
      ) : (
        <>
          <PhoneCall size={16} />
          <span>Appeler</span>
        </>
      )}
    </button>
  )
}
