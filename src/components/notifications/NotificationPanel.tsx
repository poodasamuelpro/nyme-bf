// src/components/notifications/NotificationPanel.tsx — NOUVEAU FICHIER
// Dropdown panel de notifications réutilisable (client et coursier)
// Usage : <NotificationPanel userId={userId} role="client" />
'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Notification } from '@/lib/supabase'
import { Bell, Check, CheckCheck, X, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'

const NOTIF_ICONS: Record<string, string> = {
  course_acceptee:      '🛵',
  nouvelle_proposition: '💬',
  statut_livraison:     '📦',
  livraison_livree:     '🎉',
  paiement:             '💳',
  evaluation:           '⭐',
  verification_documents: '🔏',
  default:              '🔔',
}

const NOTIF_LINKS: Record<string, (data: Record<string, string>, role: 'client' | 'coursier') => string | null> = {
  course_acceptee:      (d, r) => r === 'client' ? (d.livraison_id ? `/client/suivi/${d.livraison_id}` : null) : null,
  nouvelle_proposition: (d, r) => r === 'client' ? (d.livraison_id ? `/client/propositions/${d.livraison_id}` : null) : null,
  statut_livraison:     (d, r) => r === 'client' ? (d.livraison_id ? `/client/suivi/${d.livraison_id}` : null) : (d.livraison_id ? `/coursier/mission/${d.livraison_id}` : null),
  livraison_livree:     (d, r) => r === 'client' ? (d.livraison_id ? `/client/evaluation/${d.livraison_id}` : null) : null,
  paiement:             (d, r) => r === 'client' ? (d.livraison_id ? `/client/suivi/${d.livraison_id}` : null) : null,
}

const fDate = (d: string) => {
  const diff = Math.floor((Date.now() - new Date(d).getTime()) / 1000)
  if (diff < 60)   return 'À l\'instant'
  if (diff < 3600) return `${Math.floor(diff / 60)} min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(new Date(d))
}

interface Props {
  userId:    string
  role:      'client' | 'coursier'
  onClose?:  () => void
}

export default function NotificationPanel({ userId, role, onClose }: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading,       setLoading]       = useState(true)
  const panelRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30)
    setNotifications((data || []) as Notification[])
    setLoading(false)
  }, [userId])

  useEffect(() => {
    load()
    const channel = supabase.channel(`notif-panel-${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}`,
      }, (p) => {
        setNotifications(prev => [p.new as Notification, ...prev.slice(0, 29)])
        toast((p.new as Notification).titre || '🔔 Nouvelle notification', { icon: '🔔' })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId, load])

  // Fermer en cliquant dehors
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose?.()
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ lu: true }).eq('id', id)
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, lu: true } : n))
  }

  const markAllRead = async () => {
    await supabase.from('notifications').update({ lu: true }).eq('user_id', userId).eq('lu', false)
    setNotifications(prev => prev.map(n => ({ ...n, lu: true })))
  }

  const unreadCount = notifications.filter(n => !n.lu).length
  const dashPath    = role === 'client' ? '/client/notifications' : '/coursier/dashboard-new'

  return (
    <div ref={panelRef}
      className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50"
      style={{ maxHeight: '70vh' }}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-blue-600" />
          <span className="font-bold text-gray-900 text-sm">Notifications</span>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {unreadCount > 0 && (
            <button onClick={markAllRead} title="Tout marquer comme lu"
              className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center hover:bg-blue-100 transition-colors">
              <CheckCheck size={13} className="text-blue-600" />
            </button>
          )}
          <Link href={dashPath}
            className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
            title="Voir tout">
            <ExternalLink size={11} className="text-gray-600" />
          </Link>
          {onClose && (
            <button onClick={onClose}
              className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
              <X size={13} className="text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* Liste */}
      <div className="overflow-y-auto" style={{ maxHeight: 'calc(70vh - 50px)' }}>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center">
            <Bell size={28} className="text-gray-200 mx-auto mb-2" />
            <p className="text-gray-400 text-sm">Aucune notification</p>
          </div>
        ) : notifications.map(notif => {
          const icon    = NOTIF_ICONS[notif.type] || NOTIF_ICONS.default
          const data    = (notif.data || {}) as Record<string, string>
          const linkFn  = NOTIF_LINKS[notif.type]
          const href    = linkFn ? linkFn(data, role) : null

          const Content = (
            <div className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 transition-colors cursor-pointer ${!notif.lu ? 'bg-blue-50/40 hover:bg-blue-50/70' : 'hover:bg-gray-50'}`}
              onClick={() => !notif.lu && markAsRead(notif.id)}>
              <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${!notif.lu ? 'bg-blue-500' : 'bg-transparent'}`} />
              <span className="text-xl shrink-0">{icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold leading-tight ${!notif.lu ? 'text-gray-900' : 'text-gray-600'}`}>{notif.titre}</p>
                <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed line-clamp-2">{notif.message}</p>
                <p className="text-[10px] text-gray-400 mt-1">{fDate(notif.created_at)}</p>
              </div>
              {!notif.lu && (
                <button onClick={(e) => { e.stopPropagation(); markAsRead(notif.id) }}
                  className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center shrink-0 hover:bg-blue-200">
                  <Check size={11} className="text-blue-600" />
                </button>
              )}
            </div>
          )

          return href ? (
            <Link key={notif.id} href={href} onClick={() => { markAsRead(notif.id); onClose?.() }}>
              {Content}
            </Link>
          ) : (
            <div key={notif.id}>{Content}</div>
          )
        })}
      </div>
    </div>
  )
}