// src/app/coursier/chat/[id]/page.tsx — NOUVEAU FICHIER
// Page chat coursier ↔ client (par interlocuteur_id)
// Route : /coursier/chat/[id]  (id = user_id du client)
'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { communicationService } from '@/services/communication-service'
import type { MessageWithAuthor } from '@/services/communication-service'
import { ArrowLeft, Send, Phone } from 'lucide-react'
import toast from 'react-hot-toast'

const fTime = (d: string) =>
  new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(d))

export default function CoursierChatPage() {
  const { id: clientId } = useParams<{ id: string }>()
  const router = useRouter()

  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [interlocuteur, setInterlocuteur] = useState<{ nom: string; telephone?: string; avatar_url?: string } | null>(null)
  const [messages,    setMessages]    = useState<MessageWithAuthor[]>([])
  const [newMessage,  setNewMessage]  = useState('')
  const [loading,     setLoading]     = useState(true)
  const [sending,     setSending]     = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const loadMessages = useCallback(async (uid: string) => {
    try {
      const msgs = await communicationService.getConversation(uid, clientId)
      setMessages(msgs)
      // Marquer comme lus
      await communicationService.markMessagesAsRead(uid, clientId)
    } catch {}
  }, [clientId])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/coursier/login'); return }
      const { data: u } = await supabase.from('utilisateurs').select('role').eq('id', session.user.id).single()
      if (!u || u.role !== 'coursier') { router.replace('/coursier/login'); return }
      setCurrentUserId(session.user.id)

      // Charger l'interlocuteur (client)
      const { data: client } = await supabase
        .from('utilisateurs').select('nom, telephone, avatar_url').eq('id', clientId).single()
      if (client) setInterlocuteur(client)

      await loadMessages(session.user.id)
      setLoading(false)
    }
    init()
  }, [router, clientId, loadMessages])

  // Auto-scroll vers le bas
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Subscribe temps réel
  useEffect(() => {
    if (!currentUserId) return
    const channel = supabase
      .channel(`chat-coursier-${currentUserId}-${clientId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'messages',
      }, async (p) => {
        const msg = p.new as MessageWithAuthor
        if (
          (msg.expediteur_id === currentUserId && msg.destinataire_id === clientId) ||
          (msg.expediteur_id === clientId && msg.destinataire_id === currentUserId)
        ) {
          setMessages(prev => [...prev, msg])
          if (msg.expediteur_id === clientId) {
            await communicationService.markMessagesAsRead(currentUserId, clientId)
          }
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [currentUserId, clientId])

  const handleSend = async () => {
    if (!currentUserId || !newMessage.trim() || sending) return
    setSending(true)
    try {
      await communicationService.sendMessage(currentUserId, clientId, newMessage.trim())
      setNewMessage('')
    } catch {
      toast.error("Erreur lors de l'envoi")
    } finally {
      setSending(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 flex items-center gap-3 h-14">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <ArrowLeft size={16} className="text-gray-700" />
          </button>
          <div className="flex items-center gap-2 flex-1">
            {interlocuteur?.avatar_url
              ? <img src={interlocuteur.avatar_url} alt={interlocuteur.nom}
                  className="w-9 h-9 rounded-full object-cover border-2 border-orange-100" />
              : <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ background: 'linear-gradient(135deg, #1a56db, #f97316)' }}>
                  {interlocuteur?.nom?.charAt(0).toUpperCase() || '?'}
                </div>
            }
            <div>
              <p className="font-bold text-gray-900 text-sm leading-tight">{interlocuteur?.nom || 'Client'}</p>
              <p className="text-[10px] text-gray-400">Client NYME</p>
            </div>
          </div>
          {interlocuteur?.telephone && (
            <a href={`tel:${interlocuteur.telephone}`}
              className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
              <Phone size={16} className="text-green-600" />
            </a>
          )}
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto max-w-2xl mx-auto w-full px-4 py-4 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center">
            <p className="text-gray-300 text-4xl mb-3">💬</p>
            <p className="text-gray-400 text-sm">Aucun message — démarrez la conversation</p>
          </div>
        ) : messages.map((msg, i) => {
          const isMine = msg.expediteur_id === currentUserId
          const showDate = i === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[i-1].created_at).toDateString()

          return (
            <div key={msg.id}>
              {showDate && (
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-[10px] text-gray-400 font-medium px-2">
                    {new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long' }).format(new Date(msg.created_at))}
                  </span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>
              )}
              <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${
                  isMine
                    ? 'rounded-br-md text-white'
                    : 'rounded-bl-md bg-white text-gray-900 border border-gray-100'
                }`}
                  style={isMine ? { background: '#f97316' } : {}}>
                  <p className="leading-relaxed">{msg.contenu}</p>
                  <p className={`text-[10px] mt-1 ${isMine ? 'text-white/70 text-right' : 'text-gray-400'}`}>
                    {fTime(msg.created_at)}
                    {isMine && (msg.lu ? ' ✓✓' : ' ✓')}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </main>

      {/* Zone de saisie */}
      <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
            placeholder="Message..."
            className="flex-1 px-4 py-3 border border-gray-200 rounded-2xl text-sm outline-none focus:border-orange-400 bg-gray-50"
          />
          <button onClick={handleSend} disabled={sending || !newMessage.trim()}
            className="w-11 h-11 rounded-2xl text-white flex items-center justify-center disabled:opacity-50 transition-all active:scale-95"
            style={{ background: '#f97316' }}>
            {sending
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : <Send size={16} />
            }
          </button>
        </div>
      </div>
    </div>
  )
}