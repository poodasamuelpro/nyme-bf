'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { mapService } from '@/services/map-service'
import { priceNegotiationService } from '@/services/price-negotiation-service'
import toast from 'react-hot-toast'

const MapAdvanced = dynamic(() => import('@/components/MapAdvanced'), { 
  ssr: false, 
  loading: () => <div className="h-full w-full bg-gray-100 animate-pulse flex items-center justify-center">Chargement...</div> 
})

export default function NouvelleLivraisonPage() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [typeCourse, setTypeCourse] = useState<'immediate' | 'urgent' | 'programmed'>('immediate')
  const [depart, setDepart] = useState<{lat: number, lng: number, label: string} | null>(null)
  const [arrivee, setArrivee] = useState<{lat: number, lng: number, label: string} | null>(null)
  const [prixCalcule, setPrixCalcule] = useState<number | null>(null)
  const [prixProposeClient, setPrixProposeClient] = useState<number | ''>('')
  const [loading, setLoading] = useState(false)
  const [route, setRoute] = useState<any>(null)

  useEffect(() => {
    if (depart && arrivee) {
      mapService.getRoute(depart.lat, depart.lng, arrivee.lat, arrivee.lng)
        .then(res => {
          setRoute(res)
          const price = priceNegotiationService.calculateRecommendedPrice(res.distance, typeCourse as any)
          setPrixCalcule(price)
        })
  }}, [depart, arrivee, typeCourse])

  const handleSubmit = async () => {
    if (!depart || !arrivee || !prixProposeClient) return toast.error("Complétez le formulaire")
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return router.push('/login')

      const { data: livraison, error } = await supabase.from('livraisons').insert({
        client_id: session.user.id,
        depart_adresse: depart.label, depart_lat: depart.lat, depart_lng: depart.lng,
        arrivee_adresse: arrivee.label, arrivee_lat: arrivee.lat, arrivee_lng: arrivee.lng,
        type_course: typeCourse, prix_calcule: prixCalcule, statut: 'en_attente'
      }).select().single()

      if (error) throw error
      await priceNegotiationService.proposePriceAsClient(livraison.id, session.user.id, Number(prixProposeClient))
      toast.success('Livraison créée !')
      router.push(`/client/suivi/${livraison.id}`)
    } catch (e) { toast.error("Erreur de création") } finally { setLoading(false) }
  }

  // Reste du JSX (étapes 1 à 5) identique à votre version...
  return (
    // ... votre code de rendu ...
    <MapAdvanced 
        onLocationSelect={(lat, lng, label) => setDepart({lat, lng, label})} 
        depart={depart || undefined} 
        route={route} 
    />
  )
}
