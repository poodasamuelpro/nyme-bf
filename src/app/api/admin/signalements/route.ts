// src/app/api/admin/signalements/route.ts — MODIFIÉ
// ═══════════════════════════════════════════════════════════════════════════
// CORRECTIONS AUDIT :
//   1. Remplacement de verifyAdmin() dupliqué par verifyAdminRole() centralisé
//   2. Ajout de la pagination (limit + offset) sur la liste des signalements
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminRole } from '@/lib/auth-middleware'

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRole(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const statut = searchParams.get('statut')
    const limit  = Math.min(parseInt(searchParams.get('limit')  || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')

    let query = supabaseAdmin
      .from('signalements')
      .select(
        `
          *,
          signalant:utilisateurs!signalements_signalant_id_fkey(nom, email, role),
          signale:utilisateurs!signalements_signale_id_fkey(nom, email, role)
        `,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (statut) query = query.eq('statut', statut)

    const { data, error, count } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      signalements: data || [],
      total:        count ?? 0,
      page_size:    limit,
      page_offset:  offset,
      has_more:     (count ?? 0) > offset + limit,
    })

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await verifyAdminRole(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const { id, statut, commentaire } = await req.json()

    if (!id || !statut) return NextResponse.json({ error: 'id et statut requis' }, { status: 400 })
    if (!['traite', 'rejete'].includes(statut)) {
      return NextResponse.json({ error: 'statut invalide — valeurs : traite | rejete' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('signalements')
      .update({
        statut,
        traite_par: auth.adminId,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Notifier le signalant du traitement
    if (data.signalant_id) {
      await supabaseAdmin.from('notifications').insert({
        user_id: data.signalant_id,
        type:    'signalement',
        titre:   statut === 'traite' ? '✅ Signalement traité' : '❌ Signalement clôturé',
        message: commentaire || (
          statut === 'traite'
            ? 'Votre signalement a été examiné et les mesures appropriées ont été prises.'
            : 'Votre signalement a été examiné. Aucune mesure supplémentaire n\'est nécessaire.'
        ),
        data:    { signalement_id: id, statut },
        lu:      false,
      })
    }

    return NextResponse.json({ success: true, signalement: data })

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}