// src/app/api/client/livraisons/create/route.ts
// Utilise calculerPrix() de src/lib/tarifs.ts (barèmes Supabase)
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { calculerPrix } from '@/lib/tarifs'

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await req.json()
    const {
      client_id,
      depart_adresse, depart_lat, depart_lng,
      arrivee_adresse, arrivee_lat, arrivee_lng,
      destinataire_nom, destinataire_tel, destinataire_whatsapp, destinataire_email,
      instructions, photos_colis,
      type = 'immediate',
      prix_calcule,
      programme_le,
      pour_tiers = false,
      mode_paiement = 'cash',
    } = body

    if (!client_id || !depart_adresse || !arrivee_adresse || !destinataire_nom || !destinataire_tel) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
    }

    const dLat = depart_lat  || 12.3547
    const dLng = depart_lng  || -1.5247
    const aLat = arrivee_lat || 12.3647
    const aLng = arrivee_lng || -1.5147

    // Distance euclidienne approx
    const distanceKm = Math.sqrt(
      Math.pow((aLat - dLat) * 111, 2) +
      Math.pow((aLng - dLng) * 111 * Math.cos((dLat * Math.PI) / 180), 2)
    )
    const distanceArrondie = Math.round(distanceKm * 10) / 10

    // Prix : fourni par le client ou calculé avec les barèmes Supabase
    let prixFinal: number
    if (prix_calcule && prix_calcule > 0) {
      prixFinal = prix_calcule
    } else {
      try {
        prixFinal = await calculerPrix(distanceArrondie, type as 'immediate' | 'urgente' | 'programmee')
      } catch (e) {
        console.error('[create] calculerPrix fallback:', e)
        // Fallback hardcodé si Supabase inaccessible
        prixFinal = Math.max(800, Math.round(800 + distanceArrondie * 600))
      }
    }

    const { data, error } = await supabase.from('livraisons').insert({
      client_id,
      statut:                'en_attente',
      type,
      pour_tiers:            pour_tiers || false,
      depart_adresse,
      depart_lat:            dLat,
      depart_lng:            dLng,
      arrivee_adresse,
      arrivee_lat:           aLat,
      arrivee_lng:           aLng,
      destinataire_nom,
      destinataire_tel,
      destinataire_whatsapp: destinataire_whatsapp || destinataire_tel,
      destinataire_email:    destinataire_email || null,
      instructions:          instructions || null,
      photos_colis:          photos_colis || [],
      prix_calcule:          prixFinal,
      distance_km:           distanceArrondie,
      statut_paiement:       'en_attente',
      mode_paiement:         mode_paiement || 'cash',
      programme_le:          programme_le || null,
      is_paid_to_courier:    false,
    }).select().single()

    if (error) throw error

    await supabase.from('notifications').insert({
      user_id: client_id,
      type:    'livraison',
      titre:   'Livraison créée',
      message: `Votre livraison vers ${arrivee_adresse} a été créée. Recherche d'un coursier...`,
      data:    { livraison_id: data.id },
      lu:      false,
    })

    return NextResponse.json({ success: true, livraison: data })
  } catch (err) {
    console.error('[API] create livraison:', err)
    return NextResponse.json({ error: 'Erreur création livraison' }, { status: 500 })
  }
}
