// src/app/coursier/dashboard-new/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import type { Utilisateur, Coursier, Livraison, Wallet, Notification, TransactionWallet } from '@/lib/supabase'
import toast from 'react-hot-toast'

type Tab = 'courses' | 'en_cours' | 'gains' | 'profil'

const STATUT_CONFIG: Record<string, { label: string; emoji: string; next?: string; nextLabel?: string }> = {
  acceptee:         { label: 'Acceptée',        emoji: '✅', next: 'en_route_depart',  nextLabel: '🛵 En route vers colis' },
  en_route_depart:  { label: 'En route (colis)', emoji: '🛵', next: 'colis_recupere',   nextLabel: '📦 Colis récupéré' },
  colis_recupere:   { label: 'Colis récupéré',   emoji: '📦', next: 'en_route_arrivee', nextLabel: '🚀 En route livraison' },
  en_route_arrivee: { label: 'En livraison',     emoji: '🚀', next: 'livree',           nextLabel: '✅ Marquer livrée' },
  livree:           { label: 'Livrée',           emoji: '🎉' },
  annulee:          { label: 'Annulée',          emoji: '❌' },
}

function formatPrice(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' XOF'
}

function formatDate(d: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d))
}

export default function CoursierDashboard() {
  const router = useRouter()
  const [user, setUser] = useState<Utilisateur | null>(null)
  const [coursier, setCoursier] = useState<Coursier | null>(null)
  const [tab, setTab] = useState<Tab>('courses')
  const [disponible, setDisponible] = useState(false)
  const [coursesDisponibles, setCoursesDisponibles] = useState<Livraison[]>([])
  const [coursesEnCours, setCoursesEnCours] = useState<Livraison[]>([])
  const [historique, setHistorique] = useState<Livraison[]>([])
  const [wallet, setWallet] = useState<Wallet | null>(null)
  const [transactions, setTransactions] = useState<TransactionWallet[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingDisponible, setTogglingDisponible] = useState(false)

  const loadCoursesDisponibles = useCallback(async () => {
    const { data } = await supabase.from('livraisons')
      .select('*, client:client_id(id, nom, telephone, avatar_url)')
      .eq('statut', 'en_attente').is('coursier_id', null)
      .order('created_at', { ascending: false }).limit(20)
    setCoursesDisponibles((data || []) as unknown as Livraison[])
  }, [])

  const loadCoursesEnCours = useCallback(async (userId: string) => {
    const { data } = await supabase.from('livraisons')
      .select('*, client:client_id(id, nom, telephone, avatar_url)')
      .eq('coursier_id', userId)
      .not('statut', 'in', '("livree","annulee")')
      .order('created_at', { ascending: false })
    setCoursesEnCours((data || []) as unknown as Livraison[])
  }, [])

  const loadHistorique = useCallback(async (userId: string) => {
    const { data } = await supabase.from('livraisons').select('*')
      .eq('coursier_id', userId).in('statut', ['livree', 'annulee'])
      .order('created_at', { ascending: false }).limit(30)
    setHistorique((data || []) as Livraison[])
  }, [])

  const loadWallet = useCallback(async (userId: string) => {
    const { data } = await supabase.from('wallets').select('*').eq('user_id', userId).single()
    setWallet(data as Wallet | null)
    const { data: txs } = await supabase.from('transactions_wallet').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30)
    setTransactions((txs || []) as TransactionWallet[])
  }, [])

  const loadNotifications = useCallback(async (userId: string) => {
    const { data } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30)
    setNotifications((data || []) as Notification[])
  }, [])

  const initDashboard = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login?role=coursier'); return }

      const { data: userData } = await supabase.from('utilisateurs').select('*').eq('id', session.user.id).single()
      if (!userData || userData.role !== 'coursier') { router.push('/login'); return }
      setUser(userData as Utilisateur)

      const { data: coursierData } = await supabase.from('coursiers').select('*').eq('id', session.user.id).single()
      if (coursierData) { setCoursier(coursierData as Coursier); setDisponible(coursierData.statut === 'disponible') }

      await Promise.all([
        loadCoursesDisponibles(),
        loadCoursesEnCours(session.user.id),
        loadHistorique(session.user.id),
        loadWallet(session.user.id),
        loadNotifications(session.user.id),
      ])

      const channel = supabase.channel('coursier-dash')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'livraisons' }, () => {
          loadCoursesDisponibles()
          loadCoursesEnCours(session.user.id)
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${session.user.id}` }, (payload) => {
          setNotifications(prev => [payload.new as Notification, ...prev])
          toast((payload.new as Notification).titre || 'Nouvelle notification', { icon: '🔔' })
        })
        .subscribe()

      setLoading(false)
      return () => supabase.removeChannel(channel)
    } catch (err) {
      console.error(err)
      setLoading(false)
    }
  }, [router, loadCoursesDisponibles, loadCoursesEnCours, loadHistorique, loadWallet, loadNotifications])

  useEffect(() => { initDashboard() }, [initDashboard])

  const toggleDisponible = async () => {
    if (!user) return
    setTogglingDisponible(true)
    const newStatut = disponible ? 'hors_ligne' : 'disponible'
    try {
      if (!disponible) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await supabase.from('coursiers').update({ statut: newStatut, lat_actuelle: pos.coords.latitude, lng_actuelle: pos.coords.longitude, derniere_activite: new Date().toISOString() }).eq('id', user.id)
            await supabase.from('localisation_coursier').upsert({ coursier_id: user.id, latitude: pos.coords.latitude, longitude: pos.coords.longitude }, { onConflict: 'coursier_id' })
            setDisponible(true); toast.success('✅ Vous êtes disponible'); setTogglingDisponible(false)
          },
          async () => {
            await supabase.from('coursiers').update({ statut: newStatut }).eq('id', user.id)
            setDisponible(true); toast('Disponible sans GPS', { icon: '⚠️' }); setTogglingDisponible(false)
          }
        )
      } else {
        await supabase.from('coursiers').update({ statut: newStatut }).eq('id', user.id)
        setDisponible(false); toast('Vous êtes hors ligne', { icon: '🔴' }); setTogglingDisponible(false)
      }
    } catch { toast.error('Erreur'); setTogglingDisponible(false) }
  }

  const accepterCourse = async (livraison: Livraison) => {
    if (!user) return
    try {
      const res = await fetch('/api/coursier/livraisons/accepter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ livraison_id: livraison.id, coursier_id: user.id }),
      })
      if (!res.ok) throw new Error()
      toast.success('Course acceptée !')
      await Promise.all([loadCoursesDisponibles(), loadCoursesEnCours(user.id)])
      setTab('en_cours')
    } catch { toast.error("Impossible d'accepter cette course") }
  }

  const updateStatut = async (livraisonId: string, newStatut: string) => {
    if (!user) return
    try {
      const res = await fetch('/api/coursier/livraisons/statut', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ livraison_id: livraisonId, statut: newStatut, coursier_id: user.id }),
      })
      if (!res.ok) throw new Error()
      if (newStatut === 'livree') { toast.success('🎉 Livraison confirmée ! Gains crédités'); await loadWallet(user.id) }
      else toast.success('Statut mis à jour')
      await loadCoursesEnCours(user.id)
    } catch { toast.error('Erreur mise à jour') }
  }

  const unreadCount = notifications.filter(n => !n.lu).length
  const gainsDuJour = historique.filter(l => {
    const d = new Date(l.livree_at || l.created_at)
    return d.toDateString() === new Date().toDateString() && l.statut === 'livree'
  }).reduce((sum, l) => sum + (l.prix_final || l.prix_calcule) * 0.85, 0)

  const isVerifie = coursier?.statut_verification === 'verifie'

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-orange-600 to-orange-400 flex flex-col items-center justify-center">
      <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4" />
      <p className="text-white font-medium">Chargement...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* HEADER */}
      <header className="sticky top-0 z-40 bg-primary-700 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center text-xl">🛵</div>
              <div>
                <div className="font-bold text-sm">{user?.nom?.split(' ')[0]} 👋</div>
                <div className="text-white/60 text-xs">Dashboard Coursier</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={toggleDisponible} disabled={togglingDisponible || !isVerifie}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all ${disponible ? 'bg-green-500 text-white' : 'bg-white/20 text-white/80'} ${!isVerifie ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-90'}`}>
                {togglingDisponible
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <span className={`w-2 h-2 rounded-full ${disponible ? 'bg-white animate-pulse' : 'bg-white/40'}`} />
                }
                {disponible ? 'Disponible' : 'Hors ligne'}
              </button>
              <button onClick={() => setTab('courses')} className="relative p-2 rounded-xl hover:bg-white/10">
                <span className="text-xl">🔔</span>
                {unreadCount > 0 && <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-xs font-bold flex items-center justify-center">{unreadCount}</span>}
              </button>
            </div>
          </div>
        </div>
      </header>

      {!isVerifie && (
        <div className="bg-amber-500 text-white px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <span className="text-sm font-medium">⚠️ Dossier en cours de vérification.</span>
            <Link href="/coursier/verification" className="text-xs underline font-semibold">Compléter →</Link>
          </div>
        </div>
      )}

      {/* TABS */}
      <div className="sticky top-16 z-30 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex">
          {([
            ['courses', '🔍 Disponibles'],
            ['en_cours', `🚀 En cours${coursesEnCours.length ? ` (${coursesEnCours.length})` : ''}`],
            ['gains', '💰 Gains'],
            ['profil', '👤 Profil'],
          ] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-3 font-semibold text-xs sm:text-sm border-b-2 transition-colors flex-1 ${tab === t ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-600'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-24 pt-6 space-y-4">

        {/* ── COURSES DISPONIBLES ── */}
        {tab === 'courses' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: '📦', label: 'Disponibles', val: coursesDisponibles.length, color: 'text-blue-600 bg-blue-50' },
                { icon: '🚀', label: 'En cours', val: coursesEnCours.length, color: 'text-purple-600 bg-purple-50' },
                { icon: '✅', label: 'Total', val: coursier?.total_courses || 0, color: 'text-green-600 bg-green-50' },
                { icon: '💰', label: 'Aujourd\'hui', val: formatPrice(gainsDuJour), color: 'text-amber-600 bg-amber-50' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm flex items-center gap-3">
                  <div className={`w-10 h-10 ${s.color} rounded-xl flex items-center justify-center text-xl`}>{s.icon}</div>
                  <div><p className="text-xs text-gray-400">{s.label}</p><p className="font-black text-gray-800 text-sm">{s.val}</p></div>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between">
              <h2 className="font-black text-gray-800">Courses disponibles</h2>
              <button onClick={loadCoursesDisponibles} className="text-xs text-primary-500 font-semibold hover:underline">🔄 Actualiser</button>
            </div>

            {coursesDisponibles.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                <p className="text-6xl mb-4">🔍</p>
                <h3 className="font-bold text-xl text-gray-700">Aucune course disponible</h3>
                <p className="text-gray-400 mt-2 text-sm">Les nouvelles courses apparaîtront ici en temps réel</p>
                {!disponible && isVerifie && <button onClick={toggleDisponible} className="mt-4 px-6 py-3 bg-primary-500 text-white rounded-xl font-bold hover:bg-primary-600">✅ Me mettre disponible</button>}
              </div>
            ) : (
              <div className="space-y-3">
                {coursesDisponibles.map(l => (
                  <div key={l.id} className="bg-white rounded-2xl p-4 shadow-sm hover:shadow-md transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-black text-gray-800 text-lg">{formatPrice(l.prix_calcule)}</p>
                        <p className="text-xs text-gray-400">{l.distance_km ? `${l.distance_km} km` : ''}{l.duree_estimee ? ` • ~${l.duree_estimee} min` : ''}</p>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full font-semibold ${l.type === 'urgente' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                        {l.type === 'urgente' ? '🚨 Urgente' : l.type === 'programmee' ? '📅 Programmée' : '⚡ Immédiate'}
                      </span>
                    </div>
                    <div className="space-y-1 mb-3">
                      <div className="flex gap-2 text-sm"><span className="text-green-500">▲</span><span className="text-gray-700 truncate">{l.depart_adresse}</span></div>
                      <div className="flex gap-2 text-sm"><span className="text-red-500">▼</span><span className="text-gray-700 truncate">{l.arrivee_adresse}</span></div>
                    </div>
                    {l.instructions && <div className="bg-yellow-50 rounded-lg p-2 mb-3 text-xs text-yellow-700">💬 {l.instructions}</div>}
                    <button onClick={() => accepterCourse(l)} disabled={!disponible || !isVerifie}
                      className="w-full py-3 rounded-xl bg-green-500 text-white font-bold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                      ✅ Accepter cette course
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── EN COURS ── */}
        {tab === 'en_cours' && (
          <div className="space-y-4">
            {coursesEnCours.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 text-center shadow-sm">
                <p className="text-6xl mb-4">🛵</p>
                <h3 className="font-bold text-xl text-gray-700">Aucune course en cours</h3>
                <button onClick={() => setTab('courses')} className="mt-4 px-6 py-3 bg-primary-500 text-white rounded-xl font-bold hover:bg-primary-600">Voir les courses disponibles</button>
              </div>
            ) : (
              coursesEnCours.map(l => {
                const cfg = STATUT_CONFIG[l.statut]
                return (
                  <div key={l.id} className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{cfg?.emoji || '📦'}</span>
                        <div>
                          <p className="font-bold text-gray-900">{cfg?.label || l.statut}</p>
                          <p className="text-xs text-gray-500">{formatDate(l.created_at)}</p>
                        </div>
                      </div>
                      <p className="font-black text-primary-600">{formatPrice(l.prix_final || l.prix_calcule)}</p>
                    </div>
                    <div className="space-y-1 mb-3 text-sm">
                      <div className="flex gap-2"><span className="text-green-500">▲</span><span className="text-gray-700 truncate">{l.depart_adresse}</span></div>
                      <div className="flex gap-2"><span className="text-red-500">▼</span><span className="text-gray-700 truncate">{l.arrivee_adresse}</span></div>
                    </div>
                    <div className="flex gap-2">
                      <Link href={`/coursier/mission/${l.id}`} className="flex-1 py-2 rounded-xl bg-gray-100 text-gray-700 font-semibold text-sm text-center hover:bg-gray-200">Détails 🗺️</Link>
                      {cfg?.next && (
                        <button onClick={() => updateStatut(l.id, cfg.next!)}
                          className="flex-1 py-2 rounded-xl bg-primary-500 text-white font-semibold text-sm hover:bg-primary-600">
                          {cfg.nextLabel}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── GAINS ── */}
        {tab === 'gains' && (
          <div className="space-y-4">
            <div className="bg-gradient-to-br from-primary-600 to-primary-700 rounded-3xl p-8 text-white shadow-xl">
              <p className="text-white/70 text-sm mb-1">Solde disponible</p>
              <div className="flex items-baseline gap-2">
                <span className="text-5xl font-black">{(wallet?.solde || 0).toLocaleString()}</span>
                <span className="text-xl font-semibold">XOF</span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-white/60 text-xs">Aujourd'hui</p>
                  <p className="font-bold">{formatPrice(gainsDuJour)}</p>
                </div>
                <div className="bg-white/10 rounded-xl p-3">
                  <p className="text-white/60 text-xs">Total courses</p>
                  <p className="font-bold">{coursier?.total_courses || 0}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100"><h3 className="font-bold text-gray-900">Historique</h3></div>
              {transactions.length === 0
                ? <div className="text-center py-12"><p className="text-gray-400 text-sm">Aucune transaction</p></div>
                : transactions.map(tx => (
                    <div key={tx.id} className="flex items-center gap-4 p-4 border-b border-gray-50 hover:bg-gray-50">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-lg">💰</div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 text-sm">{tx.note || tx.type}</p>
                        <p className="text-xs text-gray-400">{formatDate(tx.created_at)}</p>
                      </div>
                      <p className="font-black text-green-600 text-sm">+{tx.montant.toLocaleString()} XOF</p>
                    </div>
                  ))
              }
            </div>
          </div>
        )}

        {/* ── PROFIL ── */}
        {tab === 'profil' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl p-6 shadow-sm text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-black text-3xl mx-auto mb-3">
                {user?.nom?.charAt(0) || '🛵'}
              </div>
              <h2 className="text-xl font-black text-gray-900">{user?.nom}</h2>
              <p className="text-gray-500 text-sm">Coursier NYME</p>
              {!isVerifie && <span className="inline-block mt-2 bg-amber-100 text-amber-700 text-xs px-3 py-1 rounded-full font-semibold">En cours de vérification</span>}
            </div>

            <div className="space-y-2">
              {[
                { href: '/coursier/messages', label: '💬 Messagerie' },
                { href: '/coursier/wallet', label: '💰 Wallet' },
                { href: '/coursier/verification', label: '📋 Mon dossier' },
              ].map(item => (
                <Link key={item.href} href={item.href} className="block bg-white p-4 rounded-2xl shadow-sm hover:shadow-md border-l-4 border-transparent hover:border-primary-500 transition-all">
                  <div className="flex items-center justify-between"><span className="font-semibold text-gray-900">{item.label}</span><span className="text-gray-300">→</span></div>
                </Link>
              ))}
            </div>

            <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
              className="w-full py-3 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600">🚪 Déconnexion</button>
          </div>
        )}
      </main>
    </div>
  )
}
