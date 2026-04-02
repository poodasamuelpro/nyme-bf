'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Zap, Lock, Eye, EyeOff, ArrowRight, AlertCircle } from 'lucide-react'

export default function AdminLoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(), password,
      })
      if (authErr) throw new Error('Identifiants incorrects')
      if (!data.session) throw new Error('Connexion échouée')

      const { data: u, error: uErr } = await supabase
        .from('utilisateurs').select('role, est_actif')
        .eq('id', data.session.user.id).single()

      if (uErr || !u || u.role !== 'admin') {
        await supabase.auth.signOut()
        throw new Error('Accès refusé. Compte admin requis.')
      }
      if (!u.est_actif) {
        await supabase.auth.signOut()
        throw new Error('Compte désactivé.')
      }

      // ✅ window.location.replace : pas d'entrée dans l'historique, rechargement complet
      window.location.replace('/admin-x9k2m/dashboard')

    } catch (err: any) {
      setError(err.message || 'Erreur de connexion')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-nyme-blue-dark flex items-center justify-center p-4">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 opacity-[0.03]"
          style={{backgroundImage:'radial-gradient(circle, white 1px, transparent 1px)',backgroundSize:'30px 30px'}}/>
      </div>
      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-nyme-orange to-nyme-orange-light flex items-center justify-center shadow-nyme-orange mx-auto mb-4">
            <Zap className="w-7 h-7 text-white" strokeWidth={2.5}/>
          </div>
          <h1 className="font-heading text-2xl font-black text-white tracking-wide">NYME Admin</h1>
          <p className="text-white/40 text-xs mt-1 font-body">Accès restreint — administration</p>
        </div>
        <div className="bg-white/8 backdrop-blur-xl rounded-2xl p-8 border border-white/12 shadow-nyme-lg">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-white/60 text-xs uppercase tracking-wider font-semibold mb-1.5 font-body">Email</label>
              <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@nyme.app" autoComplete="email"
                className="w-full px-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-nyme-orange/60 transition-all font-body text-sm"/>
            </div>
            <div>
              <label className="block text-white/60 text-xs uppercase tracking-wider font-semibold mb-1.5 font-body">Mot de passe</label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35"/>
                <input type={showPw?'text':'password'} required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" autoComplete="current-password"
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-nyme-orange/60 transition-all font-body text-sm"/>
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/35 hover:text-white transition-colors">
                  {showPw ? <EyeOff size={14}/> : <Eye size={14}/>}
                </button>
              </div>
            </div>
            {error && (
              <div className="p-3 rounded-xl bg-red-500/12 border border-red-500/25 text-red-400 text-sm font-body flex items-start gap-2">
                <AlertCircle size={14} className="shrink-0 mt-0.5"/>{error}
              </div>
            )}
            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-nyme-orange to-nyme-orange-light text-white font-bold text-sm font-body flex items-center justify-center gap-2 disabled:opacity-60">
              {loading
                ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Connexion...</>
                : <>Accéder au dashboard <ArrowRight size={14}/></>}
            </button>
          </form>
        </div>
        <p className="text-center text-white/15 text-xs font-body mt-6">
          © {new Date().getFullYear()} NYME — Administration
        </p>
      </div>
    </div>
  )
}
