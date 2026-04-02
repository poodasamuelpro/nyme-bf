'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Zap, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    // Vérifier si le token est valide
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setError('Lien invalide ou expiré. Veuillez recommencer.')
      }
    }
    checkSession()
  }, [])

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères')
      return
    }
    
    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas')
      return
    }
    
    setLoading(true)
    setError('')
    setSuccess('')
    
    const { error: updateError } = await supabase.auth.updateUser({
      password: password
    })
    
    setLoading(false)
    
    if (updateError) {
      setError(updateError.message)
    } else {
      setSuccess('Mot de passe mis à jour avec succès ! Redirection...')
      setTimeout(() => {
        router.push('/partenaires/login')
      }, 2000)
    }
  }

  return (
    <div className="min-h-screen bg-nyme-dark flex items-center justify-center p-4">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-nyme-primary/30 blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-nyme-orange/8 blur-3xl animate-float" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-nyme-orange to-[#d4691a] flex items-center justify-center shadow-lg shadow-nyme-orange/30">
              <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-heading text-2xl font-extrabold text-white tracking-wider">NYME</span>
          </Link>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-nyme-orange/15 border border-nyme-orange/30">
            <span className="text-nyme-orange text-sm font-semibold font-body">🔐 Nouveau mot de passe</span>
          </div>
        </div>

        <div className="glass rounded-2xl p-8 border border-white/12">
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-white/60 text-xs uppercase tracking-wider font-semibold mb-1.5 font-body">
                Nouveau mot de passe
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-nyme-orange/60 focus:bg-white/10 transition-all font-body text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/35 hover:text-white transition-colors"
                >
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-white/60 text-xs uppercase tracking-wider font-semibold mb-1.5 font-body">
                Confirmer le mot de passe
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-nyme-orange/60 focus:bg-white/10 transition-all font-body text-sm"
                />
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-nyme-red/12 border border-nyme-red/25 text-nyme-red text-sm font-body">
                ⚠️ {error}
              </div>
            )}
            {success && (
              <div className="p-3 rounded-xl bg-nyme-green/12 border border-nyme-green/25 text-nyme-green text-sm font-body">
                ✅ {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-nyme-orange to-[#d4691a] text-white font-bold text-sm font-body flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-nyme-orange/35 transition-all duration-300 disabled:opacity-60"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Mise à jour...</>
              ) : (
                <>Mettre à jour le mot de passe <ArrowRight size={15} /></>
              )}
            </button>

            <button
              type="button"
              onClick={() => router.push('/partenaires/login')}
              className="w-full text-center text-white/40 text-xs font-body hover:text-white/70 transition-colors"
            >
              ← Retour à la connexion
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}