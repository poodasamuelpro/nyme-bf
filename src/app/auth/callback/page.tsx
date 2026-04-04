// src/app/auth/callback/page.tsx — Callback OAuth Google
'use client'
import { useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Zap } from 'lucide-react'

function CallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!session) { router.replace('/login'); return }

        const uid  = session.user.id
        const roleDemande = (searchParams.get('role') || 'client') as 'client' | 'coursier' | 'partenaire'

        // Vérifier si profil existe
        const { data: existing } = await supabase.from('utilisateurs').select('role, est_actif').eq('id', uid).single()

        if (!existing) {
          const nom = session.user.user_metadata?.full_name || session.user.user_metadata?.name || session.user.email?.split('@')[0] || 'Utilisateur'
          await supabase.from('utilisateurs').insert({
            id: uid, nom, email: session.user.email,
            role: roleDemande, est_verifie: false, est_actif: true,
          })
          await supabase.from('wallets').upsert({ user_id: uid, solde: 0 }, { onConflict: 'user_id' })
          if (roleDemande === 'coursier') {
            await supabase.from('coursiers').upsert({ id: uid, statut: 'hors_ligne', statut_verification: 'en_attente', total_courses: 0, total_gains: 0 }, { onConflict: 'id' })
          }
        }

        const role = existing?.role || roleDemande
        const routes: Record<string, string> = {
          client: '/client/dashboard', coursier: '/coursier/dashboard-new',
          admin: '/admin-x9k2m/dashboard', partenaire: '/partenaires/dashboard',
        }
        router.replace(routes[role] || '/client/dashboard')
      } catch (err) {
        console.error('[auth/callback]', err)
        router.replace('/login')
      }
    }
    handleCallback()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-nyme-dark flex items-center justify-center">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-nyme-orange to-orange-400 flex items-center justify-center mx-auto mb-4 animate-bounce">
          <Zap size={26} className="text-white" />
        </div>
        <p className="text-white/70 text-sm">Connexion en cours...</p>
      </div>
    </div>
  )
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-nyme-dark flex items-center justify-center"><div className="w-10 h-10 border-4 border-white/20 border-t-nyme-orange rounded-full animate-spin" /></div>}>
      <CallbackContent />
    </Suspense>
  )
}
 