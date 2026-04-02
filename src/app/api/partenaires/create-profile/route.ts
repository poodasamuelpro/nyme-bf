// src/app/api/partenaires/create-profile/route.ts
// Endpoint pour créer le profil partenaire après inscription
// Utilise SUPABASE_SERVICE_ROLE_KEY pour bypasser les RLS
// L'utilisateur doit être authentifié (JWT valide)

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    // 1. Vérifier que l'appelant est authentifié
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.replace('Bearer ', '').trim()

    if (!token) {
      return NextResponse.json({ error: 'Non autorisé — token manquant' }, { status: 401 })
    }

    // Vérifier le JWT avec la clé anon
    const supabaseCheck = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )

    const { data: { user: caller }, error: authCheckErr } = await supabaseCheck.auth.getUser(token)
    if (authCheckErr || !caller) {
      return NextResponse.json({ error: 'Token invalide ou expiré' }, { status: 401 })
    }

    // 2. Parser le body
    const body = await req.json()
    const { user_id, entreprise, nom_contact, telephone, email_pro } = body

    // Vérifier que l'user_id correspond bien au caller (sécurité)
    if (user_id !== caller.id) {
      return NextResponse.json({ error: 'Accès refusé — vous ne pouvez créer que votre propre profil' }, { status: 403 })
    }

    if (!entreprise || !nom_contact || !email_pro) {
      return NextResponse.json({ error: 'entreprise, nom_contact et email_pro sont requis' }, { status: 400 })
    }

    // 3. S'assurer que le profil utilisateurs existe avec le bon rôle (bypass RLS)
    const { error: userErr } = await supabaseAdmin
      .from('utilisateurs')
      .upsert({
        id:          caller.id,
        nom:         nom_contact.trim(),
        email:       email_pro.trim().toLowerCase(),
        telephone:   telephone?.trim() || null,
        role:        'partenaire',
        est_verifie: false,
        est_actif:   true,
        created_at:  new Date().toISOString(),
        updated_at:  new Date().toISOString(),
      }, { onConflict: 'id' })

    if (userErr) {
      console.warn('[create-profile] upsert utilisateurs:', userErr.message)
    }

    // 4. Vérifier si un profil partenaire existe déjà
    const { data: existing } = await supabaseAdmin
      .from('partenaires')
      .select('id')
      .eq('user_id', caller.id)
      .single()

    if (existing) {
      return NextResponse.json({ success: true, message: 'Profil partenaire déjà existant', partenaire_id: existing.id })
    }

    // 5. Créer le profil partenaire (service_role bypass RLS)
    const { data: partData, error: partErr } = await supabaseAdmin
      .from('partenaires')
      .insert({
        user_id:         caller.id,
        entreprise:      entreprise.trim(),
        nom_contact:     nom_contact.trim(),
        telephone:       telephone?.trim() || null,
        email_pro:       email_pro.trim().toLowerCase(),
        plan:            'starter',
        statut:          'en_attente',
        livraisons_max:  30,
        livraisons_mois: 0,
        taux_commission: 12.0,
        date_debut:      new Date().toISOString(),
        created_at:      new Date().toISOString(),
        updated_at:      new Date().toISOString(),
      })
      .select()
      .single()

    if (partErr) {
      return NextResponse.json({ error: `Erreur création profil partenaire: ${partErr.message}` }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: 'Profil partenaire créé. En attente de validation.',
      partenaire_id: partData.id,
    }, { status: 201 })

  } catch (err: any) {
    console.error('[partenaires/create-profile]', err)
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 })
  }
}
