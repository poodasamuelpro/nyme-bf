// src/app/coursier/login/page.tsx — Login/Register COURSIER NYME
// ✅ Vérification rôle STRICTE : seuls les comptes coursier peuvent se connecter ici
// ✅ Responsive mobile-first / pas de header footer sur mobile
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Mail, Lock, User, Phone, ArrowRight, ShieldCheck, Bike, Zap } from 'lucide-react'
import toast from 'react-hot-toast'

type Mode = 'login' | 'register'

function CoursierLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [form, setForm] = useState({ nom: '', email: '', telephone: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (searchParams.get('mode') === 'register') setMode('register')
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) await checkAndRedirect(session.user.id)
      setCheckingSession(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── VÉRIFICATION RÔLE STRICTE ────────────────────────────────────────
  const checkAndRedirect = async (userId: string) => {
    const { data: u } = await supabase.from('utilisateurs').select('role, est_actif').eq('id', userId).single()
    if (!u) { await supabase.auth.signOut(); return }
    // Seuls les coursiers → dashboard coursier
    if (u.role === 'coursier') { router.replace('/coursier/dashboard-new'); return }
    // Admin → son espace
    if (u.role === 'admin') { router.replace('/admin-x9k2m/dashboard'); return }
    // Autres rôles (client, partenaire) → déconnexion + message
    await supabase.auth.signOut()
    const msgs: Record<string, string> = {
      client:     'Ce compte client doit se connecter via l\'espace client 📦',
      partenaire: 'Ce compte partenaire doit se connecter via l\'espace partenaire 🏢',
    }
    toast.error(msgs[u.role] || 'Accès non autorisé sur l\'espace coursier.')
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

  // ── CONNEXION — seuls les coursiers autorisés ────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: form.email.trim().toLowerCase(),
        password: form.password,
      })
      if (error) throw new Error(error.message.includes('Invalid login credentials') ? 'Email ou mot de passe incorrect' : error.message)
      if (!data.user) throw new Error('Connexion échouée')

      // Vérification rôle DANS LA DB — jamais dans les metadata
      const { data: u } = await supabase.from('utilisateurs').select('role, est_actif').eq('id', data.user.id).single()

      if (!u) {
        await supabase.auth.signOut()
        throw new Error('Compte introuvable dans la base de données.')
      }
      if (!u.est_actif) {
        await supabase.auth.signOut()
        throw new Error('Votre compte est désactivé. Contactez le support NYME.')
      }
      if (u.role !== 'coursier') {
        await supabase.auth.signOut()
        const msgs: Record<string, string> = {
          client:     'Ce compte est un compte client → connectez-vous sur l\'espace client 📦',
          admin:      'Espace administrateur uniquement.',
          partenaire: 'Ce compte partenaire → connectez-vous sur l\'espace partenaire 🏢',
        }
        throw new Error(msgs[u.role] || 'Ce compte n\'est pas un compte coursier.')
      }

      toast.success('Connexion réussie ! En selle 🛵')
      router.replace('/coursier/dashboard-new')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur de connexion')
    } finally {
      setLoading(false)
    }
  }

  // ── INSCRIPTION — rôle coursier FORCÉ ───────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim().toLowerCase(),
        password: form.password,
        options: {
          data: { nom: form.nom.trim(), telephone: form.telephone.trim(), role: 'coursier' },
        },
      })
      if (error) throw new Error(error.message.includes('already registered') ? 'Cet email est déjà utilisé' : error.message)
      if (!data.user) throw new Error('Erreur lors de la création du compte')

      // Upsert utilisateurs — rôle coursier GARANTI
      await supabase.from('utilisateurs').upsert({
        id: data.user.id,
        nom: form.nom.trim(),
        telephone: form.telephone.trim(),
        email: form.email.trim().toLowerCase(),
        role: 'coursier', // FORCÉ
        est_verifie: false,
        est_actif: true,
        note_moyenne: 5,
      }, { onConflict: 'id' })

      // Profil coursier
      await supabase.from('coursiers').upsert({
        id: data.user.id,
        statut: 'hors_ligne',
        statut_verification: 'en_attente',
        status_validation_documents: 'pending',
        total_courses: 0,
        total_gains: 0,
        commission_due: 0,
      }, { onConflict: 'id' })

      // Wallet
      await supabase.from('wallets').upsert(
        { user_id: data.user.id, solde: 0, total_gains: 0, total_retraits: 0 },
        { onConflict: 'user_id' }
      )

      if (data.session) {
        toast.success('Compte coursier créé ! Soumettez vos documents 📋')
        router.replace('/coursier/dashboard-new')
      } else {
        toast('Vérifiez votre email pour confirmer votre inscription', { icon: '📧', duration: 5000 })
        setMode('login')
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
          redirectTo: `${window.location.origin}/auth/callback?role=coursier`,
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

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="text-4xl">🛵</div>
          <div className="w-7 h-7 border-2 border-white/20 border-t-green-400 rounded-full animate-spin" />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0f172a' }}>
      {/* Décors */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none select-none">
        <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full opacity-[0.07] blur-3xl" style={{ background: '#22c55e' }} />
        <div className="absolute -bottom-20 -left-20 w-80 h-80 rounded-full opacity-[0.07] blur-3xl" style={{ background: '#1a56db' }} />
      </div>

      {/* Header desktop uniquement */}
      <header className="hidden sm:flex relative z-10 px-6 pt-7 pb-2 items-center justify-between max-w-md mx-auto w-full">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
            <Zap size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="font-black text-white text-lg tracking-widest">NYME</span>
        </Link>
        <Link href="/login" className="text-white/40 text-xs hover:text-white/70 transition-colors flex items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-white/8">
          Espace client <ArrowRight size={11} />
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-6 relative z-10 min-h-screen sm:min-h-0">
        <div className="w-full max-w-md">

          {/* Logo mobile */}
          <div className="sm:hidden flex justify-center mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>
                <Zap size={20} className="text-white" strokeWidth={2.5} />
              </div>
              <span className="font-black text-white text-xl tracking-widest">NYME</span>
            </div>
          </div>

          {/* Titre */}
          <div className="text-center mb-7">
            <div className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 mb-4"
              style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}>
              <Bike size={13} className="text-green-400" />
              <span className="text-green-400 text-[11px] font-bold uppercase tracking-widest">Espace Coursier</span>
            </div>
            <h1 className="text-3xl font-black text-white mb-2 leading-tight">
              {mode === 'login' ? 'Content de te revoir 🛵' : 'Devenir coursier NYME'}
            </h1>
            <p className="text-white/40 text-sm">
              {mode === 'login' ? 'Gère tes missions et tes gains en temps réel' : 'Génère des revenus · Travaille librement'}
            </p>
          </div>

          {/* Carte formulaire */}
          <div className="rounded-3xl p-6" style={{ background: 'rgba(255,255,255,0.055)', border: '1px solid rgba(255,255,255,0.09)', backdropFilter: 'blur(24px)' }}>

            {/* Tabs */}
            <div className="flex rounded-2xl p-1 mb-5" style={{ background: 'rgba(255,255,255,0.04)' }}>
              {(['login', 'register'] as Mode[]).map(m => (
                <button key={m} onClick={() => { setMode(m); setErrors({}) }}
                  className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                  style={mode === m ? { background: '#22c55e', color: '#fff', boxShadow: '0 4px 12px rgba(34,197,94,0.35)' } : { color: 'rgba(255,255,255,0.35)' }}>
                  {m === 'login' ? 'Se connecter' : "S'inscrire"}
                </button>
              ))}
            </div>

            {/* Google */}
            <button onClick={handleGoogle} disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white hover:bg-gray-50 text-gray-800 font-bold text-sm transition-all active:scale-[0.98] disabled:opacity-60 mb-4"
              style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.2)' }}>
              {googleLoading
                ? <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                : <svg width="17" height="17" viewBox="0 0 18 18">
                    <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                    <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                    <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"/>
                    <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
                  </svg>
              }
              {googleLoading ? 'Connexion...' : 'Continuer avec Google'}
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
              <span className="text-white/25 text-xs">ou par email</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.08)' }} />
            </div>

            <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-3">
              {mode === 'register' && (
                <>
                  <InputField icon={<User size={14} className="text-white/35" />} type="text" placeholder="Nom complet" autoComplete="name" label="Nom complet *" error={errors.nom} {...field('nom')} />
                  <InputField icon={<Phone size={14} className="text-white/35" />} type="tel" placeholder="+226 70 00 00 00" autoComplete="tel" label="Téléphone *" error={errors.telephone} {...field('telephone')} />
                </>
              )}

              <InputField icon={<Mail size={14} className="text-white/35" />} type="email" placeholder="votre@email.com" autoComplete="email" label="Adresse email *" error={errors.email} {...field('email')} />

              <div>
                <label className="block text-white/60 text-xs font-semibold mb-1.5 ml-1">Mot de passe *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2"><Lock size={14} className="text-white/35" /></span>
                  <input type={showPw ? 'text' : 'password'} placeholder="Minimum 6 caractères"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    {...field('password')}
                    className="w-full pl-11 pr-12 py-3.5 rounded-2xl text-white placeholder-white/25 text-sm outline-none transition-all"
                    style={{ background: errors.password ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.07)', border: `1px solid ${errors.password ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}` }}
                  />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                    {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-xs mt-1 ml-1">{errors.password}</p>}
              </div>

              {mode === 'register' && (
                <div>
                  <label className="block text-white/60 text-xs font-semibold mb-1.5 ml-1">Confirmer le mot de passe *</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2"><Lock size={14} className="text-white/35" /></span>
                    <input type={showPw2 ? 'text' : 'password'} placeholder="Répétez votre mot de passe"
                      autoComplete="new-password" {...field('confirmPassword')}
                      className="w-full pl-11 pr-12 py-3.5 rounded-2xl text-white placeholder-white/25 text-sm outline-none transition-all"
                      style={{ background: errors.confirmPassword ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.07)', border: `1px solid ${errors.confirmPassword ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}` }}
                    />
                    <button type="button" onClick={() => setShowPw2(!showPw2)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors">
                      {showPw2 ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-red-400 text-xs mt-1 ml-1">{errors.confirmPassword}</p>}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-black text-sm text-white transition-all active:scale-[0.98] disabled:opacity-60 mt-2"
                style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', boxShadow: loading ? 'none' : '0 6px 20px rgba(34,197,94,0.35)' }}>
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Chargement...</>
                  : <>{mode === 'login' ? '🛵 Se connecter' : '🚀 Créer mon compte coursier'}<ArrowRight size={14} /></>
                }
              </button>
            </form>

            {mode === 'register' && (
              <div className="mt-4 rounded-2xl p-4 space-y-2" style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.18)' }}>
                <p className="text-green-400 text-xs font-bold flex items-center gap-1.5">
                  <ShieldCheck size={13} />Après votre inscription :
                </p>
                <div className="space-y-1 text-white/40 text-xs">
                  <p>📋 Soumettez vos documents (CNI, permis, carte grise)</p>
                  <p>⏳ Validation par l'équipe NYME sous 24-48h</p>
                  <p>🎉 Commencez à générer des revenus !</p>
                </div>
              </div>
            )}
          </div>

          <div className="mt-5 text-center space-y-3">
            <div className="flex justify-center gap-6 text-xs text-white/25">
              <Link href="/login" className="hover:text-white/50 transition-colors">📦 Espace Client</Link>
              <Link href="/partenaires/login" className="hover:text-white/50 transition-colors">🏢 Espace Partenaire</Link>
            </div>
            <p className="text-white/10 text-[11px]">© 2025 NYME · Ouagadougou, Burkina Faso</p>
          </div>
        </div>
      </main>
    </div>
  )
}

function InputField({ icon, label, error, ...props }: {
  icon: React.ReactNode; label: string; error?: string;
  type: string; placeholder: string; autoComplete: string;
  value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div>
      <label className="block text-white/60 text-xs font-semibold mb-1.5 ml-1">{label}</label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2">{icon}</span>
        <input {...props} className="w-full pl-11 pr-4 py-3.5 rounded-2xl text-white placeholder-white/25 text-sm outline-none transition-all"
          style={{ background: error ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.07)', border: `1px solid ${error ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}` }} />
      </div>
      {error && <p className="text-red-400 text-xs mt-1 ml-1">{error}</p>}
    </div>
  )
}

export default function CoursierLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
        <div className="w-8 h-8 border-2 border-white/20 border-t-green-400 rounded-full animate-spin" />
      </div>
    }>
      <CoursierLoginContent />
    </Suspense>
  )
}
