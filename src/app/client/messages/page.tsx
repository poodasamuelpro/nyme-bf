// src/app/client/messages/page.tsx
// ✅ Mapping correct — communicationService.getUserConversations retourne Conversation[]
// Pas de changement de mapping nécessaire — fichier identique à l'original
'use client'
import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { communicationService } from '@/services/communication-service'
import type { Conversation } from '@/services/communication-service'

export default function ClientMessagesPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; nom: string } | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadConversations = useCallback(async (userId: string) => {
    try {
      const convs = await communicationService.getUserConversations(userId)
      setConversations(convs)
    } catch (err) {
      console.error('[MessagesPage] loadConversations:', err)
    }
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: userData } = await supabase
        .from('utilisateurs').select('id, nom').eq('id', session.user.id).single()
      if (!userData) { router.push('/login'); return }
      setUser(userData)
      await loadConversations(session.user.id)
      setLoading(false)
    }
    init()
  }, [router, loadConversations])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`messages-client-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        loadConversations(user.id)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, loadConversations])

  const filteredConversations = useMemo(() =>
    conversations.filter(c =>
      c.interlocuteur_nom.toLowerCase().includes(search.toLowerCase()) ||
      c.dernier_message?.toLowerCase().includes(search.toLowerCase())
    ), [conversations, search])

  const unreadCount = conversations.reduce((sum, c) => sum + c.messages_non_lus, 0)

  if (loading) return (
    <div className="min-h-screen bg-primary-600 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-primary-600 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 h-16">
            <button onClick={() => router.back()}
              className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors">←</button>
            <div>
              <h1 className="font-bold">Messagerie</h1>
              <p className="text-white/60 text-xs">{unreadCount > 0 ? `${unreadCount} non lus` : 'À jour'}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24">
        <input type="text" placeholder="Rechercher une conversation..."
          value={search} onChange={e => setSearch(e.target.value)}
          className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary-400 transition-colors mb-6" />

        {filteredConversations.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">💬</p>
            <h3 className="font-bold text-gray-900 mb-2">Aucune conversation</h3>
            <p className="text-gray-500 text-sm">
              {search ? 'Aucun résultat pour cette recherche' : 'Commencez une livraison pour discuter avec un coursier'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredConversations.map(conv => (
              <Link key={conv.interlocuteur_id} href={`/client/chat/${conv.interlocuteur_id}`}
                className="block bg-white p-4 rounded-2xl shadow-sm hover:shadow-md transition-all border-l-4 border-transparent hover:border-primary-500">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                    {conv.interlocuteur_nom?.charAt(0) ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-gray-900 truncate">{conv.interlocuteur_nom}</h3>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {conv.dernier_message_date && (
                          <span className="text-xs text-gray-400">
                            {new Date(conv.dernier_message_date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })}
                          </span>
                        )}
                        {conv.messages_non_lus > 0 && (
                          <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                            {conv.messages_non_lus}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 truncate mt-0.5">{conv.dernier_message || 'Aucun message'}</p>
                  </div>
                  <span className="text-gray-300 flex-shrink-0">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
