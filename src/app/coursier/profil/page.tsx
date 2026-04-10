// src/app/coursier/profil/page.tsx — NOUVEAU FICHIER
// Page profil coursier dédiée (infos personnelles + stats + véhicule)
// Route : /coursier/profil
'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { Utilisateur, Coursier, Vehicule } from '@/lib/supabase'
import {
  ArrowLeft, Camera, Save, Eye, EyeOff, Shield, User,
  Phone, Mail, MessageSquare, Star, Package, TrendingUp, Truck,
} from 'lucide-react'
import toast from 'react-hot-toast'
import Link from 'next/link'

export default function CoursierProfilPage() {
  const router  = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)

  const [user,     setUser]     = useState<Utilisateur | null>(null)
  const [coursier, setCoursier] = useState<Coursier | null>(null)
  const [vehicule, setVehicule] = useState<Vehicule | null>(null)
  const [loading,  setLoading]  = useState(true)
  const [tab,      setTab]      = useState<'infos' | 'securite' | 'stats'>('infos')

  const [form, setForm] = useState({ nom: '', telephone: '', whatsapp: '' })
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  const [pwForm, setPwForm] = useState({ actuel: '', nouveau: '', confirmer: '' })
  const [showPw, setShowPw] = useState(false)
  const [savingPw, setSavingPw] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/coursier/login'); return }
      const { data: u } = await supabase.from('utilisateurs').select('*').eq('id', session.user.id).single()
      if (!u || u.role !== 'coursier') { router.replace('/coursier/login'); return }
      setUser(u as Utilisateur)
      setForm({ nom: u.nom || '', telephone: u.telephone || '', whatsapp: u.whatsapp || '' })

      const { data: c } = await supabase.from('coursiers').select('*').eq('id', session.user.id).single()
      if (c) setCoursier(c as Coursier)

      const { data: v } = await supabase.from('vehicules').select('*').eq('coursier_id', session.user.id).single()
      if (v) setVehicule(v as Vehicule)

      setLoading(false)
    }
    init()
  }, [router])

  const handleSaveInfos = async () => {
    if (!user || !form.nom.trim()) { toast.error('Nom requis'); return }
    setSaving(true)
    try {
      const { error } = await supabase.from('utilisateurs').update({
        nom:       form.nom.trim(),
        telephone: form.telephone.trim() || null,
        whatsapp:  form.whatsapp.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', user.id)
      if (error) throw error
      setUser(prev => prev ? { ...prev, nom: form.nom.trim() } : prev)
      toast.success('Profil mis à jour ✅')
    } catch { toast.error('Erreur lors de la mise à jour') }
    finally { setSaving(false) }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return
    if (file.size > 5 * 1024 * 1024) { toast.error('Max 5 Mo'); return }
    setUploadingPhoto(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `avatars/${user.id}/avatar.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('utilisateurs').update({ avatar_url: publicUrl }).eq('id', user.id)
      setUser(prev => prev ? { ...prev, avatar_url: publicUrl } : prev)
      toast.success('Photo mise à jour ✅')
    } catch { toast.error('Erreur upload photo') }
    finally { setUploadingPhoto(false) }
  }

  const handleChangePassword = async () => {
    if (!pwForm.actuel)               { toast.error('Mot de passe actuel requis'); return }
    if (pwForm.nouveau.length < 6)    { toast.error('Minimum 6 caractères'); return }
    if (pwForm.nouveau !== pwForm.confirmer) { toast.error('Mots de passe différents'); return }
    setSavingPw(true)
    try {
      const { error: loginErr } = await supabase.auth.signInWithPassword({ email: user!.email!, password: pwForm.actuel })
      if (loginErr) throw new Error('Mot de passe actuel incorrect')
      const { error } = await supabase.auth.updateUser({ password: pwForm.nouveau })
      if (error) throw error
      toast.success('Mot de passe modifié ✅')
      setPwForm({ actuel: '', nouveau: '', confirmer: '' })
    } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erreur') }
    finally { setSavingPw(false) }
  }

  const VERIFICATION_BADGE: Record<string, { label: string; color: string; bg: string }> = {
    en_attente: { label: '⏳ En attente',    color: '#92400e', bg: '#fffbeb' },
    verifie:    { label: '✅ Vérifié',       color: '#166534', bg: '#f0fdf4' },
    rejete:     { label: '❌ Rejeté',        color: '#991b1b', bg: '#fef2f2' },
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0f172a' }}>
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const vbadge = VERIFICATION_BADGE[coursier?.statut_verification || 'en_attente']

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 flex items-center gap-3 h-14">
          <button onClick={() => router.back()}
            className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center">
            <ArrowLeft size={16} className="text-gray-700" />
          </button>
          <h1 className="font-black text-gray-900 flex-1">Mon profil coursier</h1>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 pb-10 space-y-4">

        {/* Avatar + nom */}
        <div className="bg-white rounded-3xl p-6 border border-gray-100 flex flex-col items-center">
          <div className="relative mb-3">
            {user?.avatar_url
              ? <img src={user.avatar_url} alt={user?.nom} className="w-24 h-24 rounded-full object-cover border-4 border-white shadow-lg" />
              : <div className="w-24 h-24 rounded-full flex items-center justify-center text-white font-black text-4xl shadow-lg"
                  style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}>
                  {user?.nom?.charAt(0).toUpperCase()}
                </div>
            }
            <button onClick={() => fileRef.current?.click()} disabled={uploadingPhoto}
              className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full flex items-center justify-center text-white shadow-lg"
              style={{ background: '#f97316' }}>
              {uploadingPhoto ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Camera size={14} />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>
          <p className="font-black text-gray-900 text-xl">{user?.nom}</p>
          <p className="text-gray-400 text-sm">{user?.email}</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1.5 bg-yellow-50 px-3 py-1.5 rounded-full border border-yellow-200">
              <Star size={13} className="text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-bold text-yellow-700">{user?.note_moyenne?.toFixed(1) || '5.0'} / 5</span>
            </div>
            <span className="text-xs font-bold px-3 py-1.5 rounded-full" style={{ background: vbadge.bg, color: vbadge.color }}>
              {vbadge.label}
            </span>
          </div>
          {coursier?.statut_verification !== 'verifie' && (
            <Link href="/coursier/verification"
              className="mt-3 px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-bold">
              📄 Soumettre mes documents
            </Link>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 bg-white rounded-2xl p-1.5 border border-gray-100">
          {([
            { k: 'infos' as const,    label: '👤 Infos'       },
            { k: 'securite' as const, label: '🔒 Sécurité'    },
            { k: 'stats' as const,    label: '📊 Stats'        },
          ]).map(t => (
            <button key={t.k} onClick={() => setTab(t.k)}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${tab === t.k ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              style={tab === t.k ? { background: '#f97316' } : {}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Onglet Infos */}
        {tab === 'infos' && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 space-y-4">
            {[
              { key: 'nom' as const,       label: 'Nom complet *',   icon: User,          type: 'text', placeholder: 'Votre nom' },
              { key: 'telephone' as const, label: 'Téléphone',        icon: Phone,         type: 'tel',  placeholder: '+226 70 00 00 00' },
              { key: 'whatsapp' as const,  label: 'WhatsApp',         icon: MessageSquare, type: 'tel',  placeholder: '+226 70 00 00 00' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">{f.label}</label>
                <div className="relative">
                  <f.icon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={f.type} value={form[f.key]} placeholder={f.placeholder}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 text-gray-900 text-sm outline-none focus:border-orange-400 transition-colors" />
                </div>
              </div>
            ))}
            <div>
              <label className="block text-xs font-bold text-gray-500 mb-1.5">Email (non modifiable)</label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300" />
                <input value={user?.email || ''} disabled type="email"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-100 bg-gray-50 text-gray-400 text-sm outline-none cursor-not-allowed" />
              </div>
            </div>

            {/* Infos véhicule si disponible */}
            {vehicule && (
              <div className="bg-orange-50 rounded-2xl p-4 border border-orange-100">
                <p className="text-xs font-bold text-orange-700 mb-2 flex items-center gap-1.5"><Truck size={13} />Votre véhicule</p>
                <div className="text-xs text-orange-900 space-y-1">
                  <p><span className="font-semibold">Type :</span> {vehicule.type}</p>
                  <p><span className="font-semibold">Marque/Modèle :</span> {vehicule.marque} {vehicule.modele}</p>
                  <p><span className="font-semibold">Couleur :</span> {vehicule.couleur}</p>
                  <p><span className="font-semibold">Plaque :</span> {vehicule.plaque}</p>
                </div>
              </div>
            )}

            <button onClick={handleSaveInfos} disabled={saving}
              className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: '#f97316' }}>
              {saving ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save size={14} />}
              {saving ? 'Sauvegarde...' : 'Enregistrer les modifications'}
            </button>
          </div>
        )}

        {/* Onglet Sécurité */}
        {tab === 'securite' && (
          <div className="bg-white rounded-2xl p-5 border border-gray-100 space-y-4">
            <div className="bg-orange-50 rounded-2xl p-3.5 flex items-center gap-2">
              <Shield size={14} className="text-orange-600" />
              <p className="text-orange-800 text-xs font-semibold">Modification du mot de passe</p>
            </div>
            {[
              { key: 'actuel' as const,   label: 'Mot de passe actuel',  auto: 'current-password' },
              { key: 'nouveau' as const,  label: 'Nouveau mot de passe', auto: 'new-password' },
              { key: 'confirmer' as const, label: 'Confirmer',           auto: 'new-password' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-bold text-gray-500 mb-1.5">{f.label}</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={pwForm[f.key]}
                    autoComplete={f.auto}
                    onChange={e => setPwForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-full pl-4 pr-11 py-3 rounded-2xl border border-gray-200 text-gray-900 text-sm outline-none focus:border-orange-400"
                    placeholder="••••••••" />
                  {f.key === 'actuel' && (
                    <button type="button" onClick={() => setShowPw(!showPw)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                      {showPw ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
            <button onClick={handleChangePassword} disabled={savingPw}
              className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: '#f97316' }}>
              {savingPw ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Shield size={14} />}
              {savingPw ? 'Modification...' : 'Modifier le mot de passe'}
            </button>
          </div>
        )}

        {/* Onglet Stats */}
        {tab === 'stats' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Courses total',  val: coursier?.total_courses || 0,     emoji: '🛵', color: '#f97316', bg: '#fff7ed' },
                { label: 'Gains totaux',   val: `${(coursier?.total_gains || 0).toLocaleString('fr-FR')} XOF`, emoji: '💰', color: '#22c55e', bg: '#f0fdf4' },
                { label: 'Ma note',        val: `${user?.note_moyenne?.toFixed(1) || '5.0'} ⭐`,               emoji: '⭐', color: '#eab308', bg: '#fefce8' },
                { label: 'Statut',         val: coursier?.statut === 'disponible' ? '🟢 Disponible' : coursier?.statut === 'occupe' ? '🔴 Occupé' : '⚫ Hors ligne', emoji: '📡', color: '#6366f1', bg: '#eef2ff' },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl p-4 border border-gray-100 text-center">
                  <span className="text-2xl block mb-1">{s.emoji}</span>
                  <p className="font-black text-sm" style={{ color: s.color }}>{s.val}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100">
              <p className="text-xs text-gray-400">Membre depuis</p>
              <p className="font-bold text-gray-900 mt-0.5">
                {user?.created_at ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(user.created_at)) : '—'}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}