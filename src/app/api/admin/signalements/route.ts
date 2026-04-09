// src/app/api/admin/signalements/route.ts
// ══════════════════════════════════════════════════════════════════
// GESTION SIGNALEMENTS — NYME ADMIN
// GET    → lister tous les signalements
// PUT    → traiter / rejeter un signalement
// ══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

async function verifyAdmin(req: NextRequest): Promise<{ ok: boolean; error?: string; adminId?: string }> {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return { ok: false, error: 'Token manquant' }
  const supabaseCheck = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
  const { data: { user } } = await supabaseCheck.auth.getUser(token)
  if (!user) return { ok: false, error: 'Non authentifié' }
  const { data } = await supabaseAdmin.from('utilisateurs').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return { ok: false, error: 'Accès refusé' }
  return { ok: true, adminId: user.id }
}

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdmin(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const statut = searchParams.get('statut')
    const limit  = parseInt(searchParams.get('limit') || '50')

    let query = supabaseAdmin
      .from('signalements')
      .select(`
        *,
        signalant:utilisateurs!signalements_signalant_id_fkey(nom, email, role),
        signale:utilisateurs!signalements_signale_id_fkey(nom, email, role)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (statut) query = query.eq('statut', statut)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ signalements: data || [], total: data?.length || 0 })

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await verifyAdmin(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const { id, statut, commentaire } = await req.json()

    if (!id || !statut) return NextResponse.json({ error: 'id et statut requis' }, { status: 400 })
    if (!['traite', 'rejete'].includes(statut)) {
      return NextResponse.json({ error: 'statut invalide — traite ou rejete' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('signalements')
      .update({
        statut,
        traite_par:  auth.adminId,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Notifier le signalant
    if (data.signalant_id) {
      await supabaseAdmin.from('notifications').insert({
        user_id: data.signalant_id,
        type:    'signalement',
        titre:   statut === 'traite' ? '✅ Signalement traité' : '❌ Signalement clôturé',
        message: commentaire || (statut === 'traite' ? 'Votre signalement a été examiné et traité.' : 'Votre signalement a été examiné.'),
        data:    { signalement_id: id, statut },
        lu:      false,
      })
    }

    return NextResponse.json({ success: true, signalement: data })

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}