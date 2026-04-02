'use client' 

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2, Building2, User, Phone } from 'lucide-react'
import Link from 'next/link'

type Mode = 'login' | 'signup' | 'reset'

export default function PartenairesLoginPage() {
  const router = useRouter()
  const [mode,       setMode]       = useState<Mode>('login')
  const [email,      setEmail]      = useState('')
  const [password,   setPassword]   = useState('')
  const [entreprise, setEntreprise] = useState('')
  const [nomContact, setNomContact] = useState('')
  const [telephone,  setTelephone]  = useState('')
  const [showPw,     setShowPw]     = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [error,      setError]      = useState('')
  const [success,    setSuccess]    = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data } = await supabase
          .from('partenaires')
          .select('id')
          .eq('user_id', session.user.id)
          .single()
        if (data) router.replace('/partenaires/dashboard')
      }
    })
  }, [router])

  const reset = () => { setError(''); setSuccess('') }

  // ── CONNEXION ──────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); reset()
    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (authErr) {
        if (
          authErr.message.includes('Invalid login credentials') ||
          authErr.message.includes('invalid_credentials')
        ) {
          throw new Error('Email ou mot de passe incorrect. Vérifiez vos identifiants.')
        }
        if (authErr.message.includes('Email not confirmed')) {
          throw new Error('Email non confirmé. Vérifiez votre boîte mail.')
        }
        throw new Error(authErr.message)
      }

      if (!data.session) throw new Error('Connexion échouée, réessayez')

      const userId = data.session.user.id

      const { data: part, error: partErr } = await supabase
        .from('partenaires')
        .select('id, statut')
        .eq('user_id', userId)
        .single()

      if (partErr || !part) {
        const { data: utilData } = await supabase
          .from('utilisateurs')
          .select('role')
          .eq('id', userId)
          .single()

        await supabase.auth.signOut()

        if (utilData && utilData.role !== 'partenaire') {
          throw new Error('Ce compte n\'est pas un compte partenaire. Utilisez l\'application NYME.')
        }
        throw new Error('Aucun compte partenaire trouvé. Veuillez vous inscrire ou contacter nyme.contact@gmail.com')
      }

      if (part.statut === 'suspendu') {
        await supabase.auth.signOut()
        throw new Error('Compte suspendu. Contactez le support : nyme.contact@gmail.com')
      }
      if (part.statut === 'rejete') {
        await supabase.auth.signOut()
        throw new Error('Demande de partenariat rejetée. Contactez nyme.contact@gmail.com')
      }

      setSuccess('✅ Connexion réussie ! Redirection vers le dashboard...')
      setTimeout(() => router.push('/partenaires/dashboard'), 800)

    } catch (err: any) {
      setError(err.message || 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  // ── INSCRIPTION ────────────────────────────────────────────────
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); reset()

    if (!entreprise.trim()) {
      setError('Le nom de l\'entreprise est requis')
      setLoading(false); return
    }
    if (!nomContact.trim()) {
      setError('Le nom du contact est requis')
      setLoading(false); return
    }
    if (password.length < 8) {
      setError('Mot de passe : minimum 8 caractères')
      setLoading(false); return
    }

    try {
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            role: 'partenaire',
            nom: nomContact.trim(),
            telephone: telephone.trim() || null,
          },
        },
      })

      if (authErr) {
        if (authErr.message.includes('already registered') || authErr.message.includes('already been registered')) {
          throw new Error('Cet email est déjà utilisé. Connectez-vous ou réinitialisez votre mot de passe.')
        }
        throw new Error(authErr.message)
      }

      if (!authData.user) throw new Error('Erreur lors de la création du compte')

      const userId = authData.user.id

      const { error: upsertErr } = await supabase
        .from('utilisateurs')
        .upsert({
          id:          userId,
          nom:         nomContact.trim(),
          email:       email.trim().toLowerCase(),
          telephone:   telephone.trim() || null,
          role:        'partenaire',
          est_verifie: false,
          est_actif:   true,
          created_at:  new Date().toISOString(),
          updated_at:  new Date().toISOString(),
        }, { onConflict: 'id' })

      if (upsertErr) {
        console.warn('upsert utilisateurs (non bloquant):', upsertErr.message)
      }

      const session = authData.session
      const accessToken = session?.access_token

      if (!accessToken) {
        setSuccess('🎉 Compte créé ! Votre demande est en cours de validation. Vous pouvez vous connecter maintenant.')
        setMode('login')
        setPassword('')
        setLoading(false)
        return
      }

      const { error: partErr } = await supabase
        .from('partenaires')
        .insert({
          user_id:         userId,
          entreprise:      entreprise.trim(),
          nom_contact:     nomContact.trim(),
          telephone:       telephone.trim() || null,
          email_pro:       email.trim().toLowerCase(),
          plan:            'starter',
          statut:          'en_attente',
          livraisons_max:  30,
          livraisons_mois: 0,
          taux_commission: 12.0,
          date_debut:      new Date().toISOString(),
        })

      if (partErr) {
        console.warn('Insert partenaires direct échoué:', partErr.message)

        const apiRes = await fetch('/api/partenaires/create-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            user_id:     userId,
            entreprise:  entreprise.trim(),
            nom_contact: nomContact.trim(),
            telephone:   telephone.trim() || null,
            email_pro:   email.trim().toLowerCase(),
          }),
        })

        if (!apiRes.ok) {
          const errData = await apiRes.json()
          throw new Error(errData.error || 'Erreur lors de la création du profil partenaire.')
        }
      }

      setSuccess('🎉 Compte créé avec succès ! Votre demande est en attente de validation par l\'administration. Vous pouvez vous connecter.')
      setMode('login')
      setPassword('')
      setEntreprise('')
      setNomContact('')
      setTelephone('')

    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'inscription')
    } finally {
      setLoading(false)
    }
  }

  // ── RESET MOT DE PASSE ─────────────────────────────────────────
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setError('Entrez votre email'); return }
    setLoading(true); reset()
    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/partenaires/reset-password` }
    )
    setLoading(false)
    if (err) { setError(err.message) }
    else {
      setSuccess('📧 Email envoyé ! Vérifiez votre boîte mail.')
      setTimeout(() => { setMode('login'); setSuccess('') }, 5000)
    }
  }

  return (
    <div className="min-h-screen bg-[#0A2E8A] flex items-center justify-center p-4">
      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[#E87722] to-[#F59343] flex items-center justify-center shadow-lg">
              <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-heading text-2xl font-extrabold text-white tracking-wider">NYME</span>
          </Link>
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20">
            <span className="text-[#F59343] text-sm font-semibold">
              {mode === 'reset' ? '🔐 Réinitialisation' : '⭐ Espace Partenaires'}
            </span>
          </div>
        </div>

        <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 border border-white/15 shadow-2xl">
          {/* Messages */}
          {success && (
            <div className="mb-6 p-4 rounded-xl bg-green-500/20 border border-green-500/30 flex items-start gap-3 text-green-400 text-sm">
              <CheckCircle2 size={18} className="shrink-0 mt-0.5"/>
              <span>{success}</span>
            </div>
          )}
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/20 border border-red-500/30 flex items-start gap-3 text-red-400 text-sm">
              <AlertCircle size={18} className="shrink-0 mt-0.5"/>
              <span>{error}</span>
            </div>
          )}

          {/* ── RESET ── */}
          {mode === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-white/70 text-xs uppercase tracking-wider font-semibold mb-1.5">Email professionnel</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@entreprise.com"
                    className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-[#E87722] transition-all" />
                </div>
              </div>
              <button type="submit" disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#E87722] to-[#F59343] text-white font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50">
                {loading ? 'Envoi...' : 'Envoyer le lien de réinitialisation'}
              </button>
              <button type="button" onClick={() => { setMode('login'); reset() }}
                className="w-full text-white/50 text-xs hover:text-white transition-colors">
                ← Retour à la connexion
              </button>
            </form>
          )}

          {/* ── LOGIN ── */}
          {mode === 'login' && (
            <>
              {/* ✅ FIX: classes statiques — plus de comparaison mode === 'login' dans className */}
              <div className="flex mb-6 rounded-xl bg-white/5 border border-white/10 p-1">
                <button
                  onClick={() => { setMode('login'); reset() }}
                  className="flex-1 py-2 rounded-lg text-sm font-bold bg-white text-[#0A2E8A] shadow-sm transition-all"
                >
                  Connexion
                </button>
                <button
                  onClick={() => { setMode('signup'); reset() }}
                  className="flex-1 py-2 rounded-lg text-sm font-bold text-white/50 hover:text-white transition-all"
                >
                  Inscription
                </button>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-white/70 text-xs uppercase tracking-wider font-semibold mb-1.5">Email</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@entreprise.com"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-[#E87722] transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-white/70 text-xs uppercase tracking-wider font-semibold mb-1.5">Mot de passe</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                    <input type={showPw ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                      className="w-full pl-10 pr-11 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-[#E87722] transition-all" />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors">
                      {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#E87722] to-[#F59343] text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50">
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Connexion...</>
                    : <>Se connecter <ArrowRight size={16}/></>}
                </button>
                <button type="button" onClick={() => { setMode('reset'); reset() }}
                  className="w-full text-white/50 text-xs hover:text-white transition-colors text-center">
                  Mot de passe oublié ?
                </button>
              </form>
            </>
          )}

          {/* ── SIGNUP ── */}
          {mode === 'signup' && (
            <>
              {/* ✅ FIX: classes statiques — plus de comparaison mode === 'signup' dans className */}
              <div className="flex mb-6 rounded-xl bg-white/5 border border-white/10 p-1">
                <button
                  onClick={() => { setMode('login'); reset() }}
                  className="flex-1 py-2 rounded-lg text-sm font-bold text-white/50 hover:text-white transition-all"
                >
                  Connexion
                </button>
                <button
                  onClick={() => { setMode('signup'); reset() }}
                  className="flex-1 py-2 rounded-lg text-sm font-bold bg-white text-[#0A2E8A] shadow-sm transition-all"
                >
                  Inscription
                </button>
              </div>

              <form onSubmit={handleSignup} className="space-y-4">
                <div>
                  <label className="block text-white/70 text-xs uppercase tracking-wider font-semibold mb-1.5">Entreprise *</label>
                  <div className="relative">
                    <Building2 size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                    <input type="text" required value={entreprise} onChange={e => setEntreprise(e.target.value)} placeholder="Nom de l'entreprise"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-[#E87722] transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-white/70 text-xs uppercase tracking-wider font-semibold mb-1.5">Nom du contact *</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                    <input type="text" required value={nomContact} onChange={e => setNomContact(e.target.value)} placeholder="Votre nom complet"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-[#E87722] transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-white/70 text-xs uppercase tracking-wider font-semibold mb-1.5">Téléphone</label>
                  <div className="relative">
                    <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                    <input type="tel" value={telephone} onChange={e => setTelephone(e.target.value)} placeholder="+226 XX XX XX XX"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-[#E87722] transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-white/70 text-xs uppercase tracking-wider font-semibold mb-1.5">Email professionnel *</label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="vous@entreprise.com"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-[#E87722] transition-all" />
                  </div>
                </div>
                <div>
                  <label className="block text-white/70 text-xs uppercase tracking-wider font-semibold mb-1.5">Mot de passe *</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40" />
                    <input type={showPw ? 'text' : 'password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} placeholder="Minimum 8 caractères"
                      className="w-full pl-10 pr-11 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:border-[#E87722] transition-all" />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors">
                      {showPw ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  </div>
                </div>
                <p className="text-white/40 text-xs">
                  En vous inscrivant, votre demande sera examinée par notre équipe. Vous serez notifié par email.
                </p>
                <button type="submit" disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#E87722] to-[#F59343] text-white font-bold text-sm shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50">
                  {loading
                    ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Création du compte...</>
                    : <>Créer mon compte partenaire <ArrowRight size={16}/></>}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-white/30 text-xs mt-6">
          Besoin d&apos;aide ? <a href="mailto:nyme.contact@gmail.com" className="text-white/60 hover:text-white underline transition-colors">nyme.contact@gmail.com</a>
        </p>
      </div>
    </div>
  )
}
