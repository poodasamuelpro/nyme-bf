// src/app/api/admin/clients/route.ts
// Gestion des clients — liste et toggle actif/inactif

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

async function verifyAdmin(req: Request): Promise<{ ok: boolean; error?: string }> {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
  if (!token) return { ok: false, error: 'Non autorisé' }

  const supabaseCheck = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
  const { data: { user } } = await supabaseCheck.auth.getUser(token)
  if (!user) return { ok: false, error: 'Non authentifié' }

  const { data } = await supabaseAdmin
    .from('utilisateurs').select('role').eq('id', user.id).single()
  if (data?.role !== 'admin') return { ok: false, error: 'Accès refusé' }

  return { ok: true }
}

export async function GET(req: Request) {
  try {
    const auth = await verifyAdmin(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const url = new URL(req.url)
    const role = url.searchParams.get('role') || 'client'
    const limit = parseInt(url.searchParams.get('limit') || '200')

    const { data: clients, error } = await supabaseAdmin
      .from('utilisateurs')
      .select('id, nom, email, telephone, role, est_actif, est_verifie, created_at, avatar_url, note_moyenne')
      .eq('role', role)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({
      clients,
      total: clients?.length || 0,
      actifs: clients?.filter(c => c.est_actif).length || 0,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await verifyAdmin(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const { user_id, est_actif } = await req.json()
    if (!user_id || typeof est_actif !== 'boolean') {
      return NextResponse.json({ error: 'user_id et est_actif (boolean) requis' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('utilisateurs')
      .update({ est_actif, updated_at: new Date().toISOString() })
      .eq('id', user_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({
      success: true,
      message: `Utilisateur ${est_actif ? 'activé' : 'désactivé'}`,
      utilisateur: data,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
