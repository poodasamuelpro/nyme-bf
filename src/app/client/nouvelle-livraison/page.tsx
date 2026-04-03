'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { mapService } from '@/services/map-service'
import { priceNegotiationService } from '@/services/price-negotiation-service'
import toast from 'react-hot-toast'

const MapAdvanced = dynamic(() => import('@/components/MapAdvanced'), { ssr: false })

interface Location {
  lat: number
  lng: number
  label: string
}

export default function NouvelleLivraisonPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [typeCourse, setTypeCourse] = useState<'immediate' | 'urgent' | 'programmed'>('immediate')
  const [depart, setDepart] = useState<Location | null>(null)
  const [arrivee, setArrivee] = useState<Location | null>(null)
  const [colisDetails, setColisDetails] = useState({
    description: '',
    poids: '',
    destinataireNom: '',
    destinataireTel: '',
    instructions: '',
  })
  const [prixProposeClient, setPrixProposeClient] = useState<number | ''>('')
  const [prixCalcule, setPrixCalcule] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (depart && arrivee) {
      mapService.getRoute(depart.lat, depart.lng, arrivee.lat, arrivee.lng)
        .then(route => {
          let basePrice = 800
          let pricePerKm = 200
          let calculated = basePrice + (route.distance * pricePerKm)

          if (typeCourse === 'urgent') {
            calculated *= 1.3
          } else if (typeCourse === 'programmed') {
            calculated *= 0.9
          }
          setPrixCalcule(Math.round(calculated))
        })
        .catch(error => {
          console.error('Error calculating price:', error)
          setPrixCalcule(null)
        })
    }
  }, [depart, arrivee, typeCourse])

  const handleNext = () => setStep(prev => prev + 1)
  const handleBack = () => setStep(prev => prev - 1)

  const handleLocationSelect = (type: 'depart' | 'arrivee') => (lat: number, lng: number, label: string) => {
    if (type === 'depart') {
      setDepart({ lat, lng, label })
    } else {
      setArrivee({ lat, lng, label })
    }
  }

  const handleSubmit = async () => {
    if (!depart || !arrivee || !prixCalcule || !prixProposeClient) {
      toast.error('Veuillez remplir tous les champs requis.')
      return
    }

    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      const { data: livraison, error } = await supabase
        .from('livraisons')
        .insert({
          client_id: session.user.id,
          depart_adresse: depart.label,
          depart_lat: depart.lat,
          depart_lng: depart.lng,
          arrivee_adresse: arrivee.label,
          arrivee_lat: arrivee.lat,
          arrivee_lng: arrivee.lng,
          type_course: typeCourse,
          description_colis: colisDetails.description,
          poids_colis: colisDetails.poids,
          destinataire_nom: colisDetails.destinataireNom,
          destinataire_tel: colisDetails.destinataireTel,
          instructions: colisDetails.instructions,
          prix_calcule: prixCalcule,
          statut: 'en_attente',
        })
        .select()
        .single()

      if (error) throw error

      // ✅ CORRECTION ICI : proposePriceAsClient au lieu de createProposition
      await priceNegotiationService.proposePriceAsClient(livraison.id, session.user.id, Number(prixProposeClient))

      toast.success('Livraison créée avec succès !')
      router.push(`/client/suivi/${livraison.id}`)
    } catch (err) {
      console.error('Error creating delivery:', err)
      toast.error('Erreur lors de la création de la livraison.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-nyme-surface">
      <header className="sticky top-0 z-40 bg-primary-600 text-white shadow-nyme-lg">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <button onClick={handleBack} className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center hover:bg-white/30 transition-colors">
              ←
            </button>
            <h1 className="font-bold text-lg">Nouvelle Livraison - Étape {step}/5</h1>
            <div className="w-9 h-9"></div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24">
        {step === 1 && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-900">Quel type de course ?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['immediate', 'urgent', 'programmed'].map(type => (
                <button
                  key={type}
                  onClick={() => setTypeCourse(type as 'immediate' | 'urgent' | 'programmed')}
                  className={`card p-6 text-center transition-all ${typeCourse === type ? 'border-2 border-primary-500 shadow-lg' : 'border border-gray-200 hover:shadow-md'}`}
                >
                  <p className="text-4xl mb-2">
                    {type === 'immediate' && '🚀'}
                    {type === 'urgent' && '🚨'}
                    {type === 'programmed' && '🗓️'}
                  </p>
                  <p className="font-bold text-gray-900 capitalize">{type}</p>
                  <p className="text-sm text-gray-500">
                    {type === 'immediate' && 'Livraison standard'}
                    {type === 'urgent' && 'Livraison prioritaire (+30%)'}
                    {type === 'programmed' && 'Livraison planifiée (-10%)'}
                  </p>
                </button>
              ))}
            </div>
            <button onClick={handleNext} className="btn-primary w-full">Suivant</button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-900">Où récupérer et livrer ?</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Point de départ</label>
                <input
                  type="text"
                  className="input-nyme"
                  placeholder="Adresse de départ"
                  value={depart?.label || ''}
                  readOnly
                />
                <div className="h-64 rounded-xl overflow-hidden mt-2">
                  <MapAdvanced onLocationSelect={handleLocationSelect('depart')} depart={depart || undefined} zoom={15} />
                </div>
              </div>
              <div>
                <label className="label">Point d'arrivée</label>
                <input
                  type="text"
                  className="input-nyme"
                  placeholder="Adresse d'arrivée"
                  value={arrivee?.label || ''}
                  readOnly
                />
                <div className="h-64 rounded-xl overflow-hidden mt-2">
                  <MapAdvanced onLocationSelect={handleLocationSelect('arrivee')} arrivee={arrivee || undefined} zoom={15} />
                </div>
              </div>
            </div>
            <button onClick={handleNext} className="btn-primary w-full" disabled={!depart || !arrivee}>Suivant</button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-900">Détails du colis et destinataire</h2>
            <div className="space-y-4">
              <div>
                <label className="label">Description du colis</label>
                <textarea
                  className="input-nyme h-24"
                  placeholder="Ex: Documents importants, petit colis fragile..."
                  value={colisDetails.description}
                  onChange={e => setColisDetails({ ...colisDetails, description: e.target.value })}
                ></textarea>
              </div>
              <div>
                <label className="label">Poids estimé (kg)</label>
                <input
                  type="number"
                  className="input-nyme"
                  placeholder="Ex: 2.5"
                  value={colisDetails.poids}
                  onChange={e => setColisDetails({ ...colisDetails, poids: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Nom du destinataire</label>
                <input
                  type="text"
                  className="input-nyme"
                  placeholder="Nom complet"
                  value={colisDetails.destinataireNom}
                  onChange={e => setColisDetails({ ...colisDetails, destinataireNom: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Téléphone du destinataire</label>
                <input
                  type="tel"
                  className="input-nyme"
                  placeholder="Ex: +226 70 00 00 00"
                  value={colisDetails.destinataireTel}
                  onChange={e => setColisDetails({ ...colisDetails, destinataireTel: e.target.value })}
                />
              </div>
              <div>
                <label className="label">Instructions spéciales (optionnel)</label>
                <textarea
                  className="input-nyme h-20"
                  placeholder="Ex: Sonner 3 fois, laisser à la réception..."
                  value={colisDetails.instructions}
                  onChange={e => setColisDetails({ ...colisDetails, instructions: e.target.value })}
                ></textarea>
              </div>
            </div>
            <button onClick={handleNext} className="btn-primary w-full" disabled={!colisDetails.description || !colisDetails.destinataireNom || !colisDetails.destinataireTel}>Suivant</button>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-900">Proposez votre prix</h2>
            <div className="card p-4 text-center">
              <p className="text-sm text-gray-500">Prix calculé par NYME</p>
              <p className="text-4xl font-black text-primary-600">{prixCalcule?.toLocaleString() || '--'} XOF</p>
            </div>
            <div>
              <label className="label">Votre proposition (XOF)</label>
              <input
                type="number"
                className="input-nyme text-center text-2xl font-bold"
                placeholder="Ex: 2500"
                value={prixProposeClient}
                onChange={e => setPrixProposeClient(Number(e.target.value))}
              />
              <p className="text-sm text-gray-500 mt-2">Le coursier pourra accepter ou faire une contre-proposition.</p>
            </div>
            <button onClick={handleNext} className="btn-primary w-full" disabled={!prixProposeClient || Number(prixProposeClient) <= 0}>Suivant</button>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6 animate-fade-in">
            <h2 className="text-2xl font-bold text-gray-900">Confirmez votre livraison</h2>
            <div className="card p-4 space-y-3">
              <p className="text-lg font-bold text-gray-900">Résumé</p>
              <p><strong>Type de course:</strong> {typeCourse}</p>
              <p><strong>Départ:</strong> {depart?.label}</p>
              <p><strong>Arrivée:</strong> {arrivee?.label}</p>
              <p><strong>Description colis:</strong> {colisDetails.description}</p>
              <p><strong>Destinataire:</strong> {colisDetails.destinataireNom} ({colisDetails.destinataireTel})</p>
              <p><strong>Votre prix proposé:</strong> {Number(prixProposeClient).toLocaleString()} XOF</p>
              <p className="text-sm text-gray-500">Prix calculé par NYME: {prixCalcule?.toLocaleString()} XOF</p>
            </div>
            <button onClick={handleSubmit} className="btn-primary w-full" disabled={loading}>
              {loading ? 'Création...' : 'Confirmer et trouver un coursier'}
            </button>
          </div>
        )}
      </main>
    </div>
  )
}