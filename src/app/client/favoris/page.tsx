// src/app/client/favoris/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

interface FavoriteAddress { id: string; label: string; adresse: string; latitude: number; longitude: number; est_defaut: boolean }
type Tab = 'adresses' | 'coursiers'

export default function FavorisPage() {
  const router = useRouter()
  const [user, setUser] = useState<{ id: string } | null>(null)
  const [tab, setTab] = useState<Tab>('adresses')
  const [loading, setLoading] = useState(true)
  const [addresses, setAddresses] = useState<FavoriteAddress[]>([])
  const [showAdd, setShowAdd] = useState(false)
  const [newAddress, setNewAddress] = useState({ label: '', adresse: '', latitude: 12.3547, longitude: -1.5247 })
  const [submitting, setSubmitting] = useState(false)

  const loadAddresses = useCallback(async (userId: string) => {
    const { data } = await supabase.from('adresses_favorites').select('*').eq('user_id', userId).order('est_defaut', { ascending: false })
    setAddresses((data || []) as FavoriteAddress[])
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const { data: userData } = await supabase.from('utilisateurs').select('id').eq('id', session.user.id).single()
      if (!userData) { router.push('/login'); return }
      setUser(userData)
      await loadAddresses(session.user.id)
      setLoading(false)
    }
    init()
  }, [router, loadAddresses])

  const handleAdd = async () => {
    if (!user || !newAddress.label || !newAddress.adresse) { toast.error('Remplissez tous les champs'); return }
    setSubmitting(true)
    try {
      const { error } = await supabase.from('adresses_favorites').insert({
        user_id: user.id, ...newAddress, est_defaut: addresses.length === 0,
      })
      if (error) throw error
      toast.success('Adresse ajoutée !')
      setNewAddress({ label: '', adresse: '', latitude: 12.3547, longitude: -1.5247 })
      setShowAdd(false)
      await loadAddresses(user.id)
    } catch { toast.error("Erreur lors de l'ajout") }
    finally { setSubmitting(false) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cette adresse ?') || !user) return
    const { error } = await supabase.from('adresses_favorites').delete().eq('id', id)
    if (error) { toast.error('Erreur'); return }
    toast.success('Adresse supprimée')
    await loadAddresses(user.id)
  }

  const handleSetDefault = async (id: string) => {
    if (!user) return
    await supabase.from('adresses_favorites').update({ est_defaut: false }).eq('user_id', user.id)
    const { error } = await supabase.from('adresses_favorites').update({ est_defaut: true }).eq('id', id)
    if (error) { toast.error('Erreur'); return }
    toast.success('Adresse par défaut définie')
    await loadAddresses(user.id)
  }

  if (loading) return <div className="min-h-screen bg-primary-600 flex items-center justify-center"><div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" /></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-primary-600 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 h-16">
            <button onClick={() => router.back()} className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">←</button>
            <div><h1 className="font-bold">Favoris</h1><p className="text-white/60 text-xs">Adresses et coursiers</p></div>
          </div>
        </div>
      </header>

      <div className="sticky top-16 z-30 bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex">
          {(['adresses', 'coursiers'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-3 font-semibold text-sm border-b-2 transition-colors ${tab === t ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-600'}`}>
              {t === 'adresses' ? '📍 Adresses' : '🛵 Coursiers'}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-4">
        {tab === 'adresses' && (
          <>
            <button onClick={() => setShowAdd(!showAdd)} className="w-full py-3 rounded-xl bg-primary-500 text-white font-bold hover:bg-primary-600">+ Ajouter une adresse</button>

            {showAdd && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-primary-200 space-y-4">
                <h3 className="font-bold text-gray-900">Nouvelle adresse</h3>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Label</label>
                  <input type="text" placeholder="Maison, Bureau..." value={newAddress.label} onChange={e => setNewAddress(p => ({ ...p, label: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-400" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Adresse</label>
                  <input type="text" placeholder="123 Rue de la Paix, Ouagadougou" value={newAddress.adresse} onChange={e => setNewAddress(p => ({ ...p, adresse: e.target.value }))}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-400" />
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setShowAdd(false)} className="flex-1 py-2 rounded-xl border-2 border-gray-200 font-semibold text-gray-700">Annuler</button>
                  <button onClick={handleAdd} disabled={submitting} className="flex-1 py-2 rounded-xl bg-primary-500 text-white font-semibold disabled:opacity-50">{submitting ? '...' : 'Ajouter'}</button>
                </div>
              </div>
            )}

            {addresses.length === 0
              ? <div className="text-center py-16"><p className="text-5xl mb-4">📍</p><p className="text-gray-500">Aucune adresse favorite</p></div>
              : <div className="space-y-3">
                  {addresses.map(addr => (
                    <div key={addr.id} className={`bg-white rounded-2xl p-4 shadow-sm border-l-4 ${addr.est_defaut ? 'border-primary-500' : 'border-gray-200'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-gray-900">{addr.label}</h3>
                        {addr.est_defaut && <span className="text-xs bg-primary-100 text-primary-600 px-2 py-0.5 rounded-full">Par défaut</span>}
                      </div>
                      <p className="text-sm text-gray-600 mb-3">{addr.adresse}</p>
                      <div className="flex gap-2">
                        {!addr.est_defaut && <button onClick={() => handleSetDefault(addr.id)} className="flex-1 py-2 rounded-lg bg-gray-100 text-gray-700 font-semibold text-sm hover:bg-gray-200">Par défaut</button>}
                        <button onClick={() => handleDelete(addr.id)} className="flex-1 py-2 rounded-lg bg-red-100 text-red-600 font-semibold text-sm hover:bg-red-200">Supprimer</button>
                      </div>
                    </div>
                  ))}
                </div>
            }
          </>
        )}

        {tab === 'coursiers' && (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">🛵</p>
            <h3 className="font-bold text-gray-900 mb-2">Aucun coursier favori</h3>
            <p className="text-gray-500">Notez les coursiers pour les ajouter à vos favoris</p>
          </div>
        )}
      </main>
    </div>
  )
}
