// src/app/coursier/messages/page.tsx — NOUVEAU FICHIER
// Liste des conversations du coursier avec ses clients
// Route : /coursier/messages
'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { communicationService } from '@/services/communication-service'
import type { Conversation } from '@/services/communication-service'
import { ArrowLeft, MessageSquare, Search, User } from 'lucide-react'

const fDate = (d: string) => {
  const now  = new Date()
  const date = new Date(d)
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60)    return 'À l\'instant'
  if (diff < 3600)  return `${Math.floor(diff / 60)} min`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(date)
}

export default function CoursierMessagesPage() {
  const router = useRouter()
  const [user,          setUser]          = useState<{ id: string; nom: string } | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading,       setLoading]       = useState(true)
  const [search,        setSearch]        = useState('')

  const loadConversations = useCallback(async (userId: string) => {
    try {
      const convs = await communicationService.getUserConversations(userId)
      setConversations(convs)
    } catch (err) {
      console.error('[CoursierMessagesPage] loadConversations:', err)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/coursier/login'); return }
      const { data: u } = await supabase.from('utilisateurs').select('id, nom, role').eq('id', session.user.id).single()
      if (!u || u.role !== 'coursier') { router.replace('/coursier/login'); return }
      setUser(u)
      await loadConversations(session.user.id)
      setLoading(false)
    }
    init()
  }, [router, loadConversations])

  // Subscribe temps réel
  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`messages-coursier-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        loadConversations(user.id)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, loadConversations])

  const filtered = useMemo(() =>
    conversations.filter(c =>
      c.interlocuteur_nom.toLowerCase().includes(search.toLowerCase()) ||
      c.dernier_message?.toLowerCase().includes(search.toLowerCase())
    ), [conversations, search])

  const totalNonLus = conversations.reduce((s, c) => s + c.messages_non_lus, 0)

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 flex items-center gap-3 h-14">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <ArrowLeft size={16} className="text-gray-700" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <MessageSquare size={18} style={{ color: '#f97316' }} />
            <h1 className="font-black text-gray-900">Messages</h1>
            {totalNonLus > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {totalNonLus}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 pb-8 space-y-3">
        {/* Recherche */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une conversation..."
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-2xl text-sm outline-none focus:border-orange-400 bg-white" />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare size={40} className="text-gray-200 mb-3" />
            <p className="text-gray-400 font-medium">
              {search ? 'Aucune conversation trouvée' : 'Aucune conversation pour l\'instant'}
            </p>
            <p className="text-gray-300 text-xs mt-1">
              Les messages apparaissent quand vous êtes assigné à une mission
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {filtered.map((conv) => (
              <Link key={conv.interlocuteur_id}
                href={`/coursier/chat/${conv.interlocuteur_id}`}
                className="flex items-center gap-3 px-4 py-4 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">

                {/* Avatar */}
                {conv.interlocuteur_avatar
                  ? <img src={conv.interlocuteur_avatar} alt={conv.interlocuteur_nom}
                      className="w-12 h-12 rounded-full object-cover border-2 border-orange-100 shrink-0" />
                  : <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                      style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
                      {conv.interlocuteur_nom.charAt(0).toUpperCase()}
                    </div>
                }

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className={`text-sm font-bold truncate ${conv.messages_non_lus > 0 ? 'text-gray-900' : 'text-gray-700'}`}>
                      {conv.interlocuteur_nom}
                    </p>
                    <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                      {fDate(conv.dernier_message_date)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className={`text-xs truncate ${conv.messages_non_lus > 0 ? 'text-gray-700 font-semibold' : 'text-gray-400'}`}>
                      {conv.dernier_message || '…'}
                    </p>
                    {conv.messages_non_lus > 0 && (
                      <span className="ml-2 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center shrink-0"
                        style={{ background: '#f97316' }}>
                        {conv.messages_non_lus > 9 ? '9+' : conv.messages_non_lus}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}