// src/app/client/profil/page.tsx
'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Utilisateur } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function ProfilPage() {
  const router = useRouter()
  const [user, setUser] = useState<Utilisateur | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ nom: '', telephone: '', whatsapp: '', avatar_url: '' })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: userData } = await supabase.from('utilisateurs').select('*').eq('id', session.user.id).single()
      if (!userData) { router.push('/login'); return }
      setUser(userData as Utilisateur)
      setForm({ nom: userData.nom || '', telephone: userData.telephone || '', whatsapp: userData.whatsapp || '', avatar_url: userData.avatar_url || '' })
      setLoading(false)
    }
    init()
  }, [router])

  const handleSave = async () => {
    if (!user) return
    setSubmitting(true)
    try {
      const { error } = await supabase.from('utilisateurs').update({ nom: form.nom, telephone: form.telephone, whatsapp: form.whatsapp, avatar_url: form.avatar_url }).eq('id', user.id)
      if (error) throw error
      setUser(prev => prev ? { ...prev, ...form } : null)
      setEditing(false)
      toast.success('Profil mis à jour !')
    } catch { toast.error('Erreur lors de la mise à jour') }
    finally { setSubmitting(false) }
  }

  if (loading) return <div className="min-h-screen bg-primary-600 flex items-center justify-center"><div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" /></div>
  if (!user) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-primary-600 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 h-16">
            <button onClick={() => router.back()} className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">←</button>
            <div><h1 className="font-bold">Mon profil</h1><p className="text-white/60 text-xs">Gérez vos informations</p></div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-24 space-y-6">
        {/* Avatar */}
        <div className="text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-black text-4xl mx-auto mb-3">
            {user.nom?.charAt(0) || '👤'}
          </div>
          <h2 className="text-2xl font-black text-gray-900">{user.nom}</h2>
          <p className="text-gray-500 text-sm">Client NYME</p>
        </div>

        {!editing ? (
          <div className="space-y-3">
            {[
              { label: 'Email', value: user.email },
              { label: 'Téléphone', value: user.telephone },
              { label: 'WhatsApp', value: user.whatsapp || 'Non défini' },
            ].map(item => (
              <div key={item.label} className="bg-white rounded-2xl p-4 shadow-sm">
                <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                <p className="font-semibold text-gray-900">{item.value}</p>
              </div>
            ))}
            <div className="bg-white rounded-2xl p-4 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">Statut</p>
              <div className="flex items-center gap-2"><span className="w-2 h-2 bg-green-500 rounded-full" /><p className="font-semibold text-gray-900">Compte actif</p></div>
            </div>
            <button onClick={() => setEditing(true)} className="w-full py-3 rounded-xl bg-primary-500 text-white font-bold hover:bg-primary-600">✏️ Modifier le profil</button>
          </div>
        ) : (
          <div className="space-y-4">
            {[
              { label: 'Nom complet', key: 'nom', type: 'text' },
              { label: 'Téléphone', key: 'telephone', type: 'tel' },
              { label: 'WhatsApp', key: 'whatsapp', type: 'tel' },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-sm font-semibold text-gray-700 mb-1">{field.label}</label>
                <input type={field.type} value={form[field.key as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-400" />
              </div>
            ))}
            <div className="flex gap-3">
              <button onClick={() => setEditing(false)} className="flex-1 py-3 rounded-xl border-2 border-gray-200 font-bold text-gray-700">Annuler</button>
              <button onClick={handleSave} disabled={submitting} className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-bold disabled:opacity-50">{submitting ? 'Sauvegarde...' : 'Enregistrer'}</button>
            </div>
          </div>
        )}

        {/* Liens */}
        <div className="space-y-2">
          {[
            { href: '/client/favoris', label: '📍 Mes adresses favorites' },
            { href: '/client/messages', label: '💬 Messagerie' },
            { href: '/client/wallet', label: '💰 Wallet' },
          ].map(item => (
            <Link key={item.href} href={item.href} className="block bg-white p-4 rounded-2xl shadow-sm hover:shadow-md transition-all border-l-4 border-transparent hover:border-primary-500">
              <div className="flex items-center justify-between"><span className="font-semibold text-gray-900">{item.label}</span><span className="text-gray-300">→</span></div>
            </Link>
          ))}
        </div>

        <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
          className="w-full py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600">
          🚪 Déconnexion
        </button>
      </main>
    </div>
  )
}
