// src/components/calls/IncomingCallModal.tsx
// ═══════════════════════════════════════════════════════════════════════════
// MODAL D'APPEL ENTRANT — NYME
// Affiché quand un appel WebRTC arrive pour l'utilisateur connecté.
// Sonnerrie + animation + boutons Accepter / Refuser
// Compatible : client, coursier, admin
// ═══════════════════════════════════════════════════════════════════════════
'use client'
import { useEffect, useRef } from 'react'
import { Phone, PhoneOff } from 'lucide-react'
import type { CallWithNames } from '@/services/webrtc-call-service'

interface Props {
  call:         CallWithNames
  onAccept:     () => void
  onRefuse:     () => void
}

export default function IncomingCallModal({ call, onAccept, onRefuse }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Sonnerie via Web Audio API — pas de fichier audio requis
  useEffect(() => {
    let ctx: AudioContext | null = null
    let stopped = false

    const ring = () => {
      if (stopped) return
      try {
        ctx = new (window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)()
        const oscillator = ctx.createOscillator()
        const gainNode   = ctx.createGain()
        oscillator.connect(gainNode)
        gainNode.connect(ctx.destination)
        oscillator.type      = 'sine'
        oscillator.frequency.setValueAtTime(440, ctx.currentTime)
        oscillator.frequency.setValueAtTime(480, ctx.currentTime + 0.5)
        gainNode.gain.setValueAtTime(0.3, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 1.0)
        oscillator.start(ctx.currentTime)
        oscillator.stop(ctx.currentTime + 1.0)
      } catch { /* silencieux si AudioContext non disponible */ }
    }

    ring()
    const interval = setInterval(ring, 1500)

    return () => {
      stopped = true
      clearInterval(interval)
      ctx?.close()
    }
  }, [])

  const callerName   = call.appelant_nom   || 'Quelqu\'un'
  const callerAvatar = call.appelant_avatar || null
  const callerRole   = call.appelant_role === 'client' ? 'Client' : 'Coursier'

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-white rounded-3xl shadow-2xl p-8 flex flex-col items-center gap-6 w-80 max-w-[90vw] animate-[fadeInScale_0.3s_ease-out]">

        {/* Avatar avec animation pulsante */}
        <div className="relative">
          <div className="absolute inset-0 rounded-full bg-green-400 animate-ping opacity-40 scale-150" />
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl relative z-10">
            {callerAvatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={callerAvatar}
                alt={callerName}
                className="w-24 h-24 rounded-full object-cover"
              />
            ) : (
              <span className="text-white text-4xl font-black select-none">
                {callerName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </div>

        {/* Infos appelant */}
        <div className="text-center">
          <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold mb-1">
            📞 Appel entrant — {callerRole}
          </p>
          <h2 className="text-2xl font-black text-gray-900">{callerName}</h2>
          {call.livraison_id && (
            <p className="text-xs text-blue-500 mt-1 font-medium">
              Livraison #{call.livraison_id.slice(0, 8).toUpperCase()}
            </p>
          )}
          <p className="text-sm text-gray-500 mt-2 animate-pulse">
            Appel en cours...
          </p>
        </div>

        {/* Boutons Refuser / Accepter */}
        <div className="flex items-center gap-8">
          {/* Refuser */}
          <button
            onClick={onRefuse}
            className="flex flex-col items-center gap-2 group"
            aria-label="Refuser l'appel"
          >
            <div className="w-16 h-16 bg-red-500 rounded-full flex items-center justify-center shadow-lg shadow-red-200 group-hover:bg-red-600 group-active:scale-95 transition-all">
              <PhoneOff size={26} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-gray-500">Refuser</span>
          </button>

          {/* Accepter */}
          <button
            onClick={onAccept}
            className="flex flex-col items-center gap-2 group"
            aria-label="Accepter l'appel"
          >
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center shadow-lg shadow-green-200 group-hover:bg-green-600 group-active:scale-95 transition-all animate-bounce">
              <Phone size={26} className="text-white" />
            </div>
            <span className="text-xs font-semibold text-gray-500">Accepter</span>
          </button>
        </div>
      </div>

      <style jsx>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}