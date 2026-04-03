'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { communicationService } from '@/services/communication-service'
import toast from 'react-hot-toast'

export default function MessagesPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string; nom: string } | null>(null)
  const [conversations, setConversations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const loadConversations = useCallback(async (userId: string) => {
    try {
      const convs = await communicationService.getUserConversations(userId)
      setConversations(convs)
    } catch (err) { console.error(err) }
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/login')
      const { data: userData } = await supabase.from('utilisateurs').select('id, nom').eq('id', session.user.id).single()
      if (!userData) return router.push('/login')
      setUser(userData)
      await loadConversations(session.user.id)
      setLoading(false)
    }
    init()
  }, [router, loadConversations])

  useEffect(() => {
    if (!user) return
    const channel = supabase.channel('messages-updates').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
      loadConversations(user.id)
    }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, loadConversations])

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-primary-600"><div className="w-12 h-12 border-4 border-t-white rounded-full animate-spin"></div></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-primary-600 p-4 text-white sticky top-0 z-10">
        <h1 className="font-bold text-xl">Messagerie</h1>
      </header>
      <main className="p-4 max-w-4xl mx-auto">
        <input type="text" placeholder="Rechercher..." className="w-full p-3 rounded-xl border mb-4" value={search} onChange={e => setSearch(e.target.value)} />
        <div className="space-y-3">
          {conversations.map(conv => (
            <Link key={conv.interlocuteur_id} href={`/chat/${conv.interlocuteur_id}`} className="block bg-white p-4 rounded-2xl shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-primary-500 rounded-full flex items-center justify-center text-white font-bold">{conv.interlocuteur_nom?.charAt(0)}</div>
                <div className="flex-1">
                  <div className="flex justify-between"><h3 className="font-bold">{conv.interlocuteur_nom}</h3>{conv.messages_non_lus > 0 && <span className="bg-red-500 text-white text-xs px-2 rounded-full">{conv.messages_non_lus}</span>}</div>
                  <p className="text-sm text-gray-500 truncate">{conv.dernier_message}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  )
}
