'use client'
// src/app/reset-password/page.tsx
// ══════════════════════════════════════════════════════════════════
// DEMANDE RÉINITIALISATION MOT DE PASSE — NYME
// ══════════════════════════════════════════════════════════════════

import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Loader2, Zap, ArrowLeft, Mail } from 'lucide-react'
import toast, { Toaster } from 'react-hot-toast'

export default function ResetPasswordPage() {
  const [email,   setEmail]   = useState('')
  const [loading, setLoading] = useState(false)
  const [sent,    setSent]    = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)
    try {
      const siteUrl  = process.env.NEXT_PUBLIC_SITE_URL || window.location.origin
      const { error } = await supabase.auth.resetPasswordForEmail(
        email.trim().toLowerCase(),
        { redirectTo: `${siteUrl}/update-password` }
      )

      if (error) throw error

      setSent(true)
      toast.success('Email de réinitialisation envoyé !')

    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erreur lors de l\'envoi')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A2E8A] to-[#071e6b] flex items-center justify-center p-4">
      <Toaster position="top-center"/>

      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-[#E87722] to-[#F59343] rounded-2xl mb-4">
            <Zap size={28} className="text-white" strokeWidth={2.5}/>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight">NYME</h1>
          <p className="text-white/60 text-sm mt-1">Réinitialiser votre mot de passe</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {sent ? (
            <div className="text-center py-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail size={32} className="text-green-600"/>
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Email envoyé !</h2>
              <p className="text-slate-500 text-sm mb-6">
                Un lien de réinitialisation a été envoyé à <strong>{email}</strong>.<br/>
                Vérifiez votre boîte mail (et les spams).
              </p>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#0A2E8A] text-white font-bold rounded-xl hover:bg-[#0d38a5] transition-all text-sm">
                <ArrowLeft size={16}/> Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-xl font-bold text-slate-800 mb-1">Mot de passe oublié ?</h2>
                <p className="text-slate-500 text-sm">
                  Entrez votre adresse email pour recevoir un lien de réinitialisation.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wide block mb-1.5">
                    Adresse email *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="vous@example.com"
                    className="w-full px-4 py-3 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-[#0A2E8A] focus:ring-2 focus:ring-[#0A2E8A]/10 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-gradient-to-r from-[#0A2E8A] to-[#1A4FBF] text-white font-bold rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-60">
                  {loading ? <Loader2 size={18} className="animate-spin"/> : <Mail size={18}/>}
                  {loading ? 'Envoi en cours...' : 'Envoyer le lien'}
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-[#0A2E8A] font-bold text-sm hover:underline">
                  <ArrowLeft size={14}/> Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}