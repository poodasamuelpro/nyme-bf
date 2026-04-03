// src/app/client/dashboard/page.tsx — Dashboard client complet
// Vérification rôle côté page
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Utilisateur, Livraison, Wallet, Notification, TransactionWallet } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Bell, Plus, Search, LogOut, Package, Wallet as WalletIcon, MessageSquare, Star, Settings, ChevronRight, MapPin, ArrowUpRight } from 'lucide-react'

type Tab = 'accueil' | 'livraisons' | 'wallet' | 'notifications'

const STATUT_CONFIG: Record<string, { label: string; emoji: string; bg: string; text: string }> = {
  en_attente:       { label: 'En attente',   emoji: '🕐', bg: 'bg-amber-50',  text: 'text-amber-700' },
  acceptee:         { label: 'Acceptée',     emoji: '✅', bg: 'bg-blue-50',   text: 'text-blue-700' },
  en_route_depart:  { label: 'En route',     emoji: '🛵', bg: 'bg-purple-50', text: 'text-purple-700' },
  colis_recupere:   { label: 'Colis récup.', emoji: '📦', bg: 'bg-indigo-50', text: 'text-indigo-700' },
  en_route_arrivee: { label: 'Livraison',    emoji: '🚀', bg: 'bg-orange-50', text: 'text-orange-700' },
  livree:           { label: 'Livrée',       emoji: '🎉', bg: 'bg-green-50',  text: 'text-green-700' },
  annulee:          { label: 'Annulée',      emoji: '❌', bg: 'bg-red-50',    text: 'text-red-700' },
}

const fPrice = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' XOF'
const fDate  = (d: string) => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d))

export default function ClientDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<Utilisateur | null>(null)
  const [tab, setTab] = useState<Tab>('accueil')
  const [livraisons, setLivraisons] = useState<Livraison[]>([])
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [transactions, setTransactions] = useState<TransactionWallet[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterStatut, setFilterStatut] = useState('tous')

  const loadLivraisons = useCallback(async (userId: string) => {
    const { data } = await supabase.from('livraisons')
      .select('*, coursier:coursier_id(id, nom, telephone, avatar_url, note_moyenne)')
      .eq('client_id', userId).order('created_at', { ascending: false })
    setLivraisons((data || []) as unknown as Livraison[])
  }, [])

  const loadWallet = useCallback(async (userId: string) => {
    const { data: w } = await supabase.from('wallets').select('*').eq('user_id', userId).single()
    setWallet(w as Wallet | null)
    const { data: txs } = await supabase.from('transactions_wallet').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30)
    setTransactions((txs || []) as TransactionWallet[])
  }, [])

  const loadNotifications = useCallback(async (userId: string) => {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(50)
    setNotifications((data || []) as Notification[])
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      // Vérification rôle côté page
      const { data: userData } = await supabase.from('utilisateurs').select('*').eq('id', session.user.id).single()
      if (!userData) { router.replace('/login'); return }
      if (userData.role === 'coursier') { router.replace('/coursier/dashboard-new'); return }
      if (userData.role === 'admin')    { router.replace('/admin-x9k2m/dashboard');  return }
      if (userData.role === 'partenaire') { router.replace('/partenaires/dashboard'); return }

      setUser(userData as Utilisateur)
      await Promise.all([loadLivraisons(session.user.id), loadWallet(session.user.id), loadNotifications(session.user.id)])
      setLoading(false)

      // Realtime
      const channel = supabase.channel(`client-${session.user.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'livraisons', filter: `client_id=eq.${session.user.id}` }, () => loadLivraisons(session.user.id))
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` }, (p) => {
          setNotifications(prev => [p.new as Notification, ...prev])
          toast((p.new as Notification).titre || 'Nouvelle notification', { icon: '🔔' })
        })
        .subscribe()

      return () => supabase.removeChannel(channel)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const markAllRead = async () => {
    if (!user) return
    await supabase.from('notifications').update({ lu: true }).eq('user_id', user.id).eq('lu', false)
    setNotifications(prev => prev.map(n => ({ ...n, lu: true })))
  }

  const filteredLivraisons = livraisons.filter(l => {
    const matchSearch = !search || l.depart_adresse.toLowerCase().includes(search.toLowerCase()) || l.arrivee_adresse.toLowerCase().includes(search.toLowerCase()) || l.destinataire_nom.toLowerCase().includes(search.toLowerCase())
    const matchStatut = filterStatut === 'tous' || l.statut === filterStatut
    return matchSearch && matchStatut
  })

  const unreadCount = notifications.filter(n => !n.lu).length
  const activeDeliveries = livraisons.filter(l => !['livree', 'annulee'].includes(l.statut))

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-600 to-nyme-orange rounded-xl flex items-center justify-center">
                <span className="text-white font-black text-sm">N</span>
              </div>
              <div>
                <p className="font-bold text-gray-900 text-sm">Bonjour {user?.nom?.split(' ')[0]} 👋</p>
                <p className="text-gray-400 text-xs">Tableau de bord client</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setTab('notifications')} className="relative p-2 rounded-xl hover:bg-gray-100">
                <Bell size={20} className="text-gray-600" />
                {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 rounded-full text-white text-[10px] font-bold flex items-center justify-center">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>
              <Link href="/client/nouvelle-livraison" className="bg-blue-600 text-white text-sm font-bold px-4 py-2 rounded-xl hover:bg-blue-700 flex items-center gap-1.5">
                <Plus size={15} />Livraison
              </Link>
            </div>
          </div>
        </div>
        {/* Bottom tabs */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-1 border-t border-gray-100">
          {([['accueil', '🏠 Accueil'], ['livraisons', '📦 Livraisons'], ['wallet', '💰 Wallet'], ['notifications', '🔔 Notifs']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-xs font-semibold border-b-2 transition-all ${tab === t ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-24 pt-5 space-y-5">

        {/* ── ACCUEIL ── */}
        {tab === 'accueil' && (
          <div className="space-y-5">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: Package, label: 'Total', val: livraisons.length, color: 'bg-blue-500' },
                { icon: ArrowUpRight, label: 'En cours', val: activeDeliveries.length, color: 'bg-purple-500' },
                { icon: Star, label: 'Livrées', val: livraisons.filter(l => l.statut === 'livree').length, color: 'bg-green-500' },
                { icon: WalletIcon, label: 'Solde', val: fPrice(wallet?.solde || 0), color: 'bg-orange-500' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex items-start gap-3">
                  <div className={`w-9 h-9 ${s.color} rounded-xl flex items-center justify-center shrink-0`}><s.icon size={16} className="text-white" /></div>
                  <div><p className="text-gray-400 text-xs">{s.label}</p><p className="font-black text-gray-900 text-sm">{s.val}</p></div>
                </div>
              ))}
            </div>

            {/* Livraisons actives */}
            {activeDeliveries.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-bold text-gray-900">🚀 En cours ({activeDeliveries.length})</h2>
                </div>
                {activeDeliveries.slice(0, 3).map(l => {
                  const cfg = STATUT_CONFIG[l.statut] || STATUT_CONFIG.en_attente
                  return (
                    <div key={l.id} className={`flex items-start gap-3 p-4 ${cfg.bg} border-b border-white/50`}>
                      <span className="text-2xl">{cfg.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <span className={`text-xs font-bold ${cfg.text}`}>{cfg.label}</span>
                        <p className="text-sm font-medium text-gray-800 truncate mt-0.5">{l.depart_adresse} → {l.arrivee_adresse}</p>
                        <p className="text-xs text-gray-500">Pour: {l.destinataire_nom} • {fDate(l.created_at)}</p>
                      </div>
                      <Link href={`/client/suivi/${l.id}`} className="text-xs bg-blue-600 text-white px-3 py-1.5 rounded-lg font-semibold hover:bg-blue-700 flex-shrink-0">Suivre</Link>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Actions rapides */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: '📦', label: 'Nouvelle livraison', href: '/client/nouvelle-livraison', color: 'bg-blue-600' },
                { icon: '💰', label: 'Wallet', href: '/client/wallet', color: 'bg-green-500' },
                { icon: '💬', label: 'Messages', href: '/client/messages', color: 'bg-purple-500' },
                { icon: '📍', label: 'Favoris', href: '/client/favoris', color: 'bg-orange-500' },
              ].map(a => (
                <Link key={a.label} href={a.href}
                  className={`${a.color} text-white rounded-2xl p-4 flex flex-col items-center gap-2 hover:opacity-90 transition-opacity shadow-sm`}>
                  <span className="text-2xl">{a.icon}</span>
                  <span className="text-xs font-semibold text-center">{a.label}</span>
                </Link>
              ))}
            </div>

            {/* Historique récent */}
            {livraisons.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-bold text-gray-900">Récentes</h2>
                  <button onClick={() => setTab('livraisons')} className="text-blue-600 text-xs hover:underline">Voir tout →</button>
                </div>
                {livraisons.slice(0, 5).map(l => {
                  const cfg = STATUT_CONFIG[l.statut] || STATUT_CONFIG.en_attente
                  return (
                    <div key={l.id} className="flex items-center gap-3 p-4 border-b border-gray-50 hover:bg-gray-50 last:border-0">
                      <span className="text-xl">{cfg.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{l.depart_adresse} → {l.arrivee_adresse}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
                          <span className="text-gray-300">•</span>
                          <span className="text-xs text-gray-400">{fDate(l.created_at)}</span>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-gray-700 flex-shrink-0">{fPrice(l.prix_final || l.prix_calcule)}</span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Menu profil */}
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {[
                { href: '/client/profil', icon: Settings, label: 'Mon profil' },
                { href: '/client/evaluation', icon: Star, label: 'Mes évaluations' },
              ].map(item => (
                <Link key={item.href} href={item.href} className="flex items-center gap-3 p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <div className="w-9 h-9 bg-gray-100 rounded-xl flex items-center justify-center"><item.icon size={16} className="text-gray-600" /></div>
                  <span className="flex-1 font-semibold text-gray-900 text-sm">{item.label}</span>
                  <ChevronRight size={16} className="text-gray-300" />
                </Link>
              ))}
              <button onClick={async () => { await supabase.auth.signOut(); router.replace('/login') }}
                className="flex items-center gap-3 p-4 hover:bg-red-50 w-full text-left">
                <div className="w-9 h-9 bg-red-100 rounded-xl flex items-center justify-center"><LogOut size={16} className="text-red-500" /></div>
                <span className="flex-1 font-semibold text-red-600 text-sm">Déconnexion</span>
              </button>
            </div>
          </div>
        )}

        {/* ── LIVRAISONS ── */}
        {tab === 'livraisons' && (
          <div className="space-y-4">
            <h2 className="text-xl font-black text-gray-900">Mes livraisons</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input placeholder="Rechercher..." value={search} onChange={e => setSearch(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400" />
              </div>
              <select value={filterStatut} onChange={e => setFilterStatut(e.target.value)} className="px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 bg-white">
                <option value="tous">Tous</option>
                {Object.entries(STATUT_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.emoji} {v.label}</option>)}
              </select>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {filteredLivraisons.length === 0 ? (
                <div className="p-12 text-center">
                  <Package size={36} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Aucune livraison</p>
                  <Link href="/client/nouvelle-livraison" className="inline-flex items-center gap-2 mt-3 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700"><Plus size={14} />Créer une livraison</Link>
                </div>
              ) : (
                filteredLivraisons.map(l => {
                  const cfg = STATUT_CONFIG[l.statut] || STATUT_CONFIG.en_attente
                  return (
                    <div key={l.id} className="p-4 border-b border-gray-50 last:border-0 hover:bg-gray-50">
                      <div className="flex items-start gap-3">
                        <span className="text-xl">{cfg.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{l.depart_adresse}</p>
                              <p className="text-xs text-gray-400 truncate">→ {l.arrivee_adresse}</p>
                            </div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text} flex-shrink-0`}>{cfg.label}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-gray-400">
                            <span>{fDate(l.created_at)}</span>
                            <span className="text-gray-700 font-bold">{fPrice(l.prix_final || l.prix_calcule)}</span>
                            {!['livree', 'annulee'].includes(l.statut) && (
                              <Link href={`/client/suivi/${l.id}`} className="text-blue-600 font-semibold hover:underline ml-auto">Suivre →</Link>
                            )}
                            {l.statut === 'livree' && (
                              <Link href={`/client/evaluation/${l.id}`} className="text-orange-600 font-semibold hover:underline ml-auto">Évaluer ⭐</Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ── WALLET ── */}
        {tab === 'wallet' && (
          <div className="space-y-4">
            <Link href="/client/wallet" className="block">
              <div className="bg-gradient-to-br from-blue-700 to-blue-600 rounded-3xl p-8 text-white shadow-xl">
                <p className="text-white/70 text-sm mb-1">Solde disponible</p>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-5xl font-black">{(wallet?.solde || 0).toLocaleString()}</span>
                  <span className="text-xl font-semibold">XOF</span>
                </div>
                <p className="text-white/60 text-xs">Appuyez pour gérer votre wallet →</p>
              </div>
            </Link>
            {transactions.slice(0, 10).map(tx => (
              <div key={tx.id} className="bg-white rounded-2xl p-4 border border-gray-100 flex items-center gap-3">
                <div className="w-9 h-9 bg-blue-100 rounded-full flex items-center justify-center text-base">💳</div>
                <div className="flex-1"><p className="text-gray-900 text-sm font-semibold">{tx.note || tx.type}</p><p className="text-gray-400 text-xs">{fDate(tx.created_at)}</p></div>
                <p className={`font-black text-sm ${tx.montant > 0 ? 'text-green-600' : 'text-red-500'}`}>{tx.montant > 0 ? '+' : ''}{tx.montant.toLocaleString()} XOF</p>
              </div>
            ))}
          </div>
        )}

        {/* ── NOTIFICATIONS ── */}
        {tab === 'notifications' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-gray-900">Notifications</h2>
              {unreadCount > 0 && <button onClick={markAllRead} className="text-blue-600 text-xs font-semibold hover:underline">Tout marquer lu</button>}
            </div>
            {notifications.length === 0 ? (
              <div className="bg-white rounded-2xl p-10 text-center border border-gray-100">
                <Bell size={32} className="text-gray-200 mx-auto mb-3" />
                <p className="text-gray-500 text-sm">Aucune notification</p>
              </div>
            ) : (
              notifications.map(n => (
                <div key={n.id} className={`bg-white rounded-2xl p-4 border transition-all ${!n.lu ? 'border-blue-200 bg-blue-50' : 'border-gray-100'}`}
                  onClick={async () => {
                    if (!n.lu) {
                      await supabase.from('notifications').update({ lu: true }).eq('id', n.id)
                      setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, lu: true } : x))
                    }
                  }}>
                  <div className="flex items-start gap-3">
                    <span className="text-xl">🔔</span>
                    <div className="flex-1">
                      <p className="font-bold text-gray-900 text-sm">{n.titre}</p>
                      <p className="text-gray-600 text-xs mt-0.5">{n.message}</p>
                      <p className="text-gray-400 text-xs mt-1">{fDate(n.created_at)}</p>
                    </div>
                    {!n.lu && <span className="w-2 h-2 bg-blue-500 rounded-full mt-1 flex-shrink-0" />}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </main>
    </div>
  )
}
