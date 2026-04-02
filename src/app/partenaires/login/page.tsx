'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function PartenairesLoginPage() {
  const router = useRouter()

  const [mode,     setMode]     = useState<'login' | 'signup'>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  // ── Connexion ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (authErr) throw authErr

      // Vérifier le rôle partenaire
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (profile?.role !== 'partenaire' && profile?.role !== 'admin') {
        await supabase.auth.signOut()
        throw new Error("Accès réservé aux partenaires NYME. Contactez nyme.contact@gmail.com")
      }

      router.push('/partenaires/dashboard')
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion. Vérifiez vos identifiants.')
    } finally {
      setLoading(false)
    }
  }

  // ── Inscription ──
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    try {
      const { error: authErr } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/partenaires/login`,
          data: { role: 'partenaire' },
        },
      })
      if (authErr) throw authErr
      setSuccess('Vérifiez votre boîte email pour confirmer votre compte.')
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'inscription.')
    } finally {
      setLoading(false)
    }
  }

  // ── Reset mot de passe ──
  const handleReset = async () => {
    if (!email.trim()) { setError('Entrez votre email d\'abord.'); return }
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/partenaires/login`,
    })
    setLoading(false)
    if (err) setError(err.message)
    else setSuccess('Email de réinitialisation envoyé.')
  }

  return (
    <div className="min-h-screen bg-nyme-dark flex items-center justify-center p-4">
      {/* Fond animé */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-10 left-10 w-72 h-72 rounded-full bg-nyme-primary/30 blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-nyme-orange/8 blur-3xl animate-float" />
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(232,119,34,0.8) 1px,transparent 1px),linear-gradient(90deg,rgba(232,119,34,0.8) 1px,transparent 1px)', backgroundSize: '60px 60px' }} />
      </div>

      <div className="relative w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-nyme-orange to-[#d4691a] flex items-center justify-center shadow-lg shadow-nyme-orange/30">
              <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-heading text-2xl font-extrabold text-white tracking-wider">NYME</span>
          </Link>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-nyme-orange/15 border border-nyme-orange/30">
            <span className="text-nyme-orange text-sm font-semibold font-body">⭐ Espace Partenaires</span>
          </div>
        </div>

        {/* Carte login */}
        <div className="glass rounded-2xl p-8 border border-white/12">

          {/* Tabs */}
          <div className="flex rounded-xl bg-white/5 p-1 mb-6">
            {(['login', 'signup'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => { setMode(tab); setError(''); setSuccess('') }}
                className={`flex-1 py-2.5 rounded-lg text-sm font-semibold font-body transition-all duration-200 ${
                  mode === tab
                    ? 'bg-nyme-orange text-white shadow-lg shadow-nyme-orange/30'
                    : 'text-white/55 hover:text-white'
                }`}
              >
                {tab === 'login' ? 'Se connecter' : "S'inscrire"}
              </button>
            ))}
          </div>

          <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-4">

            {/* Email */}
            <div>
              <label className="block text-white/60 text-xs uppercase tracking-wider font-semibold mb-1.5 font-body">
                Email professionnel
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="vous@entreprise.com"
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-nyme-orange/60 focus:bg-white/10 transition-all font-body text-sm"
                />
              </div>
            </div>

            {/* Mot de passe */}
            <div>
              <label className="block text-white/60 text-xs uppercase tracking-wider font-semibold mb-1.5 font-body">
                Mot de passe
              </label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
                <input
                  type={showPw ? 'text' : 'password'}
                  required
                  minLength={8}
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

            {/* Erreur / succès */}
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

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-nyme-orange to-[#d4691a] text-white font-bold text-sm font-body flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-nyme-orange/35 transition-all duration-300 disabled:opacity-60"
            >
              {loading ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Chargement...</>
              ) : (
                <>{mode === 'login' ? 'Accéder au dashboard' : 'Créer mon compte'} <ArrowRight size={15} /></>
              )}
            </button>

            {/* Mot de passe oublié */}
            {mode === 'login' && (
              <button
                type="button"
                onClick={handleReset}
                className="w-full text-center text-white/40 text-xs font-body hover:text-white/70 transition-colors"
              >
                Mot de passe oublié ?
              </button>
            )}
          </form>

          <div className="mt-6 pt-5 border-t border-white/8 text-center">
            <p className="text-white/40 text-xs font-body">
              Pas encore partenaire ?{' '}
              <Link href="/partenaires#abonnements" className="text-nyme-orange hover:underline font-semibold">
                Voir les offres →
              </Link>
            </p>
            <p className="text-white/30 text-xs font-body mt-1">
              Support :{' '}
              <a href="mailto:nyme.contact@gmail.com" className="text-white/50 hover:text-nyme-orange transition-colors">
                nyme.contact@gmail.com
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-white/20 text-xs font-body mt-6">
          © {new Date().getFullYear()} NYME · Ouagadougou, Burkina Faso
        </p>
      </div>
    </div>
  )
}
