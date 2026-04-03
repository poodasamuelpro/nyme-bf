'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { communicationService } from '@/services/communication-service'
import type { MessageWithAuthor } from '@/services/communication-service'
import toast from 'react-hot-toast'

export default function ClientChatPage() {
  const params = useParams()
  const router = useRouter()
  const interlocuteurId = params.id as string

  const [user, setUser] = useState<{ id: string; nom: string } | null>(null)
  const [interlocuteur, setInterlocuteur] = useState<{ nom: string; avatar_url?: string } | null>(null)
  const [messages, setMessages] = useState<MessageWithAuthor[]>([])
  const [loading, setLoading] = useState(true)
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = useCallback((force = false) => {
    if (!containerRef.current || !messagesEndRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current
    if (force || scrollHeight - scrollTop - clientHeight < 120) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.push('/login'); return }

    const { data: userData } = await supabase
      .from('utilisateurs').select('id, nom').eq('id', session.user.id).single()
    if (!userData) { router.push('/login'); return }
    setUser(userData)

    const { data: intData } = await supabase
      .from('utilisateurs').select('nom, avatar_url').eq('id', interlocuteurId).single()
    if (intData) setInterlocuteur(intData)

    const convMessages = await communicationService.getConversation(session.user.id, interlocuteurId)
    setMessages(convMessages)

    await communicationService.markMessagesAsRead(session.user.id, interlocuteurId)
    setLoading(false)
  }, [interlocuteurId, router])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { if (!loading) scrollToBottom(true) }, [loading, scrollToBottom])
  useEffect(() => { scrollToBottom() }, [messages, scrollToBottom])

  // Realtime — filtré sur cette conversation
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      const userId = session.user.id

      const channel = supabase
        .channel(`client-chat-${interlocuteurId}-${userId}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
          const msg = payload.new as MessageWithAuthor
          const isRelevant =
            (msg.expediteur_id === userId && msg.destinataire_id === interlocuteurId) ||
            (msg.expediteur_id === interlocuteurId && msg.destinataire_id === userId)
          if (!isRelevant) return
          setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg])
          if (msg.expediteur_id !== userId) {
            communicationService.markMessagesAsRead(userId, interlocuteurId)
          }
        })
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    })
  }, [interlocuteurId])

  const handleSendMessage = async () => {
    if (!user || !newMessage.trim() || sending) return
    const content = newMessage.trim()
    setNewMessage('')
    setSending(true)
    try {
      await communicationService.sendMessage(user.id, interlocuteurId, content)
    } catch {
      toast.error("Erreur lors de l'envoi")
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
      <div className="min-h-screen bg-primary-600 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-primary-600 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 w-full">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors"
              >←</button>
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center font-bold">
                {interlocuteur?.nom?.charAt(0) ?? '?'}
              </div>
              <div>
                <h1 className="font-bold">{interlocuteur?.nom ?? 'Chat'}</h1>
                <p className="text-white/60 text-xs">● En ligne</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors text-lg"
                onClick={() => toast('Fonctionnalité bientôt disponible', { icon: '📞' })}
              >📞</button>
              <button
                className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors text-lg"
                onClick={() => toast('WhatsApp bientôt disponible', { icon: '💬' })}
              >💬</button>
            </div>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div ref={containerRef} className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4 max-w-4xl mx-auto w-full">
        {messages.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">💬</p>
            <p className="text-gray-500">Aucun message. Commencez la conversation !</p>
          </div>
        ) : (
          messages.map(msg => {
            const isOwn = msg.expediteur_id === user?.id
            return (
              <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-2.5 rounded-2xl text-sm break-words shadow-sm ${
                  isOwn ? 'bg-primary-500 text-white rounded-br-none' : 'bg-white text-gray-900 rounded-bl-none'
                }`}>
                  <p>{msg.contenu}</p>
                  <p className={`text-xs mt-1 ${isOwn ? 'text-white/70' : 'text-gray-400'}`}>
                    {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 sm:px-6 py-3 max-w-4xl mx-auto w-full">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Écrivez un message..."
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={sending}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-400 transition-colors"
          />
          <button
            onClick={handleSendMessage}
            disabled={sending || !newMessage.trim()}
            className="px-4 py-2.5 rounded-xl bg-primary-500 text-white font-semibold hover:bg-primary-600 transition-colors disabled:opacity-50"
          >
            {sending ? '...' : '→'}
          </button>
        </div>
      </div>
    </div>
  )
}
