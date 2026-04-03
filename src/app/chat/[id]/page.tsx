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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const loadData = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return router.push('/login')
    const { data: userData } = await supabase.from('utilisateurs').select('id, nom').eq('id', session.user.id).single()
    setUser(userData)
    const { data: intData } = await supabase.from('utilisateurs').select('nom, avatar_url').eq('id', interlocuteurId).single()
    setInterlocuteur(intData)
    const convMessages = await communicationService.getConversation(session.user.id, interlocuteurId)
    setMessages(convMessages)
    await communicationService.markMessagesAsRead(session.user.id, interlocuteurId)
    setLoading(false)
  }, [interlocuteurId, router])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const channel = supabase.channel(`chat-${interlocuteurId}`).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => { loadData() }).subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [interlocuteurId, loadData])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return
    try {
      await communicationService.sendMessage(user.id, interlocuteurId, newMessage.trim())
      setNewMessage('')
      loadData()
    } catch (err) { toast.error('Erreur d\'envoi') }
  }

  if (loading) return <div className="h-screen flex items-center justify-center">Chargement...</div>

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <header className="bg-primary-600 p-4 text-white flex items-center gap-3">
        <button onClick={() => router.back()}>←</button>
        <div className="font-bold">{interlocuteur?.nom}</div>
      </header>
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.expediteur_id === user?.id ? 'justify-end' : 'justify-start'}`}>
            <div className={`p-3 rounded-2xl max-w-xs ${msg.expediteur_id === user?.id ? 'bg-primary-500 text-white' : 'bg-white'}`}>
              {msg.contenu}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="p-4 bg-white flex gap-2">
        <input type="text" className="flex-1 p-2 border rounded-xl" value={newMessage} onChange={e => setNewMessage(e.target.value)} onKeyPress={e => e.key === 'Enter' && handleSendMessage()} />
        <button onClick={handleSendMessage} className="bg-primary-600 text-white px-4 py-2 rounded-xl">Envoyer</button>
      </div>
    </div>
  )
}
