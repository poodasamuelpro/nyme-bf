// src/app/client/notifications/page.tsx — NOUVEAU FICHIER
// Centre de notifications client avec lecture individuelle et globale
// Route : /client/notifications
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Notification } from '@/lib/supabase'
import { ArrowLeft, Bell, BellOff, Check, CheckCheck, Trash2, Package, Zap, CreditCard, Star } from 'lucide-react'
import toast from 'react-hot-toast'

const NOTIF_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  course_acceptee:      { icon: '🛵', color: '#3b82f6', bg: '#eff6ff' },
  nouvelle_proposition: { icon: '💬', color: '#f97316', bg: '#fff7ed' },
  statut_livraison:     { icon: '📦', color: '#8b5cf6', bg: '#f5f3ff' },
  livraison_livree:     { icon: '🎉', color: '#22c55e', bg: '#f0fdf4' },
  paiement:             { icon: '💳', color: '#22c55e', bg: '#f0fdf4' },
  evaluation:           { icon: '⭐', color: '#eab308', bg: '#fefce8' },
  verification_documents: { icon: '🔏', color: '#6366f1', bg: '#eef2ff' },
  default:              { icon: '🔔', color: '#6b7280', bg: '#f9fafb' },
}

const NOTIF_LINKS: Record<string, (data: Record<string, string>) => string | null> = {
  course_acceptee:      (d) => d.livraison_id ? `/client/suivi/${d.livraison_id}` : null,
  nouvelle_proposition: (d) => d.livraison_id ? `/client/propositions/${d.livraison_id}` : null,
  statut_livraison:     (d) => d.livraison_id ? `/client/suivi/${d.livraison_id}` : null,
  livraison_livree:     (d) => d.livraison_id ? `/client/evaluation/${d.livraison_id}` : null,
  paiement:             (d) => d.livraison_id ? `/client/suivi/${d.livraison_id}` : null,
  evaluation:           () => null,
}

const fDate = (d: string) => {
  const now  = new Date()
  const date = new Date(d)
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60)   return 'À l\'instant'
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)}h`
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(date)
}

export default function NotificationsPage() {
  const router = useRouter()
  const [userId,        setUserId]        = useState<string | null>(null)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading,       setLoading]       = useState(true)
  const [filterLu,      setFilterLu]      = useState<'tous' | 'non_lu' | 'lu'>('tous')

  const loadNotifications = useCallback(async (uid: string) => {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(100)
    setNotifications((data || []) as Notification[])
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      const { data: u } = await supabase.from('utilisateurs').select('role').eq('id', session.user.id).single()
      if (!u || u.role !== 'client') { router.replace('/login'); return }
      setUserId(session.user.id)
      await loadNotifications(session.user.id)
      setLoading(false)
    }
    init()
  }, [router, loadNotifications])

  // Subscribe temps réel
  useEffect(() => {
    if (!userId) return
    const channel = supabase.channel(`notifs-client-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (p) => {
          setNotifications(prev => [p.new as Notification, ...prev])
          toast((p.new as Notification).titre || '🔔 Notification', { icon: '🔔' })
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  const markAsRead = async (notifId: string) => {
    await supabase.from('notifications').update({ lu: true }).eq('id', notifId)
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, lu: true } : n))
  }

  const markAllRead = async () => {
    if (!userId) return
    await supabase.from('notifications').update({ lu: true }).eq('user_id', userId).eq('lu', false)
    setNotifications(prev => prev.map(n => ({ ...n, lu: true })))
    toast.success('Tout marqué comme lu')
  }

  const deleteNotif = async (notifId: string) => {
    await supabase.from('notifications').delete().eq('id', notifId)
    setNotifications(prev => prev.filter(n => n.id !== notifId))
  }

  const filtered = notifications.filter(n => {
    if (filterLu === 'non_lu') return !n.lu
    if (filterLu === 'lu')     return n.lu
    return true
  })

  const unreadCount = notifications.filter(n => !n.lu).length

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 flex items-center gap-3 h-14">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <ArrowLeft size={16} className="text-gray-700" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <Bell size={18} className="text-blue-600" />
            <h1 className="font-black text-gray-900">Notifications</h1>
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <button onClick={markAllRead}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-blue-600 bg-blue-50">
              <CheckCheck size={13} />Tout lire
            </button>
          )}
        </div>

        {/* Filtres tabs */}
        <div className="max-w-2xl mx-auto px-4 pb-2 flex gap-2">
          {([
            { k: 'tous' as const,   label: 'Toutes', count: notifications.length },
            { k: 'non_lu' as const, label: 'Non lues', count: unreadCount },
            { k: 'lu' as const,     label: 'Lues', count: notifications.length - unreadCount },
          ]).map(f => (
            <button key={f.k} onClick={() => setFilterLu(f.k)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${filterLu === f.k ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {f.label}
              <span className={`text-[10px] ${filterLu === f.k ? 'text-blue-200' : 'text-gray-400'}`}>{f.count}</span>
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 pb-8">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <BellOff size={40} className="text-gray-200 mb-3" />
            <p className="text-gray-400 font-medium">
              {filterLu === 'non_lu' ? 'Aucune notification non lue 🎉' : 'Aucune notification'}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {filtered.map((notif, idx) => {
              const cfg   = NOTIF_ICONS[notif.type] || NOTIF_ICONS.default
              const data  = (notif.data || {}) as Record<string, string>
              const linkFn = NOTIF_LINKS[notif.type]
              const href  = linkFn ? linkFn(data) : null

              const Content = (
                <div className={`flex items-start gap-3 px-4 py-4 border-b border-gray-50 last:border-0 transition-colors ${!notif.lu ? 'bg-blue-50/30' : 'hover:bg-gray-50'}`}>
                  {/* Indicateur non lu */}
                  <div className="flex flex-col items-center gap-1 pt-1 shrink-0">
                    <div className={`w-2 h-2 rounded-full ${!notif.lu ? 'bg-blue-500' : 'bg-transparent'}`} />
                  </div>
                  {/* Icône */}
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                    style={{ background: cfg.bg }}>
                    {cfg.icon}
                  </div>
                  {/* Contenu */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${!notif.lu ? 'text-gray-900' : 'text-gray-600'}`}>
                      {notif.titre}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{notif.message}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{fDate(notif.created_at)}</p>
                  </div>
                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    {!notif.lu && (
                      <button onClick={(e) => { e.preventDefault(); markAsRead(notif.id) }}
                        className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center hover:bg-blue-200 transition-colors"
                        title="Marquer comme lu">
                        <Check size={13} className="text-blue-600" />
                      </button>
                    )}
                    <button onClick={(e) => { e.preventDefault(); deleteNotif(notif.id) }}
                      className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center hover:bg-red-100 transition-colors"
                      title="Supprimer">
                      <Trash2 size={12} className="text-red-400" />
                    </button>
                  </div>
                </div>
              )

              return href ? (
                <Link key={notif.id} href={href} onClick={() => !notif.lu && markAsRead(notif.id)}>
                  {Content}
                </Link>
              ) : (
                <div key={notif.id} onClick={() => !notif.lu && markAsRead(notif.id)} className="cursor-pointer">
                  {Content}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}