// src/app/client/nouvelle-livraison/page.tsx — FICHIER MODIFIÉ
// MODIFICATION : ajout étape upload photos colis (jusqu'à 5 photos)
// Upload vers Supabase Storage bucket 'photos-colis'
// Les URLs sont stockées dans livraisons.photos_colis (text[])
'use client'
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { mapService } from '@/services/map-service'
import { priceNegotiationService } from '@/services/price-negotiation-service'
import { Camera, X, Image as ImageIcon } from 'lucide-react'
import toast from 'react-hot-toast'

const MapAdvanced = dynamic(() => import('@/components/MapAdvanced'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full bg-gray-100 animate-pulse flex items-center justify-center">
      <p className="text-gray-400 text-sm">Chargement de la carte...</p>
    </div>
  ),
})

type TypeCourse   = 'immediate' | 'urgente' | 'programmee'
type ModePaiement = 'cash' | 'mobile_money'

interface LocationPoint {
  lat: number; lng: number; label: string
}

// ── Composant upload photos colis ────────────────────────────────────────────
function PhotosColisUploader({
  photos, onAdd, onRemove,
}: {
  photos:   string[]
  onAdd:    (url: string) => void
  onRemove: (idx: number) => void
}) {
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const remaining = 5 - photos.length
    if (remaining <= 0) { toast.error('Maximum 5 photos'); return }
    const toUpload = files.slice(0, remaining)

    setUploading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Non authentifié')

      for (const file of toUpload) {
        if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} trop lourd (max 10 Mo)`); continue }
        const ext  = file.name.split('.').pop() || 'jpg'
        const path = `colis/${session.user.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { error: upErr } = await supabase.storage.from('photos-colis').upload(path, file)
        if (upErr) { toast.error(`Erreur upload : ${upErr.message}`); continue }
        const { data: { publicUrl } } = supabase.storage.from('photos-colis').getPublicUrl(path)
        onAdd(publicUrl)
        toast.success('Photo ajoutée ✅')
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erreur upload')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-semibold text-gray-700">📸 Photos du colis <span className="text-gray-400 font-normal">(optionnel · max 5)</span></p>

      <div className="grid grid-cols-3 gap-2">
        {photos.map((url, i) => (
          <div key={i} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200">
            <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
            <button onClick={() => onRemove(i)}
              className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center">
              <X size={11} className="text-white" />
            </button>
          </div>
        ))}

        {photos.length < 5 && (
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="aspect-square rounded-xl border-2 border-dashed border-gray-300 flex flex-col items-center justify-center gap-1 hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-60">
            {uploading
              ? <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
              : <>
                  <Camera size={20} className="text-gray-400" />
                  <span className="text-[10px] text-gray-400 font-medium">Ajouter</span>
                </>
            }
          </button>
        )}
      </div>

      <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFile} />

      {photos.length === 0 && (
        <p className="text-xs text-gray-400">Photographiez le colis pour faciliter la livraison</p>
      )}
    </div>
  )
}

// ── Page principale ──────────────────────────────────────────────────────────
export default function NouvelleLivraisonPage() {
  const router = useRouter()
  const [step,        setStep]        = useState(1)
  const [typeCourse,  setTypeCourse]  = useState<TypeCourse>('immediate')

  const [depart,  setDepart]  = useState<LocationPoint | null>(null)
  const [arrivee, setArrivee] = useState<LocationPoint | null>(null)
  const [route,   setRoute]   = useState<{ distance: number; duration: number } | null>(null)

  const [prixCalcule,        setPrixCalcule]        = useState<number | null>(null)
  const [prixProposeClient,  setPrixProposeClient]  = useState<number | ''>('')

  const [dateProgrammee, setDateProgrammee] = useState('')

  const [pourTiers,    setPourTiers]    = useState(false)
  const [destNom,      setDestNom]      = useState('')
  const [destTel,      setDestTel]      = useState('')
  const [destWhatsapp, setDestWhatsapp] = useState('')
  const [destEmail,    setDestEmail]    = useState('')
  const [instructions, setInstructions] = useState('')

  // MODIFICATION — photos du colis
  const [photosUrls, setPhotosUrls] = useState<string[]>([])

  const [modePaiement, setModePaiement] = useState<ModePaiement>('cash')
  const [loading,      setLoading]      = useState(false)

  useEffect(() => {
    if (depart && arrivee) {
      mapService
        .getRoute(depart.lat, depart.lng, arrivee.lat, arrivee.lng)
        .then(res => {
          setRoute(res)
          const price = priceNegotiationService.calculateRecommendedPrice(res.distance, typeCourse)
          setPrixCalcule(price)
          setPrixProposeClient(price)
        })
        .catch(() => {})
    }
  }, [depart, arrivee, typeCourse])

  const minDatetime = new Date(Date.now() + 30 * 60 * 1000).toISOString().slice(0, 16)
  const maxDatetime = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16)

  const handleSubmit = async () => {
    if (!depart || !arrivee)    { toast.error('Sélectionnez départ et destination'); return }
    if (!prixProposeClient)     { toast.error('Indiquez un prix'); return }
    if (typeCourse === 'programmee' && !dateProgrammee) { toast.error('Choisissez une date'); return }
    if (pourTiers && !destNom.trim()) { toast.error('Nom du destinataire requis'); return }
    if (pourTiers && !destTel.trim()) { toast.error('Téléphone du destinataire requis'); return }

    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }

      const { data: livraison, error } = await supabase
        .from('livraisons')
        .insert({
          client_id:             session.user.id,
          depart_adresse:        depart.label,
          depart_lat:            depart.lat,
          depart_lng:            depart.lng,
          arrivee_adresse:       arrivee.label,
          arrivee_lat:           arrivee.lat,
          arrivee_lng:           arrivee.lng,
          type:                  typeCourse,
          prix_calcule:          prixCalcule ?? Number(prixProposeClient),
          distance_km:           route?.distance ?? null,
          duree_estimee:         route ? Math.round(route.duration / 60) : null,
          statut:                'en_attente',
          statut_paiement:       'en_attente',
          is_paid_to_courier:    false,
          mode_paiement:         modePaiement,
          pour_tiers:            pourTiers,
          programme_le:          typeCourse === 'programmee' ? new Date(dateProgrammee).toISOString() : null,
          destinataire_nom:      pourTiers ? destNom.trim()      : '',
          destinataire_tel:      pourTiers ? destTel.trim()      : '',
          destinataire_whatsapp: pourTiers ? (destWhatsapp.trim() || destTel.trim()) : null,
          destinataire_email:    pourTiers && destEmail.trim() ? destEmail.trim() : null,
          instructions:          instructions.trim() || null,
          // MODIFICATION — photos colis stockées
          photos_colis:          photosUrls.length > 0 ? photosUrls : null,
        })
        .select()
        .single()

      if (error) throw error

      await priceNegotiationService.proposePriceAsClient(livraison.id, session.user.id, Number(prixProposeClient))
      toast.success('Livraison créée !')
      router.push(`/client/propositions/${livraison.id}`)
    } catch (e: unknown) {
      console.error(e)
      toast.error('Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="sticky top-0 z-40 bg-primary-600 text-white shadow-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center gap-3 h-16">
            <button onClick={() => step > 1 ? setStep(step - 1) : router.back()}
              className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors">
              ←
            </button>
            <div>
              <h1 className="font-bold">Nouvelle livraison</h1>
              <p className="text-white/60 text-xs">Étape {step}/4</p>
            </div>
          </div>
        </div>
      </header>

      <div className="w-full h-1 bg-white/20">
        <div className="h-full bg-white transition-all duration-300" style={{ width: `${(step / 4) * 100}%` }} />
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 space-y-4">

        {/* ── ÉTAPE 1 : Type de course ── */}
        {step === 1 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-900 text-lg">Type de livraison</h2>

            {([
              { value: 'immediate',  label: '⚡ Immédiate',  desc: 'Dans les 30 minutes' },
              { value: 'urgente',    label: '🚨 Urgente',    desc: 'Dans les 15 minutes (+30%)' },
              { value: 'programmee', label: '📅 Programmée', desc: 'À une date ultérieure (max 15 jours)' },
            ] as { value: TypeCourse; label: string; desc: string }[]).map(opt => (
              <button key={opt.value} onClick={() => setTypeCourse(opt.value)}
                className={`w-full p-4 rounded-2xl text-left border-2 transition-all ${typeCourse === opt.value ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                <p className="font-bold text-gray-900">{opt.label}</p>
                <p className="text-sm text-gray-500">{opt.desc}</p>
              </button>
            ))}

            {typeCourse === 'programmee' && (
              <div className="bg-purple-50 rounded-2xl p-4 border border-purple-200 space-y-2">
                <p className="text-sm font-bold text-purple-800">📅 Date et heure de la livraison</p>
                <input type="datetime-local" value={dateProgrammee} onChange={e => setDateProgrammee(e.target.value)}
                  min={minDatetime} max={maxDatetime}
                  className="w-full px-4 py-3 border border-purple-200 rounded-xl text-sm outline-none bg-white" />
                <p className="text-xs text-purple-600">Minimum 30 min · Maximum 15 jours</p>
              </div>
            )}

            <button onClick={() => {
              if (typeCourse === 'programmee' && !dateProgrammee) { toast.error('Choisissez une date'); return }
              setStep(2)
            }}
              className="w-full py-3 rounded-xl bg-primary-500 text-white font-bold hover:bg-primary-600 transition-colors">
              Continuer →
            </button>
          </div>
        )}

        {/* ── ÉTAPE 2 : Adresses + pour un tiers ── */}
        {step === 2 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-900 text-lg">Adresses de livraison</h2>

            <div className="h-72 rounded-2xl overflow-hidden border border-gray-200">
              <MapAdvanced
                depart={depart ?? undefined}
                arrivee={arrivee ?? undefined}
                route={route as any}
                onLocationSelect={(lat, lng, label) => {
                  if (!depart) setDepart({ lat, lng, label })
                  else setArrivee({ lat, lng, label })
                }}
              />
            </div>

            <p className="text-xs text-gray-500 text-center">
              {!depart ? '📍 Cliquez sur la carte pour le départ' : !arrivee ? '🎯 Cliquez pour la destination' : '✅ Adresses sélectionnées'}
            </p>

            {depart && (
              <div className="bg-white rounded-xl p-3 border border-gray-200 flex items-center justify-between">
                <div><p className="text-xs text-gray-500">Départ</p><p className="text-sm font-semibold truncate">{depart.label}</p></div>
                <button onClick={() => setDepart(null)} className="text-red-400 text-xs p-1">✕</button>
              </div>
            )}
            {arrivee && (
              <div className="bg-white rounded-xl p-3 border border-gray-200 flex items-center justify-between">
                <div><p className="text-xs text-gray-500">Destination</p><p className="text-sm font-semibold truncate">{arrivee.label}</p></div>
                <button onClick={() => setArrivee(null)} className="text-red-400 text-xs p-1">✕</button>
              </div>
            )}

            {route && (
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-500">Distance</p>
                  <p className="font-bold text-blue-700">{route.distance.toFixed(1)} km</p>
                </div>
                <div className="bg-blue-50 rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-500">Durée estimée</p>
                  <p className="font-bold text-blue-700">{Math.round(route.duration / 60)} min</p>
                </div>
              </div>
            )}

            {/* Pour un tiers */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200">
              <button onClick={() => setPourTiers(!pourTiers)} className="flex items-center gap-3 w-full text-left">
                <div className={`w-12 h-6 rounded-full relative transition-colors flex-shrink-0 ${pourTiers ? 'bg-primary-500' : 'bg-gray-300'}`}>
                  <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow transition-all ${pourTiers ? 'left-6' : 'left-0.5'}`} />
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm">📦 Livraison pour quelqu'un d'autre</p>
                  <p className="text-xs text-gray-400">Le destinataire est différent de vous</p>
                </div>
              </button>

              {pourTiers && (
                <div className="mt-4 space-y-3 border-t border-gray-100 pt-4">
                  <p className="text-sm font-bold text-gray-700">Informations du destinataire</p>
                  {[
                    { key: 'destNom',      val: destNom,      set: setDestNom,      placeholder: 'Nom complet *',          type: 'text' },
                    { key: 'destTel',      val: destTel,      set: setDestTel,      placeholder: 'Téléphone *',            type: 'tel'  },
                    { key: 'destWhatsapp', val: destWhatsapp, set: setDestWhatsapp, placeholder: 'WhatsApp (optionnel)',    type: 'tel'  },
                    { key: 'destEmail',    val: destEmail,    set: setDestEmail,    placeholder: 'Email (optionnel)',       type: 'email' },
                  ].map(f => (
                    <input key={f.key} type={f.type} value={f.val} placeholder={f.placeholder}
                      onChange={e => f.set(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-400" />
                  ))}
                </div>
              )}
            </div>

            {/* Instructions spéciales */}
            <div className="bg-white rounded-2xl p-4 border border-gray-200">
              <p className="text-sm font-bold text-gray-700 mb-2">💬 Instructions spéciales (optionnel)</p>
              <textarea value={instructions} onChange={e => setInstructions(e.target.value)}
                placeholder="Ex: Laisser à la porte, appeler avant d'arriver..."
                rows={3}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-400 resize-none" />
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(1)} className="flex-1 py-3 rounded-xl border-2 border-gray-200 font-bold text-gray-700">← Retour</button>
              <button onClick={() => {
                if (!depart || !arrivee) { toast.error('Sélectionnez départ et destination'); return }
                if (pourTiers && !destNom.trim()) { toast.error('Nom requis'); return }
                if (pourTiers && !destTel.trim()) { toast.error('Téléphone requis'); return }
                setStep(3)
              }}
                disabled={!depart || !arrivee}
                className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-bold disabled:opacity-50">
                Continuer →
              </button>
            </div>
          </div>
        )}

        {/* ── ÉTAPE 3 : Photos colis (NOUVEAU) ── */}
        {step === 3 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-900 text-lg">Photos du colis</h2>

            <div className="bg-white rounded-2xl p-4 border border-gray-200">
              <PhotosColisUploader
                photos={photosUrls}
                onAdd={url => setPhotosUrls(prev => [...prev, url])}
                onRemove={idx => setPhotosUrls(prev => prev.filter((_, i) => i !== idx))}
              />
            </div>

            <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
              <p className="text-xs text-amber-700 font-semibold">💡 Conseil</p>
              <p className="text-xs text-amber-600 mt-1">Ajoutez des photos pour faciliter la récupération du colis et prévenir tout litige.</p>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(2)} className="flex-1 py-3 rounded-xl border-2 border-gray-200 font-bold text-gray-700">← Retour</button>
              <button onClick={() => setStep(4)} className="flex-1 py-3 rounded-xl bg-primary-500 text-white font-bold">
                Continuer → {photosUrls.length === 0 && <span className="text-white/60 text-xs">(passer)</span>}
              </button>
            </div>
          </div>
        )}

        {/* ── ÉTAPE 4 : Prix + Mode paiement ── */}
        {step === 4 && (
          <div className="space-y-4">
            <h2 className="font-bold text-gray-900 text-lg">Prix & paiement</h2>

            {prixCalcule && (
              <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200">
                <p className="text-xs text-amber-600 mb-1">Prix recommandé</p>
                <p className="text-2xl font-black text-amber-700">{prixCalcule.toLocaleString()} XOF</p>
                <p className="text-xs text-amber-500 mt-1">
                  Basé sur {route?.distance.toFixed(1)} km
                  {typeCourse === 'urgente' && ' · +30% urgence'}
                </p>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Votre offre (XOF)</label>
              <input type="number" value={prixProposeClient}
                onChange={e => setPrixProposeClient(e.target.value ? Number(e.target.value) : '')}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm outline-none focus:border-primary-400 text-lg font-bold"
                placeholder="Entrez un montant" min={500} />
            </div>

            {prixCalcule && prixProposeClient && (
              <div className={`rounded-xl p-3 text-sm ${
                priceNegotiationService.validateProposal(Number(prixProposeClient), prixCalcule).valid
                  ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
              }`}>
                {priceNegotiationService.validateProposal(Number(prixProposeClient), prixCalcule).message
                  || '✅ Prix valide — les coursiers pourront accepter ou contre-proposer'}
              </div>
            )}

            <div>
              <p className="text-sm font-bold text-gray-700 mb-2">💳 Mode de paiement</p>
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['cash',         '💵 Espèces',      'Payez au coursier'],
                  ['mobile_money', '📱 Mobile Money', 'Orange Money, Moov, Wave'],
                ] as [ModePaiement, string, string][]).map(([m, label, sub]) => (
                  <button key={m} onClick={() => setModePaiement(m)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${modePaiement === m ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white'}`}>
                    <p className="font-bold text-sm text-gray-900">{label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Récapitulatif */}
            <div className="bg-white rounded-2xl p-4 border border-gray-100 space-y-2">
              <p className="font-bold text-gray-900 text-sm">Récapitulatif</p>
              <div className="text-xs text-gray-500 space-y-1">
                <div className="flex justify-between"><span>Type</span><span className="font-semibold capitalize">{typeCourse}</span></div>
                <div className="flex justify-between"><span>Départ</span><span className="font-semibold text-right max-w-[55%] truncate">{depart?.label}</span></div>
                <div className="flex justify-between"><span>Arrivée</span><span className="font-semibold text-right max-w-[55%] truncate">{arrivee?.label}</span></div>
                {pourTiers && <div className="flex justify-between"><span>Destinataire</span><span className="font-semibold">{destNom}</span></div>}
                {photosUrls.length > 0 && <div className="flex justify-between"><span>Photos colis</span><span className="font-semibold">{photosUrls.length} photo(s)</span></div>}
                <div className="flex justify-between"><span>Paiement</span><span className="font-semibold">{modePaiement === 'cash' ? 'Espèces' : 'Mobile Money'}</span></div>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setStep(3)} className="flex-1 py-3 rounded-xl border-2 border-gray-200 font-bold text-gray-700">← Retour</button>
              <button onClick={handleSubmit} disabled={loading || !prixProposeClient}
                className="flex-1 py-3 rounded-xl bg-green-500 text-white font-bold disabled:opacity-50">
                {loading ? '⏳ Création...' : '🚀 Créer la livraison'}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}