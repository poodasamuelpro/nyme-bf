'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { communicationService } from '@/services/communication-service'
import toast from 'react-hot-toast'

export default function ChatPage() {
  const params = useParams()
  const router = useRouter()
  const interlocuteurId = params.id as string

  const [user, setUser] = useState<any>(null)
  const [interlocuteur, setInterlocuteur] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback((force = false) => {
    if (!containerRef.current || !messagesEndRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100
    if (force || isNearBottom) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return router.push('/login')

    const { data: userData } = await supabase
      .from('utilisateurs')
      .select('id, nom')
      .eq('id', session.user.id)
      .single()
    setUser(userData)

    const { data: intData } = await supabase
      .from('utilisateurs')
      .select('nom, avatar_url')
      .eq('id', interlocuteurId)
      .single()
    setInterlocuteur(intData)

    // getConversation sans livraisonId (optionnel maintenant)
    const convMessages = await communicationService.getConversation(session.user.id, interlocuteurId)
    setMessages(convMessages)

    await communicationService.markMessagesAsRead(session.user.id, interlocuteurId)
    setLoading(false)
  }, [interlocuteurId, router])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    if (!loading) scrollToBottom(true)
  }, [loading, scrollToBottom])

  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      const userId = session.user.id

      const channel = supabase
        .channel(`chat-${interlocuteurId}-${userId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          const msg = payload.new as any
          const isRelevant =
            (msg.expediteur_id === userId && msg.destinataire_id === interlocuteurId) ||
            (msg.expediteur_id === interlocuteurId && msg.destinataire_id === userId)

          if (isRelevant) {
            setMessages((prev) => {
              if (prev.some((m) => m.id === msg.id)) return prev
              return [...prev, msg]
            })
            if (msg.expediteur_id !== userId) {
              communicationService.markMessagesAsRead(userId, interlocuteurId)
            }
          }
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    })
  }, [interlocuteurId])

  const handleSendMessage = async () => {
    if (!newMessage.trim() || sending || !user) return
    const content = newMessage.trim()
    setNewMessage('')
    setSending(true)
    try {
      await communicationService.sendMessage(user.id, interlocuteurId, content)
    } catch {
      toast.error("Erreur d'envoi")
      setNewMessage(content)
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-primary-600 p-4 text-white flex items-center gap-3 shadow-md">
        <button onClick={() => router.back()} className="text-xl hover:opacity-70 transition-opacity" aria-label="Retour">←</button>
        <div className="w-9 h-9 bg-white/20 rounded-full flex items-center justify-center font-bold">
          {interlocuteur?.nom?.charAt(0) ?? '?'}
        </div>
        <div className="font-bold">{interlocuteur?.nom ?? 'Utilisateur'}</div>
      </header>

      <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-gray-400 text-sm mt-8">Commencez la conversation 👋</p>
        )}
        {messages.map((msg) => {
          const isOwn = msg.expediteur_id === user?.id
          return (
            <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
              <div className={`p-3 rounded-2xl max-w-xs text-sm break-words shadow-sm ${isOwn ? 'bg-primary-500 text-white rounded-br-sm' : 'bg-white text-gray-800 rounded-bl-sm'}`}>
                {msg.contenu}
                <div className={`text-xs mt-1 ${isOwn ? 'text-white/60' : 'text-gray-400'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-3 bg-white border-t flex gap-2 items-center">
        <input
          type="text"
          className="flex-1 p-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-400 transition-colors"
          placeholder="Écrire un message..."
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button
          onClick={handleSendMessage}
          disabled={sending || !newMessage.trim()}
          className="bg-primary-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium disabled:opacity-50 transition-opacity"
        >
          {sending ? '...' : 'Envoyer'}
        </button>
      </div>
    </div>
  )
}
