// src/app/coursier/login/page.tsx — Page login/register COURSIER uniquement 
// Rôle coursier garanti via metadata Supabase Auth → trigger handle_new_user
'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Eye, EyeOff, Zap, Phone, Mail, Lock, User, ArrowRight, AlertCircle, Bike, ShieldCheck } from 'lucide-react'
import toast from 'react-hot-toast'

type Mode = 'login' | 'register'

function CoursierLoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [mode, setMode] = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw] = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [form, setForm] = useState({ nom: '', email: '', telephone: '', password: '', confirmPassword: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (searchParams.get('mode') === 'register') setMode('register')
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) checkAndRedirect(session.user.id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkAndRedirect = async (userId: string) => {
    const { data } = await supabase.from('utilisateurs').select('role').eq('id', userId).single()
    if (data?.role === 'coursier') router.replace('/coursier/dashboard-new')
    else if (data?.role === 'admin') router.replace('/admin-x9k2m/dashboard')
    else router.replace('/client/dashboard')
  }

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Email invalide'
    if (!form.password || form.password.length < 6) e.password = 'Minimum 6 caractères'
    if (mode === 'register') {
      if (!form.nom.trim()) e.nom = 'Nom requis'
      if (!form.telephone.trim()) e.telephone = 'Téléphone requis'
      if (form.password !== form.confirmPassword) e.confirmPassword = 'Mots de passe différents'
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
      if (error) throw new Error(error.message.includes('Invalid login credentials') ? 'Email ou mot de passe incorrect' : error.message)
      if (data.user) {
        const { data: u } = await supabase.from('utilisateurs').select('role').eq('id', data.user.id).single()
        if (u?.role !== 'coursier') {
          await supabase.auth.signOut()
          throw new Error('Ce compte n\'est pas un compte coursier')
        }
        toast.success('Connexion réussie !')
        router.replace('/coursier/dashboard-new')
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur de connexion')
    } finally { setLoading(false) }
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
            role: 'coursier', // FORCÉ coursier
          },
        },
      })
      if (error) throw new Error(error.message.includes('already registered') ? 'Email déjà utilisé' : error.message)
      if (data.user) {
        // Upsert manuel
        await supabase.from('utilisateurs').upsert({
          id: data.user.id,
          nom: form.nom.trim(),
          telephone: form.telephone.trim(),
          email: form.email.trim().toLowerCase(),
          role: 'coursier',
          est_verifie: false,
          est_actif: true,
        }, { onConflict: 'id' })

        // Créer profil coursier
        await supabase.from('coursiers').upsert({
          id: data.user.id,
          statut: 'hors_ligne',
          statut_verification: 'en_attente',
          total_courses: 0,
          total_gains: 0,
        }, { onConflict: 'id' })

        // Wallet
        await supabase.from('wallets').upsert({ user_id: data.user.id, solde: 0 }, { onConflict: 'user_id' })

        if (data.session) {
          toast.success('Compte coursier créé ! Complétez votre dossier de vérification.')
          router.replace('/coursier/dashboard-new')
        } else {
          toast('Vérifiez votre email', { icon: '📧' })
          setMode('login')
        }
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur inscription')
    } finally { setLoading(false) }
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
      toast.error('Erreur connexion Google')
      setGoogleLoading(false)
    }
  }

  const inp = (field: keyof typeof form) =>
    `w-full bg-white/8 border ${errors[field] ? 'border-red-400' : 'border-white/15'} rounded-2xl px-4 py-3.5 text-white placeholder-white/40 text-sm outline-none focus:border-nyme-orange/70 focus:bg-white/12 transition-all`

  return (
    <div className="min-h-screen bg-nyme-dark overflow-hidden flex flex-col">
      {/* Arrière-plan */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 right-1/3 w-96 h-96 bg-nyme-orange/12 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-nyme-green/10 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/3 right-0 w-72 h-72 bg-nyme-primary/15 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '4s' }} />
      </div>

      {/* Header */}
      <header className="relative z-10 px-6 pt-8 pb-4 flex items-center justify-between max-w-md mx-auto w-full">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-nyme-orange to-orange-400 flex items-center justify-center shadow-lg">
            <Zap size={18} className="text-white" strokeWidth={2.5} />
          </div>
          <span className="font-heading text-white font-extrabold text-xl tracking-wider">NYME</span>
        </Link>
        <Link href="/login" className="text-white/50 text-xs hover:text-white/80 transition-colors flex items-center gap-1">
          Espace client <ArrowRight size={12} />
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 bg-nyme-green/15 border border-nyme-green/30 rounded-full px-4 py-1.5 mb-4">
              <Bike size={14} className="text-nyme-green" />
              <span className="text-nyme-green text-xs font-semibold">Espace Coursier</span>
            </div>
            <h1 className="font-heading text-3xl font-black text-white mb-2">
              {mode === 'login' ? 'Content de te revoir 🛵' : 'Devenir coursier'}
            </h1>
            <p className="text-white/50 text-sm">
              {mode === 'login' ? 'Connecte-toi pour gérer tes courses' : 'Rejoins l\'équipe NYME et gagne ta vie'}
            </p>
          </div>

          {/* Tabs */}
          <div className="flex bg-white/6 rounded-2xl p-1 mb-6">
            {(['login', 'register'] as Mode[]).map(m => (
              <button key={m} onClick={() => { setMode(m); setErrors({}) }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${mode === m ? 'bg-nyme-green text-white shadow-lg' : 'text-white/50 hover:text-white/80'}`}>
                {m === 'login' ? 'Se connecter' : 'S\'inscrire'}
              </button>
            ))}
          </div>

          <div className="glass rounded-3xl p-6 space-y-4">
            {/* Google */}
            <button onClick={handleGoogle} disabled={googleLoading}
              className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl bg-white hover:bg-white/90 text-gray-800 font-semibold text-sm transition-all active:scale-98 disabled:opacity-60 shadow-lg">
              {googleLoading
                ? <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-700 rounded-full animate-spin" />
                : <svg width="18" height="18" viewBox="0 0 18 18"><path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/><path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/><path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18z"/><path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/></svg>
              }
              Continuer avec Google
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" /><span className="text-white/30 text-xs">ou</span><div className="flex-1 h-px bg-white/10" />
            </div>

            <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-3">
              {mode === 'register' && (
                <>
                  <div>
                    <div className="relative">
                      <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                      <input type="text" placeholder="Nom complet *" value={form.nom}
                        onChange={e => setForm(p => ({ ...p, nom: e.target.value }))}
                        className={`${inp('nom')} pl-11`} />
                    </div>
                    {errors.nom && <p className="text-red-400 text-xs mt-1 ml-1">{errors.nom}</p>}
                  </div>
                  <div>
                    <div className="relative">
                      <Phone size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                      <input type="tel" placeholder="Téléphone *" value={form.telephone}
                        onChange={e => setForm(p => ({ ...p, telephone: e.target.value }))}
                        className={`${inp('telephone')} pl-11`} />
                    </div>
                    {errors.telephone && <p className="text-red-400 text-xs mt-1 ml-1">{errors.telephone}</p>}
                  </div>
                </>
              )}
              <div>
                <div className="relative">
                  <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input type="email" placeholder="Email *" value={form.email} autoComplete="email"
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                    className={`${inp('email')} pl-11`} />
                </div>
                {errors.email && <p className="text-red-400 text-xs mt-1 ml-1">{errors.email}</p>}
              </div>
              <div>
                <div className="relative">
                  <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                  <input type={showPw ? 'text' : 'password'} placeholder="Mot de passe *" value={form.password}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                    className={`${inp('password')} pl-11 pr-11`} />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && <p className="text-red-400 text-xs mt-1 ml-1">{errors.password}</p>}
              </div>
              {mode === 'register' && (
                <div>
                  <div className="relative">
                    <Lock size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30" />
                    <input type={showPw2 ? 'text' : 'password'} placeholder="Confirmer le mot de passe *"
                      value={form.confirmPassword} autoComplete="new-password"
                      onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))}
                      className={`${inp('confirmPassword')} pl-11 pr-11`} />
                    <button type="button" onClick={() => setShowPw2(!showPw2)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                      {showPw2 ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {errors.confirmPassword && <p className="text-red-400 text-xs mt-1 ml-1">{errors.confirmPassword}</p>}
                </div>
              )}
              <button type="submit" disabled={loading}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-nyme-green hover:bg-green-400 text-white font-bold text-sm transition-all active:scale-98 disabled:opacity-60 mt-2 shadow-lg">
                {loading
                  ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Chargement...</>
                  : <>{mode === 'login' ? '🛵 Se connecter' : '🚀 Créer mon compte coursier'}<ArrowRight size={14} /></>
                }
              </button>
            </form>

            {mode === 'register' && (
              <div className="p-3 bg-nyme-green/10 rounded-xl border border-nyme-green/20 space-y-1">
                <p className="text-nyme-green text-xs font-semibold flex items-center gap-1"><ShieldCheck size={12} />Après inscription :</p>
                <p className="text-white/50 text-xs">• Soumettez vos documents (CNI, permis, carte grise)</p>
                <p className="text-white/50 text-xs">• Validation par l'équipe NYME sous 24-48h</p>
                <p className="text-white/50 text-xs">• Commencez à accepter des courses !</p>
              </div>
            )}
          </div>

          <div className="mt-6 text-center space-y-3">
            <div className="flex justify-center gap-6 text-xs text-white/30">
              <Link href="/login" className="hover:text-nyme-orange transition-colors">📦 Espace Client</Link>
              <Link href="/partenaires/login" className="hover:text-white/60 transition-colors">🏢 Espace Partenaire</Link>
            </div>
            <p className="text-white/20 text-xs">© 2024 NYME · Ouagadougou, Burkina Faso</p>
          </div>
        </div>
      </main>
    </div>
  )
}

export default function CoursierLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-nyme-dark flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-white/20 border-t-nyme-green rounded-full animate-spin" />
      </div>
    }>
      <CoursierLoginContent />
    </Suspense>
  )
}
