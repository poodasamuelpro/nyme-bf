// src/app/login/page.tsx — Login/Register CLIENT
// Vérification rôle dans la page uniquement (pas de middleware)
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, CheckCircle2, Zap, Package } from 'lucide-react'
import toast from 'react-hot-toast'

type Mode = 'login' | 'register'

function LoginPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode,          setMode]          = useState<Mode>('login')
  const [loading,       setLoading]       = useState(false)
  const [showPw,        setShowPw]        = useState(false)
  const [showPw2,       setShowPw2]       = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [form, setForm] = useState({ nom: '', email: '', telephone: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (searchParams.get('mode') === 'register') setMode('register')
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) redirectAfterLogin(session.user.id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const redirectAfterLogin = async (userId: string) => {
    const { data } = await supabase.from('utilisateurs').select('role').eq('id', userId).single()
    const role = data?.role
    const redirect = searchParams.get('redirect')
    if (redirect) { router.replace(redirect); return }
    if (role === 'coursier')   { router.replace('/coursier/dashboard-new'); return }
    if (role === 'admin')      { router.replace('/admin-x9k2m/dashboard'); return }
    if (role === 'partenaire') { router.replace('/partenaires/dashboard'); return }
    router.replace('/client/dashboard')
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Adresse email invalide'
    if (!form.password || form.password.length < 6) e.password = 'Minimum 6 caractères'
    if (mode === 'register') {
      if (!form.nom.trim() || form.nom.trim().length < 2) e.nom = 'Nom complet requis'
      if (!form.telephone.trim()) e.telephone = 'Numéro de téléphone requis'
      if (form.password !== form.confirmPassword) e.confirmPassword = 'Les mots de passe ne correspondent pas'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      })
      if (error) {
        throw new Error(
          error.message.includes('Invalid login credentials')
            ? 'Email ou mot de passe incorrect'
            : error.message
        )
      }
      if (data.user) {
        const { data: u } = await supabase.from('utilisateurs').select('role').eq('id', data.user.id).single()
        if (u?.role === 'coursier') {
          await supabase.auth.signOut()
          throw new Error('Ce compte coursier doit se connecter via l\'espace coursier')
        }
        toast.success('Connexion réussie !')
        await redirectAfterLogin(data.user.id)
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          data: {
            nom: form.nom.trim(),
            telephone: form.telephone.trim(),
            role: 'client',
          },
        },
      })
      if (error) {
        throw new Error(
          error.message.includes('already registered')
            ? 'Cet email est déjà utilisé'
            : error.message
        )
      }
      if (data.user) {
        // Upsert manuel sécurisé
        await supabase.from('utilisateurs').upsert({
          id: data.user.id,
          nom: form.nom.trim(),
          telephone: form.telephone.trim(),
          email: form.email.trim().toLowerCase(),
          role: 'client',
          est_verifie: false,
          est_actif: true,
        }, { onConflict: 'id' })

        // Créer wallet
        await supabase.from('wallets').upsert(
          { user_id: data.user.id, solde: 0, total_gains: 0, total_retraits: 0 },
          { onConflict: 'user_id' }
        )

        if (data.session) {
          toast.success('Compte créé avec succès !')
          router.replace('/client/dashboard')
        } else {
          toast('Vérifiez votre email pour confirmer votre compte', { icon: '📧' })
          setMode('login')
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'inscription')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback?role=client`,
          queryParams: { access_type: 'offline', prompt: 'consent' },
        },
      })
      if (error) throw error
    } catch {
      toast.error('Erreur lors de la connexion Google')
      setGoogleLoading(false)
    }
  }

  const field = (name: keyof typeof form) => ({
    value: form[name],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setForm(prev => ({ ...prev, [name]: e.target.value }))
      if (errors[name]) setErrors(prev => ({ ...prev, [name]: '' }))
    },
  })

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f172a' }}>
      {/* Arrière-plan */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-80 h-80 rounded-full opacity-10 blur-3xl" style={{ background: '#f97316' }} />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 rounded-full opacity-15 blur-3xl" style={{ background: '#1a56db', animationDelay: '1.5s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 pt-8 pb-4 flex items-center justify-between max-w-md mx-auto w-full">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
            <Zap size={20} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="font-black text-white text-xl tracking-wider">NYME</span>
        </Link>
        <Link href="/coursier/login"
          className="text-white/50 text-xs hover:text-white/80 transition-colors flex items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-white/10">
          Espace coursier <ArrowRight size={12} />
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-6 relative z-10">
        <div className="w-full max-w-md">
          {/* Titre */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-5"
              style={{ background: 'rgba(249,115,22,0.15)', border: '1px solid rgba(249,115,22,0.3)' }}>
              <Package size={14} className="text-orange-400" />
              <span className="text-orange-400 text-xs font-bold uppercase tracking-wide">Espace Client</span>
            </div>
            <h1 className="text-3xl font-black text-white mb-2">
              {mode === 'login' ? 'Bon retour 👋' : 'Rejoindre NYME'}
            </h1>
            <p className="text-white/50 text-sm">
              {mode === 'login'
                ? 'Connectez-vous pour commander vos livraisons'
                : 'Créez votre compte pour des livraisons express'}
            </p>
          </div>

          {/* Carte formulaire */}
          <div className="rounded-3xl p-6" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(20px)' }}>
            {/* Tabs */}
            <div className="flex rounded-2xl p-1 mb-6" style={{ background: 'rgba(255,255,255,0.05)' }}>
              {(['login', 'register'] as Mode[]).map(m => (
                <button key={m} onClick={() => { setMode(m); setErrors({}) }}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    mode === m
                      ? 'text-white shadow-lg'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                  style={mode === m ? { background: '#f97316' } : {}}>
                  {m === 'login' ? 'Se connecter' : 'Créer un compte'}
                </button>
              ))}
            </div>

            {/* Google */}
            <button onClick={handleGoogle} disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white hover:bg-gray-50 text-gray-800 font-bold text-sm transition-all active:scale-98 disabled:opacity-60 shadow-xl mb-4">
              {googleLoading
                ? <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                : <svg width="18" height="18" viewBox="0 0 18 18">
                    <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                    <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                    <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"/>
                    <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
                  </svg>
              }
              {googleLoading ? 'Connexion...' : 'Continuer avec Google'}
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
              <span className="text-white/30 text-xs">ou</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.1)' }} />
            </div>

            <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-3">
              {mode === 'register' && (
                <>
                  {/* Nom */}
                  <div>
                    <label className="block text-white/70 text-xs font-semibold mb-1.5 ml-1">Nom complet *</label>
                    <div className="relative">
                      <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                      <input
                        type="text"
                        placeholder="Votre nom complet"
                        autoComplete="name"
                        {...field('nom')}
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-white placeholder-white/30 text-sm outline-none transition-all"
                        style={{
                          background: errors.nom ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)',
                          border: `1px solid ${errors.nom ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'}`,
                        }}
                      />
                    </div>
                    {errors.nom && <p className="text-red-400 text-xs mt-1 ml-1">{errors.nom}</p>}
                  </div>

                  {/* Téléphone */}
                  <div>
                    <label className="block text-white/70 text-xs font-semibold mb-1.5 ml-1">Téléphone *</label>
                    <div className="relative">
                      <Phone size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                      <input
                        type="tel"
                        placeholder="+226 70 00 00 00"
                        autoComplete="tel"
                        {...field('telephone')}
                        className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-white placeholder-white/30 text-sm outline-none transition-all"
                        style={{
                          background: errors.telephone ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)',
                          border: `1px solid ${errors.telephone ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'}`,
                        }}
                      />
                    </div>
                    {errors.telephone && <p className="text-red-400 text-xs mt-1 ml-1">{errors.telephone}</p>}
                  </div>
                </>
              )}

              {/* Email */}
              <div>
                <label className="block text-white/70 text-xs font-semibold mb-1.5 ml-1">Adresse email *</label>
                <div className="relative">
                  <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type="email"
                    placeholder="votre@email.com"
                    autoComplete="email"
                    {...field('email')}
                    className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-white placeholder-white/30 text-sm outline-none transition-all"
                    style={{
                      background: errors.email ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)',
                      border: `1px solid ${errors.email ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'}`,
                    }}
                  />
                </div>
                {errors.email && <p className="text-red-400 text-xs mt-1 ml-1">{errors.email}</p>}
              </div>

              {/* Mot de passe */}
              <div>
                <label className="block text-white/70 text-xs font-semibold mb-1.5 ml-1">Mot de passe *</label>
                <div className="relative">
                  <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Minimum 6 caractères"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    {...field('password')}
                    className="w-full pl-11 pr-12 py-3.5 rounded-2xl text-white placeholder-white/30 text-sm outline-none transition-all"
                    style={{
                      background: errors.password ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)',
                      border: `1px solid ${errors.password ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'}`,
                    }}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-xs mt-1 ml-1">{errors.password}</p>}
              </div>

              {/* Confirmer MDP */}
              {mode === 'register' && (
                <div>
                  <label className="block text-white/70 text-xs font-semibold mb-1.5 ml-1">Confirmer le mot de passe *</label>
                  <div className="relative">
                    <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40" />
                    <input
                      type={showPw2 ? 'text' : 'password'}
                      placeholder="Répétez votre mot de passe"
                      autoComplete="new-password"
                      {...field('confirmPassword')}
                      className="w-full pl-11 pr-12 py-3.5 rounded-2xl text-white placeholder-white/30 text-sm outline-none transition-all"
                      style={{
                        background: errors.confirmPassword ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)',
                        border: `1px solid ${errors.confirmPassword ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'}`,
                      }}
                    />
                    <button type="button" onClick={() => setShowPw2(!showPw2)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      {showPw2 ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-red-400 text-xs mt-1 ml-1">{errors.confirmPassword}</p>}
                </div>
              )}

              {/* Submit */}
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm text-white transition-all active:scale-98 disabled:opacity-60 mt-1"
                style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Chargement...</>
                  : <>{mode === 'login' ? '🔑 Se connecter' : '🚀 Créer mon compte'}<ArrowRight size={14} /></>
                }
              </button>
            </form>

            {mode === 'register' && (
              <div className="flex items-start gap-2.5 p-3 rounded-2xl mt-3"
                style={{ background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)' }}>
                <CheckCircle2 size={14} className="text-orange-400 mt-0.5 shrink-0" />
                <p className="text-white/50 text-xs leading-relaxed">
                  Compte créé avec le rôle <span className="text-orange-400 font-bold">Client</span>. Pour livrer avec NYME,{' '}
                  <Link href="/coursier/login" className="underline hover:text-orange-400 transition-colors">inscrivez-vous comme coursier</Link>.
                </p>
              </div>
            )}
          </div>

          {/* Liens */}
          <div className="mt-6 text-center space-y-3">
            <div className="flex justify-center gap-6 text-xs text-white/30">
              <Link href="/partenaires/login" className="hover:text-white/60 transition-colors">🏢 Partenaire</Link>
              <Link href="/coursier/login" className="hover:text-white/60 transition-colors">🛵 Coursier</Link>
            </div>
            <p className="text-white/15 text-xs">© 2025 NYME · Ouagadougou, Burkina Faso</p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
        <div className="w-10 h-10 border-3 border-white/20 border-t-orange-400 rounded-full animate-spin" style={{ borderWidth: 3 }} />
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  )
}
