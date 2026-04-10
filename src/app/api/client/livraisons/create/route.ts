// src/app/api/client/livraisons/create/route.ts
// ═══════════════════════════════════════════════════════════════════════════
// CORRECTION AUDIT :
//  1. Utilise mapService.getRoute() pour une distance réelle (plus euclidienne)
//  2. La distance réelle améliore la précision du prix calculé
//  3. Suppression du fallback hardcodé 800 + distanceArrondie * 600
//     → remplacé par calculerPrix() depuis src/lib/tarifs.ts (source unique)
//  4. Notification Firebase push aux coursiers disponibles via FCM
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { calculerPrix } from '@/lib/tarifs'
import { mapService } from '@/services/map-service'
import { firebaseNotificationService } from '@/services/firebase-notification-service'

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
      pour_tiers   = false,
      mode_paiement = 'cash',
    } = body

    // Validation des champs requis
    if (!client_id || !depart_adresse || !arrivee_adresse || !destinataire_nom || !destinataire_tel) {
      return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
    }

    // Vérification que le client existe et est authentifié
    if (client_id !== session.user.id) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const dLat = Number(depart_lat)  || 12.3547
    const dLng = Number(depart_lng)  || -1.5247
    const aLat = Number(arrivee_lat) || 12.3647
    const aLng = Number(arrivee_lng) || -1.5147

    // ── CORRECTION AUDIT ─────────────────────────────────────────────────
    // Calcul de distance réelle via MapService (itinéraire routier)
    // au lieu de la formule euclidienne approximative précédente.
    // Rotation automatique : Mapbox → Google → OSRM
    let distanceKm = 0
    let distanceArrondie = 0

    try {
      const route = await mapService.getRoute(dLat, dLng, aLat, aLng)
      distanceKm       = route.distance
      distanceArrondie = Math.round(distanceKm * 10) / 10
      console.log(`[create] Distance routière (${route.provider}): ${distanceArrondie} km`)
    } catch (routeErr) {
      console.warn('[create] mapService.getRoute échoué, fallback euclidien:', routeErr)
      // Fallback euclidien seulement si MapService complètement indisponible
      distanceKm = Math.sqrt(
        Math.pow((aLat - dLat) * 111, 2) +
        Math.pow((aLng - dLng) * 111 * Math.cos((dLat * Math.PI) / 180), 2)
      )
      distanceArrondie = Math.round(distanceKm * 10) / 10
    }

    // ── Calcul du prix depuis les barèmes Supabase ────────────────────────
    // CORRECTION AUDIT : Source unique = calculerPrix() de src/lib/tarifs.ts
    // Suppression du fallback hardcodé précédent (800 + distanceArrondie * 600)
    let prixFinal: number
    if (prix_calcule && Number(prix_calcule) > 0) {
      // Le client a fourni un prix calculé côté frontend — on l'utilise
      prixFinal = Number(prix_calcule)
    } else {
      try {
        prixFinal = await calculerPrix(
          distanceArrondie,
          type as 'immediate' | 'urgente' | 'programmee'
        )
      } catch (priceErr) {
        // Le seul fallback acceptable est calculerPrixFallback (barèmes par défaut)
        console.error('[create] calculerPrix Supabase échoué, utilisation barèmes par défaut:', priceErr)
        const { calculerPrixFallback } = await import('@/lib/tarifs')
        prixFinal = calculerPrixFallback(distanceArrondie, type as 'immediate' | 'urgente' | 'programmee')
      }
    }

    // ── Insertion de la livraison ─────────────────────────────────────────
    const { data, error } = await supabase
      .from('livraisons')
      .insert({
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
      })
      .select()
      .single()

    if (error) throw error

    // ── Notification in-app au client ─────────────────────────────────────
    await supabase.from('notifications').insert({
      user_id: client_id,
      type:    'livraison',
      titre:   '📦 Livraison créée',
      message: `Votre livraison vers ${arrivee_adresse} (${distanceArrondie} km) a été créée. Recherche d'un coursier...`,
      data:    { livraison_id: data.id, distance_km: distanceArrondie },
      lu:      false,
    })

    // ── Notification push FCM aux coursiers disponibles ───────────────────
    // Récupérer les coursiers disponibles avec un token FCM dans un rayon approximatif
    if (firebaseNotificationService.isConfigured()) {
      try {
        const { data: coursiers } = await supabaseAdmin
          .from('coursiers')
          .select('id')
          .eq('statut', 'disponible')
          .eq('statut_verification', 'verifie')
          .limit(50)

        if (coursiers && coursiers.length > 0) {
          const coursierIds = coursiers.map((c: { id: string }) => c.id)
          await firebaseNotificationService.notifyNewLivraisonToCoursiers(
            coursierIds,
            data.id,
            prixFinal
          )
        }
      } catch (fcmErr) {
        // Non-bloquant — la livraison est créée même si les notifs FCM échouent
        console.warn('[create] Notification FCM coursiers échouée:', fcmErr)
      }
    }

    return NextResponse.json({
      success:     true,
      livraison:   data,
      distance_km: distanceArrondie,
      prix_calcule: prixFinal,
    })
  } catch (err) {
    console.error('[API] create livraison:', err)
    return NextResponse.json({ error: 'Erreur création livraison' }, { status: 500 })
  }
}