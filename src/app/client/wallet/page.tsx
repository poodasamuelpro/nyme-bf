// src/app/client/wallet/page.tsx
'use client'
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Wallet, TransactionWallet } from '@/lib/supabase'
import { ArrowLeft, TrendingUp, TrendingDown, Clock, RefreshCw, CreditCard, Smartphone, Banknote } from 'lucide-react'
import toast from 'react-hot-toast'

const TX_CFG: Record<string, { label: string; icon: string; credit: boolean }> = {
  gain:             { label: 'Gain course',     icon: '💰', credit: true },
  gain_course:      { label: 'Gain course',     icon: '💰', credit: true },
  recharge:         { label: 'Recharge',        icon: '💳', credit: true },
  bonus:            { label: 'Bonus',           icon: '🎁', credit: true },
  remboursement:    { label: 'Remboursement',   icon: '↩️', credit: true },
  retrait:          { label: 'Retrait',         icon: '🏦', credit: false },
  commission:       { label: 'Commission NYME', icon: '📊', credit: false },
  paiement_course:  { label: 'Paiement',        icon: '📦', credit: false },
}

const MONTANTS_RAPIDES = [1000, 2500, 5000, 10000, 25000, 50000]

export default function ClientWalletPage() {
  const router = useRouter()
  const [userId,       setUserId]       = useState<string | null>(null)
  const [wallet,       setWallet]       = useState<Wallet | null>(null)
  const [transactions, setTransactions] = useState<TransactionWallet[]>([])
  const [loading,      setLoading]      = useState(true)
  const [refreshing,   setRefreshing]   = useState(false)
  const [showRecharge, setShowRecharge] = useState(false)
  const [montant,      setMontant]      = useState(5000)
  const [methodePmt,   setMethodePmt]   = useState<'mobile_money' | 'carte'>('mobile_money')
  const [submitting,   setSubmitting]   = useState(false)

  const fXOF = (n: number) => new Intl.NumberFormat('fr-FR').format(n) + ' XOF'
  const fDate = (d: string) => new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(d))

  const loadData = useCallback(async (uid: string) => {
    const { data: w } = await supabase.from('wallets').select('*').eq('user_id', uid).single()
    if (w) setWallet(w as Wallet)
    else {
      const { data: created } = await supabase.from('wallets').insert({ user_id: uid, solde: 0 }).select().single()
      if (created) setWallet(created as Wallet)
    }
    const { data: txs } = await supabase
      .from('transactions_wallet').select('*').eq('user_id', uid)
      .order('created_at', { ascending: false }).limit(50)
    setTransactions((txs || []) as TransactionWallet[])
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      // Vérif rôle
      const { data: u } = await supabase.from('utilisateurs').select('role').eq('id', session.user.id).single()
      if (!u || (u.role !== 'client' && u.role !== 'coursier')) { router.replace('/login'); return }
      setUserId(session.user.id)
      await loadData(session.user.id)
      setLoading(false)
    }
    init()
  }, [router, loadData])

  const handleRecharge = async () => {
    if (!userId || montant < 500) { toast.error('Montant minimum 500 XOF'); return }
    setSubmitting(true)
    try {
      // Appel à la fonction RPC atomique Supabase
      const { error } = await supabase.rpc('process_wallet_transaction', {
        p_user_id:      userId,
        p_type:         'recharge',
        p_montant:      montant,
        p_reference:    `RECHARGE_${userId}_${Date.now()}`,
        p_note:         `Recharge ${methodePmt === 'mobile_money' ? 'Mobile Money' : 'Carte'} — ${fXOF(montant)}`,
        p_payment_method: methodePmt,
      })
      if (error) throw new Error(error.message)
      toast.success(`Wallet rechargé de ${fXOF(montant)} !`)
      setShowRecharge(false)
      await loadData(userId)
    } catch (err: unknown) {
      toast.error('Erreur recharge — contactez le support NYME')
      console.error(err)
    } finally { setSubmitting(false) }
  }

  const stats = {
    totalCredits:  transactions.filter(t => TX_CFG[t.type]?.credit).reduce((s, t) => s + t.montant, 0),
    totalDebits:   transactions.filter(t => !TX_CFG[t.type]?.credit).reduce((s, t) => s + Math.abs(t.montant), 0),
    txCeMois:      transactions.filter(t => new Date(t.created_at).getMonth() === new Date().getMonth()).length,
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-blue-100 border-t-blue-600 rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200">
            <ArrowLeft size={16} className="text-gray-700" />
          </button>
          <div className="flex-1">
            <h1 className="font-heading font-bold text-gray-900">Mon Wallet</h1>
          </div>
          <button onClick={async () => { setRefreshing(true); if (userId) await loadData(userId); setRefreshing(false) }}
            className="p-2 rounded-xl hover:bg-gray-100">
            <RefreshCw size={16} className={`text-gray-500 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-5">
        {/* Carte solde principale */}
        <div className="bg-gradient-to-br from-nyme-primary to-nyme-primary-dark rounded-3xl p-8 text-white shadow-xl overflow-hidden relative">
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-white/5 rounded-full" />
          <p className="text-white/70 text-sm mb-1 relative">Solde disponible</p>
          <div className="flex items-baseline gap-2 mb-6 relative">
            <span className="text-5xl font-black">{(wallet?.solde || 0).toLocaleString()}</span>
            <span className="text-xl font-semibold">XOF</span>
          </div>
          <div className="grid grid-cols-3 gap-3 relative text-sm">
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-white/60 text-xs">Entrants</p>
              <p className="font-bold">{stats.totalCredits.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-white/60 text-xs">Sortants</p>
              <p className="font-bold">{stats.totalDebits.toLocaleString()}</p>
            </div>
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-white/60 text-xs">Ce mois</p>
              <p className="font-bold">{stats.txCeMois} tx</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => setShowRecharge(true)}
            className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-center gap-2 hover:border-blue-200 hover:shadow-md transition-all">
            <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center"><CreditCard size={18} className="text-blue-600" /></div>
            <p className="font-bold text-gray-900 text-sm">Recharger</p>
          </button>
          <button disabled className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-col items-center gap-2 opacity-50 cursor-not-allowed">
            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center"><Banknote size={18} className="text-gray-500" /></div>
            <p className="font-bold text-gray-900 text-sm">Retirer</p>
            <p className="text-gray-400 text-xs -mt-1">Bientôt</p>
          </button>
        </div>

        {/* Formulaire recharge */}
        {showRecharge && (
          <div className="bg-white rounded-2xl p-6 border-2 border-blue-200 shadow-sm space-y-4">
            <h3 className="font-bold text-gray-900">Recharger le wallet</h3>

            {/* Méthode paiement */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Méthode de paiement</p>
              <div className="grid grid-cols-2 gap-2">
                {([['mobile_money', '📱 Mobile Money', 'Orange, Wave, Moov'], ['carte', '💳 Carte bancaire', 'Visa, Mastercard']] as const).map(([m, label, sub]) => (
                  <button key={m} onClick={() => setMethodePmt(m)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${methodePmt === m ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <p className="font-bold text-sm text-gray-900">{label}</p>
                    <p className="text-xs text-gray-400">{sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Montants rapides */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Montant rapide</p>
              <div className="grid grid-cols-3 gap-2">
                {MONTANTS_RAPIDES.map(m => (
                  <button key={m} onClick={() => setMontant(m)}
                    className={`py-2 rounded-xl text-sm font-semibold border-2 transition-all ${montant === m ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'}`}>
                    {m.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase mb-1">Ou saisissez un montant</p>
              <div className="relative">
                <input type="number" min={500} step={500} value={montant}
                  onChange={e => setMontant(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 pr-16" />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-semibold">XOF</span>
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl p-3 border border-amber-200">
              <p className="text-amber-700 text-xs">⚠️ Paiement Mobile Money en cours d'intégration. Contactez <a href="https://wa.me/22600000000" className="underline font-semibold">NYME sur WhatsApp</a> pour recharger manuellement.</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowRecharge(false)} className="flex-1 py-3 rounded-xl border-2 border-gray-200 font-bold text-gray-700">Annuler</button>
              <button onClick={handleRecharge} disabled={submitting || montant < 500}
                className="flex-1 py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 disabled:opacity-50">
                {submitting ? 'Traitement...' : `Recharger ${fXOF(montant)}`}
              </button>
            </div>
          </div>
        )}

        {/* Historique transactions */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">Historique des transactions</h3>
          </div>
          {transactions.length === 0 ? (
            <div className="p-10 text-center">
              <Clock size={32} className="text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Aucune transaction pour le moment</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {transactions.map(tx => {
                const cfg = TX_CFG[tx.type] || { label: tx.type, icon: '💳', credit: tx.montant > 0 }
                return (
                  <div key={tx.id} className="flex items-center gap-4 p-4 hover:bg-gray-50">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-lg shrink-0">{cfg.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm">{cfg.label}</p>
                      {tx.note && <p className="text-gray-400 text-xs truncate">{tx.note}</p>}
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-gray-400 text-xs">{fDate(tx.created_at)}</p>
                        <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tx.status === 'completed' ? 'bg-green-100 text-green-700' : tx.status === 'pending' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                          {tx.status === 'completed' ? '✓' : tx.status === 'pending' ? '⏳' : '✗'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`font-black text-sm ${cfg.credit ? 'text-green-600' : 'text-red-500'}`}>
                        {cfg.credit ? '+' : '-'}{Math.abs(tx.montant).toLocaleString()} XOF
                      </p>
                      <p className="text-gray-400 text-xs">{tx.solde_apres?.toLocaleString()} XOF</p>
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
