'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Zap, Mail, Lock, Eye, EyeOff, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'

export default function PartenairesLoginPage() {
  const router = useRouter()

  const [mode,     setMode]     = useState<'login' | 'signup' | 'reset'>('login')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [entreprise, setEntreprise] = useState('')
  const [nomContact, setNomContact] = useState('')
  const [telephone, setTelephone] = useState('')
  const [showPw,   setShowPw]   = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [success,  setSuccess]  = useState('')

  // Vérifier si déjà connecté
  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) router.replace('/partenaires/dashboard')
    }
    check()
  }, [router])

  const resetForm = () => {
    setError('')
    setSuccess('')
  }

  // ── Connexion ──────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    resetForm()

    try {
      const { data, error: authErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (authErr) {
        if (authErr.message.includes('Invalid login credentials')) {
          throw new Error('Email ou mot de passe incorrect')
        }
        if (authErr.message.includes('Email not confirmed')) {
          throw new Error('Email non confirmé. Contactez nyme.contact@gmail.com')
        }
        throw new Error(authErr.message)
      }

      if (!data.session) throw new Error('Connexion échouée, réessayez')

      // Vérifier que le compte partenaire existe
      const { data: part, error: partErr } = await supabase
        .from('partenaires')
        .select('id, statut')
        .eq('user_id', data.session.user.id)
        .single()

      if (partErr || !part) {
        await supabase.auth.signOut()
        throw new Error('Aucun compte partenaire trouvé pour cet email. Contactez nyme.contact@gmail.com')
      }

      if (part.statut === 'suspendu') {
        await supabase.auth.signOut()
        throw new Error('Votre compte partenaire est suspendu. Contactez nyme.contact@gmail.com')
      }

      setSuccess('Connexion réussie ! Redirection...')
      setTimeout(() => router.push('/partenaires/dashboard'), 800)

    } catch (err: any) {
      setError(err.message || 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  // ── Inscription SANS confirmation email ───────────────────
  // Note : désactiver "Confirm email" dans Supabase Dashboard
  // Authentication → Settings → Email Auth → décocher "Confirm email"
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    resetForm()

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères')
      setLoading(false)
      return
    }
    if (!entreprise.trim()) {
      setError('Le nom de l\'entreprise est obligatoire')
      setLoading(false)
      return
    }
    if (!nomContact.trim()) {
      setError('Le nom du contact est obligatoire')
      setLoading(false)
      return
    }

    try {
      // 1. Créer le compte auth Supabase
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          // emailRedirectTo vide = pas de confirmation email
          // IMPORTANT : désactiver "Confirm email" dans Supabase Dashboard
          data: {
            role: 'partenaire',
            nom: nomContact.trim(),
          },
        },
      })

      if (authErr) {
        if (authErr.message.includes('already registered')) {
          throw new Error('Cet email est déjà utilisé. Connectez-vous.')
        }
        throw new Error(authErr.message)
      }

      if (!authData.user) throw new Error('Erreur création du compte')

      const userId = authData.user.id

      // 2. Créer l'entrée dans la table "utilisateurs" (table NYME principale)
      const { error: userErr } = await supabase
        .from('utilisateurs')
        .upsert({
          id: userId,
          nom: nomContact.trim(),
          telephone: telephone.trim() || null,
          email: email.trim().toLowerCase(),
          role: 'partenaire',
          est_verifie: false,
          est_actif: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: 'id' })

      if (userErr) {
        console.error('Erreur création utilisateur:', userErr)
        // Non bloquant — l'entrée peut déjà exister via trigger Supabase
      }

      // 3. Créer l'entrée dans la table "partenaires"
      const { error: partErr } = await supabase
        .from('partenaires')
        .insert({
          user_id: userId,
          entreprise: entreprise.trim(),
          nom_contact: nomContact.trim(),
          telephone: telephone.trim() || null,
          email_pro: email.trim().toLowerCase(),
          plan: 'starter',
          statut: 'en_attente', // L'admin valide manuellement
          livraisons_max: 30,
          livraisons_mois: 0,
          taux_commission: 12.0,
          date_debut: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })

      if (partErr) {
        console.error('Erreur création partenaire:', partErr)
        throw new Error('Erreur lors de la création du profil partenaire. Contactez le support.')
      }

      // 4. Connexion automatique si email non confirmé requis
      if (authData.session) {
        // Session déjà créée (email confirm désactivé)
        setSuccess('Compte créé ! En attente de validation par notre équipe...')
        setTimeout(() => router.push('/partenaires/dashboard'), 1500)
      } else {
        // Email confirm activé → demander de se connecter
        setSuccess('Compte créé ! Connectez-vous maintenant.')
        setMode('login')
        setPassword('')
      }

    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'inscription')
    } finally {
      setLoading(false)
    }
  }

  // ── Reset mot de passe ──────────────────────────────────
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Entrez votre email')
      return
    }
    setLoading(true)
    resetForm()

    const { error: err } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/partenaires/reset-password` }
    )

    setLoading(false)
    if (err) {
      setError(err.message)
    } else {
      setSuccess('Email de réinitialisation envoyé ! Vérifiez votre boîte.')
      setTimeout(() => { setMode('login'); setSuccess('') }, 5000)
    }
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
            <span className="text-nyme-orange text-sm font-semibold font-body">
              {mode === 'reset' ? '🔐 Réinitialisation' : '⭐ Espace Partenaires'}
            </span>
          </div>
        </div>

        {/* Carte principale */}
        <div className="glass rounded-2xl p-8 border border-white/12">

          {/* ── RESET MODE ── */}
          {mode === 'reset' && (
            <form onSubmit={handleReset} className="space-y-4">
              <h2 className="text-white font-heading font-bold text-lg mb-2">
                Réinitialiser le mot de passe
              </h2>
              <InputField
                icon={Mail}
                type="email"
                label="Email professionnel"
                value={email}
                onChange={setEmail}
                placeholder="vous@entreprise.com"
              />
              <Messages error={error} success={success} />
              <SubmitButton loading={loading} label="Envoyer l'email de réinitialisation" />
              <BackButton onClick={() => { setMode('login'); resetForm() }} label="← Retour à la connexion" />
            </form>
          )}

          {/* ── LOGIN / SIGNUP MODE ── */}
          {mode !== 'reset' && (
            <>
              {/* Tabs */}
              <div className="flex rounded-xl bg-white/5 p-1 mb-6">
                {(['login', 'signup'] as const).map((m) => (
                  <button key={m}
                    onClick={() => { setMode(m); resetForm() }}
                    className={`flex-1 py-2.5 rounded-lg text-sm font-semibold font-body transition-all duration-200 ${
                      mode === m
                        ? 'bg-nyme-orange text-white shadow-lg shadow-nyme-orange/30'
                        : 'text-white/55 hover:text-white'
                    }`}
                  >
                    {m === 'login' ? 'Se connecter' : 'S\'inscrire'}
                  </button>
                ))}
              </div>

              <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-4">

                {/* Champs inscription uniquement */}
                {mode === 'signup' && (
                  <>
                    <InputField
                      icon={Mail}
                      type="text"
                      label="Nom de l'entreprise *"
                      value={entreprise}
                      onChange={setEntreprise}
                      placeholder="Ma Boutique SARL"
                    />
                    <InputField
                      icon={Mail}
                      type="text"
                      label="Votre nom complet *"
                      value={nomContact}
                      onChange={setNomContact}
                      placeholder="Jean Dupont"
                    />
                    <InputField
                      icon={Mail}
                      type="tel"
                      label="Téléphone (optionnel)"
                      value={telephone}
                      onChange={setTelephone}
                      placeholder="+226 70 00 00 00"
                    />
                  </>
                )}

                <InputField
                  icon={Mail}
                  type="email"
                  label="Email professionnel *"
                  value={email}
                  onChange={setEmail}
                  placeholder="vous@entreprise.com"
                />

                <div>
                  <label className="block text-white/60 text-xs uppercase tracking-wider font-semibold mb-1.5 font-body">
                    Mot de passe * {mode === 'signup' && <span className="normal-case text-white/30">(min. 8 caractères)</span>}
                  </label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      required
                      minLength={mode === 'signup' ? 8 : 1}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full pl-10 pr-10 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-nyme-orange/60 focus:bg-white/10 transition-all font-body text-sm"
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/35 hover:text-white transition-colors">
                      {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Info inscription */}
                {mode === 'signup' && (
                  <div className="p-3 rounded-xl bg-nyme-primary/10 border border-nyme-primary/20 text-white/60 text-xs font-body">
                    ℹ️ Votre compte sera activé après validation par notre équipe (24-48h).
                    Vous pouvez consulter votre tableau de bord en attendant.
                  </div>
                )}

                <Messages error={error} success={success} />

                <SubmitButton
                  loading={loading}
                  label={mode === 'login' ? 'Accéder au dashboard' : 'Créer mon compte'}
                />

                {mode === 'login' && (
                  <BackButton
                    onClick={() => { setMode('reset'); resetForm() }}
                    label="Mot de passe oublié ?"
                  />
                )}
              </form>
            </>
          )}

          <div className="mt-6 pt-5 border-t border-white/8 text-center space-y-1">
            <p className="text-white/40 text-xs font-body">
              Pas encore partenaire ?{' '}
              <Link href="/partenaires#abonnements" className="text-nyme-orange hover:underline font-semibold">
                Voir les offres →
              </Link>
            </p>
            <p className="text-white/30 text-xs font-body">
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

// ── Sous-composants ──────────────────────────────────────────

function InputField({ icon: Icon, type, label, value, onChange, placeholder }: {
  icon: React.ElementType
  type: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder: string
}) {
  return (
    <div>
      <label className="block text-white/60 text-xs uppercase tracking-wider font-semibold mb-1.5 font-body">
        {label}
      </label>
      <div className="relative">
        <Icon size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35" />
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/8 border border-white/15 text-white placeholder-white/30 focus:outline-none focus:border-nyme-orange/60 focus:bg-white/10 transition-all font-body text-sm"
        />
      </div>
    </div>
  )
}

function Messages({ error, success }: { error: string; success: string }) {
  if (!error && !success) return null
  return (
    <>
      {error && (
        <div className="p-3 rounded-xl bg-red-500/12 border border-red-500/25 text-red-400 text-sm font-body flex items-start gap-2">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 rounded-xl bg-green-500/12 border border-green-500/25 text-green-400 text-sm font-body flex items-start gap-2">
          <CheckCircle2 size={15} className="shrink-0 mt-0.5" />
          {success}
        </div>
      )}
    </>
  )
}

function SubmitButton({ loading, label }: { loading: boolean; label: string }) {
  return (
    <button type="submit" disabled={loading}
      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-nyme-orange to-[#d4691a] text-white font-bold text-sm font-body flex items-center justify-center gap-2 hover:shadow-lg hover:shadow-nyme-orange/35 transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed">
      {loading ? (
        <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Chargement...</>
      ) : (
        <>{label} <ArrowRight size={15} /></>
      )}
    </button>
  )
}

function BackButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full text-center text-white/40 text-xs font-body hover:text-white/70 transition-colors pt-1">
      {label}
    </button>
  )
}
