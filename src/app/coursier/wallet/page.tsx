// src/app/coursier/wallet/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Wallet, TransactionWallet } from '@/lib/supabase'
import { ArrowLeft, TrendingUp, Banknote, Clock, AlertCircle, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CoursierWalletPage() {
  const router = useRouter()
  const [userId,       setUserId]       = useState<string | null>(null)
  const [wallet,       setWallet]       = useState<Wallet | null>(null)
  const [transactions, setTransactions] = useState<TransactionWallet[]>([])
  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [montantRetrait, setMontantRetrait] = useState('')
  const [submittingRetrait, setSubmittingRetrait] = useState(false)
  const [showRetrait, setShowRetrait] = useState(false)

  const fXOF = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' XOF'
  const fDate = (d: string) => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d))

  const loadData = useCallback(async (uid: string) => {
    const { data: w } = await supabase.from('wallets').select('*').eq('user_id', uid).single()
    setWallet(w as Wallet | null)
    const { data: txs } = await supabase.from('transactions_wallet').select('*').eq('user_id', uid).order('created_at', { ascending: false }).limit(50)
    setTransactions((txs || []) as TransactionWallet[])
    setRefreshing(false)
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/coursier/login'); return }
      const { data: u } = await supabase.from('utilisateurs').select('role').eq('id', session.user.id).single()
      if (!u || u.role !== 'coursier') { router.replace('/coursier/login'); return }
      setUserId(session.user.id)
      await loadData(session.user.id)
      setLoading(false)
    }
    init()
  }, [router, loadData])

  const handleRetrait = async () => {
    if (!userId) return
    const montant = parseFloat(montantRetrait)
    if (!montant || montant < 1000) { toast.error('Montant minimum 1000 XOF'); return }
    if (montant > (wallet?.solde || 0)) { toast.error('Solde insuffisant'); return }
    setSubmittingRetrait(true)
    try {
      const { error } = await supabase.rpc('request_courier_withdrawal', {
        p_coursier_id: userId,
        p_montant: montant,
      })
      if (error) throw new Error(error.message)
      toast.success('Demande de retrait envoyée ! Traitement sous 24h.')
      setMontantRetrait('')
      setShowRetrait(false)
      await loadData(userId)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors du retrait')
    } finally { setSubmittingRetrait(false) }
  }

  const gains = transactions.filter(t => t.type === 'gain' || t.type === 'gain_course')
  const gainsDuJour = gains.filter(t => new Date(t.created_at).toDateString() === new Date().toDateString()).reduce((s, t) => s + t.montant, 0)
  const gainsDuMois = gains.filter(t => new Date(t.created_at).getMonth() === new Date().getMonth()).reduce((s, t) => s + t.montant, 0)

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="w-10 h-10 border-4 border-orange-100 border-t-nyme-orange rounded-full animate-spin" /></div>

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center"><ArrowLeft size={16} className="text-gray-700" /></button>
          <h1 className="font-heading font-bold text-gray-900 flex-1">Mon Wallet</h1>
          <button onClick={() => { setRefreshing(true); if (userId) loadData(userId) }} className="p-2 rounded-xl hover:bg-gray-100">
            <RefreshCw size={16} className={`text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-5">
        {/* Carte solde */}
        <div className="bg-gradient-to-br from-nyme-orange to-orange-600 rounded-3xl p-8 text-white shadow-xl relative overflow-hidden">
          <div className="absolute -top-8 -right-8 w-32 h-32 bg-white/10 rounded-full" />
          <div className="absolute -bottom-6 -left-6 w-24 h-24 bg-white/10 rounded-full" />
          <p className="text-white/70 text-sm mb-1 relative">Solde disponible</p>
          <div className="flex items-baseline gap-2 mb-6 relative">
            <span className="text-5xl font-black">{(wallet?.solde || 0).toLocaleString()}</span>
            <span className="text-xl font-semibold">XOF</span>
          </div>
          <div className="grid grid-cols-2 gap-3 relative">
            <div className="bg-white/15 rounded-xl p-3">
              <p className="text-white/70 text-xs">Aujourd'hui</p>
              <p className="font-black">{fXOF(gainsDuJour)}</p>
            </div>
            <div className="bg-white/15 rounded-xl p-3">
              <p className="text-white/70 text-xs">Ce mois</p>
              <p className="font-black">{fXOF(gainsDuMois)}</p>
            </div>
          </div>
        </div>

        {/* Retrait */}
        <button onClick={() => setShowRetrait(!showRetrait)}
          className="w-full bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3 hover:border-orange-200 transition-all">
          <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center"><Banknote size={18} className="text-nyme-orange" /></div>
          <div className="flex-1 text-left"><p className="font-bold text-gray-900 text-sm">Demander un retrait</p><p className="text-gray-400 text-xs">Virement sous 24h — minimum 1000 XOF</p></div>
        </button>

        {showRetrait && (
          <div className="bg-white rounded-2xl p-5 border-2 border-orange-200 space-y-4">
            <h3 className="font-bold text-gray-900">Demande de retrait</h3>
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200 flex items-start gap-2">
              <AlertCircle size={14} className="text-amber-600 shrink-0 mt-0.5" />
              <p className="text-amber-700 text-xs">Un seul retrait autorisé tous les 2 jours. Virement vers Mobile Money ou compte bancaire enregistré.</p>
            </div>
            <div className="relative">
              <input type="number" placeholder="Montant à retirer" value={montantRetrait}
                onChange={e => setMontantRetrait(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-orange-400 pr-16" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-xs font-semibold">XOF</span>
            </div>
            <p className="text-gray-400 text-xs">Solde disponible : {fXOF(wallet?.solde || 0)}</p>
            <div className="flex gap-3">
              <button onClick={() => setShowRetrait(false)} className="flex-1 py-3 rounded-xl border-2 border-gray-200 font-bold text-gray-700">Annuler</button>
              <button onClick={handleRetrait} disabled={submittingRetrait}
                className="flex-1 py-3 rounded-xl bg-nyme-orange text-white font-bold hover:bg-orange-600 disabled:opacity-50">
                {submittingRetrait ? 'Traitement...' : 'Demander'}
              </button>
            </div>
          </div>
        )}

        {/* Historique */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="font-bold text-gray-900">Historique des gains</h3>
            <span className="text-gray-400 text-xs">{transactions.length} transactions</span>
          </div>
          {transactions.length === 0 ? (
            <div className="p-10 text-center"><Clock size={32} className="text-gray-200 mx-auto mb-3" /><p className="text-gray-400 text-sm">Aucune transaction</p></div>
          ) : (
            <div className="divide-y divide-gray-50">
              {transactions.map(tx => {
                const isGain = ['gain', 'gain_course', 'bonus', 'remboursement'].includes(tx.type)
                return (
                  <div key={tx.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg shrink-0 ${isGain ? 'bg-green-100' : 'bg-red-100'}`}>
                      {isGain ? '💰' : tx.type === 'retrait' ? '🏦' : '📊'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{tx.note || tx.type}</p>
                      <p className="text-gray-400 text-xs">{fDate(tx.created_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-black text-sm ${isGain ? 'text-green-600' : 'text-red-500'}`}>
                        {isGain ? '+' : '-'}{Math.abs(tx.montant).toLocaleString()} XOF
                      </p>
                      {tx.solde_apres !== undefined && <p className="text-gray-400 text-xs">{tx.solde_apres.toLocaleString()} XOF</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
