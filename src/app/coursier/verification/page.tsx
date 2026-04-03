// src/app/coursier/verification/page.tsx
// Upload documents CNI, permis, carte grise vers Supabase Storage
// Vérification rôle côté page (pas middleware)
'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Upload, CheckCircle, Clock, XCircle, FileText, Camera, ArrowLeft, ShieldCheck, AlertCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface DocStatus {
  cni_recto: 'none' | 'uploading' | 'uploaded' | 'approved' | 'rejected'
  cni_verso: 'none' | 'uploading' | 'uploaded' | 'approved' | 'rejected'
  permis: 'none' | 'uploading' | 'uploaded' | 'approved' | 'rejected'
  carte_grise: 'none' | 'uploading' | 'uploaded' | 'approved' | 'rejected'
}

interface DocUrls {
  cni_recto?: string
  cni_verso?: string
  permis?: string
  carte_grise?: string
}

const DOC_CONFIG: Array<{
  key: keyof DocStatus
  label: string
  description: string
  required: boolean
  icon: React.ElementType
}> = [
  { key: 'cni_recto', label: 'CNI Recto', description: 'Photo recto de votre Carte Nationale d\'Identité', required: true, icon: FileText },
  { key: 'cni_verso', label: 'CNI Verso', description: 'Photo verso de votre CNI', required: true, icon: FileText },
  { key: 'permis', label: 'Permis de conduire', description: 'Photo de votre permis de conduire', required: true, icon: FileText },
  { key: 'carte_grise', label: 'Carte grise véhicule', description: 'Document d\'immatriculation de votre véhicule', required: false, icon: FileText },
]

function StatusBadge({ status }: { status: string }) {
  const cfg = {
    none:      { label: 'Non soumis', color: 'text-white/40',  bg: 'bg-white/8', icon: null },
    uploading: { label: 'Envoi...',   color: 'text-nyme-orange', bg: 'bg-nyme-orange/15', icon: null },
    uploaded:  { label: 'En attente de validation', color: 'text-nyme-amber', bg: 'bg-nyme-amber/15', icon: Clock },
    approved:  { label: 'Approuvé ✓', color: 'text-nyme-green', bg: 'bg-nyme-green/15', icon: CheckCircle },
    rejected:  { label: 'Rejeté', color: 'text-red-400', bg: 'bg-red-400/15', icon: XCircle },
  }[status] || { label: status, color: 'text-white/40', bg: 'bg-white/8', icon: null }

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color}`}>
      {status === 'uploading' && <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />}
      {cfg.icon && <cfg.icon size={10} />}
      {cfg.label}
    </span>
  )
}

export default function VerificationPage() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [coursierData, setCoursierData] = useState<any>(null)
  const [docStatus, setDocStatus] = useState<DocStatus>({ cni_recto: 'none', cni_verso: 'none', permis: 'none', carte_grise: 'none' })
  const [docUrls, setDocUrls] = useState<DocUrls>({})
  const [loading, setLoading] = useState(true)
  const [vehiculeForm, setVehiculeForm] = useState({ type: 'moto', marque: '', modele: '', couleur: '', plaque: '' })
  const [savingVehicule, setSavingVehicule] = useState(false)
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({})

  // ── Auth + vérification rôle ───────────────────────────────────

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/coursier/login'); return }

      const { data: user } = await supabase.from('utilisateurs').select('role').eq('id', session.user.id).single()
      if (!user || user.role !== 'coursier') { router.replace('/login'); return }

      setUserId(session.user.id)

      // Charger statut coursier
      const { data: coursier } = await supabase.from('coursiers').select('*').eq('id', session.user.id).single()
      setCoursierData(coursier)

      // Charger documents existants
      const { data: docs } = await supabase
        .from('courier_documents')
        .select('document_type, file_url, status')
        .eq('coursier_id', session.user.id)

      if (docs && docs.length > 0) {
        const statusMap = { ...docStatus }
        const urlMap: DocUrls = {}
        docs.forEach((d: any) => {
          const key = d.document_type as keyof DocStatus
          if (key in statusMap) {
            statusMap[key] = d.status === 'approved' ? 'approved' : d.status === 'rejected' ? 'rejected' : 'uploaded'
            urlMap[key] = d.file_url
          }
        })
        setDocStatus(statusMap)
        setDocUrls(urlMap)
      }

      setLoading(false)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Upload document ────────────────────────────────────────────

  const handleFileSelect = async (docType: keyof DocStatus, file: File) => {
    if (!userId) return
    if (file.size > 10 * 1024 * 1024) { toast.error('Fichier trop grand (max 10MB)'); return }
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      toast.error('Format non supporté (JPG, PNG, PDF uniquement)')
      return
    }

    setDocStatus(p => ({ ...p, [docType]: 'uploading' }))

    try {
      const ext = file.name.split('.').pop()
      const path = `coursiers/${userId}/${docType}_${Date.now()}.${ext}`

      // Upload vers Supabase Storage (bucket 'documents')
      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(path, file, { upsert: true })

      if (uploadErr) throw new Error('Erreur upload : ' + uploadErr.message)

      const { data: { publicUrl } } = supabase.storage.from('documents').getPublicUrl(path)

      // Upsert dans courier_documents
      const { error: dbErr } = await supabase
        .from('courier_documents')
        .upsert({
          coursier_id: userId,
          document_type: docType,
          file_url: publicUrl,
          status: 'pending',
          uploaded_at: new Date().toISOString(),
        }, { onConflict: 'coursier_id,document_type' })

      if (dbErr) throw new Error('Erreur enregistrement : ' + dbErr.message)

      setDocStatus(p => ({ ...p, [docType]: 'uploaded' }))
      setDocUrls(p => ({ ...p, [docType]: publicUrl }))
      toast.success(`${DOC_CONFIG.find(d => d.key === docType)?.label} soumis !`)
    } catch (err: any) {
      toast.error(err.message || 'Erreur upload')
      setDocStatus(p => ({ ...p, [docType]: 'none' }))
    }
  }

  // ── Sauvegarder véhicule ───────────────────────────────────────

  const handleSaveVehicule = async () => {
    if (!userId) return
    if (!vehiculeForm.marque || !vehiculeForm.modele || !vehiculeForm.plaque) {
      toast.error('Remplissez marque, modèle et plaque')
      return
    }
    setSavingVehicule(true)
    try {
      const { error } = await supabase.from('vehicules').upsert({
        coursier_id: userId,
        type: vehiculeForm.type,
        marque: vehiculeForm.marque,
        modele: vehiculeForm.modele,
        couleur: vehiculeForm.couleur,
        plaque: vehiculeForm.plaque.toUpperCase(),
        est_verifie: false,
      }, { onConflict: 'plaque' })
      if (error) throw error
      toast.success('Véhicule enregistré !')
    } catch (err: any) {
      toast.error(err.message || 'Erreur')
    } finally { setSavingVehicule(false) }
  }

  // ── Stats vérification ─────────────────────────────────────────

  const docsRequis = DOC_CONFIG.filter(d => d.required)
  const docsSubmis = docsRequis.filter(d => ['uploaded', 'approved'].includes(docStatus[d.key]))
  const docsApprouves = docsRequis.filter(d => docStatus[d.key] === 'approved')
  const progression = Math.round(docsSubmis.length / docsRequis.length * 100)
  const isVerifie = coursierData?.statut_verification === 'verifie'

  if (loading) return (
    <div className="min-h-screen bg-nyme-dark flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-white/20 border-t-nyme-orange rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <button onClick={() => router.back()} className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <ArrowLeft size={16} className="text-gray-700" />
          </button>
          <div>
            <h1 className="font-heading font-bold text-gray-900">Vérification d'identité</h1>
            <p className="text-gray-500 text-xs">Soumettre vos documents</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-6">

        {/* Statut global */}
        {isVerifie ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
              <ShieldCheck size={24} className="text-white" />
            </div>
            <div>
              <p className="font-black text-green-800 text-lg">Compte vérifié ✓</p>
              <p className="text-green-600 text-sm">Vous pouvez accepter des courses</p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-gray-900">Progression</h2>
              <span className="text-sm font-bold text-blue-600">{docsApprouves.length}/{docsRequis.length} approuvés</span>
            </div>
            <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all duration-700 ${progression >= 100 ? 'bg-green-500' : 'bg-gradient-to-r from-blue-500 to-orange-500'}`}
                style={{ width: `${progression}%` }} />
            </div>
            <p className="text-gray-500 text-xs">
              {progression < 100
                ? `Soumettez tous les documents obligatoires pour validation`
                : `Documents soumis — validation en cours (24-48h)`}
            </p>
          </div>
        )}

        {/* Alerte en attente */}
        {!isVerifie && coursierData?.statut_verification === 'en_attente' && docsSubmis.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3">
            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">Vérification en cours</p>
              <p className="text-amber-600 text-xs mt-0.5">L'équipe NYME examine vos documents. Délai : 24-48h.</p>
            </div>
          </div>
        )}

        {/* Documents */}
        <div className="space-y-3">
          <h2 className="font-bold text-gray-900 text-lg">Documents requis</h2>
          {DOC_CONFIG.map(doc => (
            <div key={doc.key} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${docStatus[doc.key] === 'approved' ? 'bg-green-100' : docStatus[doc.key] === 'rejected' ? 'bg-red-100' : docStatus[doc.key] === 'uploaded' ? 'bg-amber-100' : 'bg-gray-100'}`}>
                    {docStatus[doc.key] === 'approved'
                      ? <CheckCircle size={18} className="text-green-600" />
                      : docStatus[doc.key] === 'rejected'
                      ? <XCircle size={18} className="text-red-500" />
                      : docStatus[doc.key] === 'uploaded'
                      ? <Clock size={18} className="text-amber-600" />
                      : <doc.icon size={18} className="text-gray-400" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-gray-900 text-sm">{doc.label}</p>
                      {doc.required && <span className="text-red-500 text-xs">*obligatoire</span>}
                    </div>
                    <p className="text-gray-400 text-xs mt-0.5">{doc.description}</p>
                  </div>
                </div>
                <StatusBadge status={docStatus[doc.key]} />
              </div>

              {/* Aperçu si uploadé */}
              {docUrls[doc.key] && docStatus[doc.key] !== 'none' && (
                <div className="mt-3 flex items-center gap-2">
                  <a href={docUrls[doc.key]} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                    <FileText size={11} />Voir le document
                  </a>
                </div>
              )}

              {/* Bouton upload */}
              {docStatus[doc.key] !== 'approved' && (
                <div className="mt-3">
                  <input
                    ref={el => { fileInputs.current[doc.key] = el }}
                    type="file" accept="image/*,application/pdf" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelect(doc.key, f) }}
                  />
                  <button
                    onClick={() => fileInputs.current[doc.key]?.click()}
                    disabled={docStatus[doc.key] === 'uploading'}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${docStatus[doc.key] === 'uploading' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : docStatus[doc.key] === 'uploaded' ? 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100' : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'}`}>
                    {docStatus[doc.key] === 'uploading'
                      ? <><div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />Envoi...</>
                      : docStatus[doc.key] === 'uploaded'
                      ? <><Camera size={14} />Remplacer</>
                      : <><Upload size={14} />Uploader</>
                    }
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Formulaire véhicule */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 space-y-4">
          <h3 className="font-bold text-gray-900">Mon véhicule</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Type *</label>
              <select value={vehiculeForm.type} onChange={e => setVehiculeForm(p => ({ ...p, type: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400">
                <option value="moto">🛵 Moto</option>
                <option value="velo">🚲 Vélo</option>
                <option value="voiture">🚗 Voiture</option>
                <option value="camionnette">🚐 Camionnette</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Marque *</label>
              <input type="text" placeholder="Honda, Yamaha..." value={vehiculeForm.marque}
                onChange={e => setVehiculeForm(p => ({ ...p, marque: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Modèle *</label>
              <input type="text" placeholder="CB125, CG..." value={vehiculeForm.modele}
                onChange={e => setVehiculeForm(p => ({ ...p, modele: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Couleur</label>
              <input type="text" placeholder="Rouge, Noir..." value={vehiculeForm.couleur}
                onChange={e => setVehiculeForm(p => ({ ...p, couleur: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1">Plaque d'immatriculation *</label>
              <input type="text" placeholder="BF-XXXX-XX" value={vehiculeForm.plaque}
                onChange={e => setVehiculeForm(p => ({ ...p, plaque: e.target.value.toUpperCase() }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-blue-400 uppercase" />
            </div>
          </div>
          <button onClick={handleSaveVehicule} disabled={savingVehicule}
            className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-50 transition-colors">
            {savingVehicule ? 'Enregistrement...' : '💾 Sauvegarder le véhicule'}
          </button>
        </div>

        {/* Info bucket storage */}
        <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200">
          <p className="text-blue-700 text-xs font-semibold mb-1">ℹ️ Formats acceptés</p>
          <p className="text-blue-600 text-xs">JPG, PNG, WebP, PDF — Maximum 10MB par fichier</p>
          <p className="text-blue-600 text-xs mt-1">Assurez-vous que les documents sont lisibles et non expirés</p>
        </div>
      </main>
    </div>
  )
}
