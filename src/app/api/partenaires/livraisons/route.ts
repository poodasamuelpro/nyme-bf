// src/app/api/partenaires/livraisons/route.ts
// ══════════════════════════════════════════════════════════════════
// LIVRAISONS PARTENAIRE — NYME
// GET  → lister ses livraisons partenaire
// POST → créer une livraison partenaire
// ══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { calculerPrix } from '@/lib/tarifs'

export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    // Récupérer le profil partenaire
    const { data: partenaire } = await supabaseAdmin
      .from('partenaires')
      .select('id, statut')
      .eq('user_id', session.user.id)
      .single()

    if (!partenaire) return NextResponse.json({ error: 'Profil partenaire introuvable' }, { status: 403 })
    if (partenaire.statut !== 'actif') return NextResponse.json({ error: 'Compte partenaire non actif' }, { status: 403 })

    const { searchParams } = new URL(req.url)
    const limit  = parseInt(searchParams.get('limit') || '50')
    const statut = searchParams.get('statut')

    let query = supabaseAdmin
      .from('livraisons_partenaire')
      .select('*')
      .eq('partenaire_id', partenaire.id)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (statut) query = query.eq('statut', statut)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ livraisons: data || [], total: data?.length || 0 })

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    // Récupérer le profil partenaire
    const { data: partenaire } = await supabaseAdmin
      .from('partenaires')
      .select('id, statut, livraisons_mois, livraisons_max, taux_commission')
      .eq('user_id', session.user.id)
      .single()

    if (!partenaire) return NextResponse.json({ error: 'Profil partenaire introuvable' }, { status: 403 })
    if (partenaire.statut !== 'actif') return NextResponse.json({ error: 'Compte partenaire non actif' }, { status: 403 })

    // Vérifier les limites
    if (partenaire.livraisons_mois >= partenaire.livraisons_max) {
      return NextResponse.json({
        error: `Limite mensuelle atteinte (${partenaire.livraisons_max} livraisons/mois). Contactez NYME pour augmenter votre quota.`,
      }, { status: 429 })
    }

    const body = await req.json()
    const {
      adresse_depart, adresse_arrivee,
      lat_depart, lng_depart, lat_arrivee, lng_arrivee,
      destinataire_nom, destinataire_tel, instructions,
    } = body

    if (!adresse_depart || !adresse_arrivee || !destinataire_nom || !destinataire_tel) {
      return NextResponse.json({ error: 'Champs requis: adresse_depart, adresse_arrivee, destinataire_nom, destinataire_tel' }, { status: 400 })
    }

    // Calculer le prix
    const dLat = lat_depart  || 12.3547
    const dLng = lng_depart  || -1.5247
    const aLat = lat_arrivee || 12.3647
    const aLng = lng_arrivee || -1.5147

    const distanceKm = Math.round(
      Math.sqrt(
        Math.pow((aLat - dLat) * 111, 2) +
        Math.pow((aLng - dLng) * 111 * Math.cos((dLat * Math.PI) / 180), 2)
      ) * 10
    ) / 10

    let prix = 1500
    try {
      prix = await calculerPrix(distanceKm, 'immediate')
    } catch {
      prix = Math.max(800, Math.round(800 + distanceKm * 600))
    }

    const commission = Math.round(prix * (partenaire.taux_commission / 100))

    const { data, error } = await supabaseAdmin
      .from('livraisons_partenaire')
      .insert({
        partenaire_id:    partenaire.id,
        adresse_depart,
        adresse_arrivee,
        lat_depart:       dLat,
        lng_depart:       dLng,
        lat_arrivee:      aLat,
        lng_arrivee:      aLng,
        destinataire_nom: destinataire_nom.trim(),
        destinataire_tel: destinataire_tel.trim(),
        instructions:     instructions || null,
        statut:           'en_attente',
        prix,
        commission,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Incrémenter le compteur mensuel
    await supabaseAdmin
      .from('partenaires')
      .update({ livraisons_mois: partenaire.livraisons_mois + 1 })
      .eq('id', partenaire.id)

    return NextResponse.json({ success: true, livraison: data }, { status: 201 })

  } catch (err: unknown) {
    console.error('[api/partenaires/livraisons]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}