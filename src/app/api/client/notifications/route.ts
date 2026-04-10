// src/app/api/client/notifications/route.ts — NOUVEAU FICHIER
// GET  /api/client/notifications  → liste des notifications
// PATCH /api/client/notifications  → marquer comme lues (une ou toutes)
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'

// GET — Récupérer les notifications du client connecté
export async function GET(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const url    = new URL(req.url)
    const limit  = parseInt(url.searchParams.get('limit') || '50')
    const unread = url.searchParams.get('unread') === 'true'

    let query = supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 100))

    if (unread) query = query.eq('lu', false)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({
      notifications: data || [],
      total:         data?.length || 0,
      unread_count:  unread ? data?.length || 0 : (data || []).filter(n => !n.lu).length,
    })

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur' }, { status: 500 })
  }
}

// PATCH — Marquer une ou toutes les notifications comme lues
export async function PATCH(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await req.json()
    const { notif_id, mark_all } = body

    if (mark_all) {
      // Marquer toutes les notifications non lues comme lues
      const { error } = await supabaseAdmin
        .from('notifications')
        .update({ lu: true })
        .eq('user_id', session.user.id)
        .eq('lu', false)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, action: 'all_marked_read' })
    }

    if (!notif_id) {
      return NextResponse.json({ error: 'notif_id ou mark_all requis' }, { status: 400 })
    }

    // Marquer une notification spécifique comme lue (vérifier qu'elle appartient au user)
    const { error } = await supabaseAdmin
      .from('notifications')
      .update({ lu: true })
      .eq('id', notif_id)
      .eq('user_id', session.user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, action: 'notification_marked_read', notif_id })

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur' }, { status: 500 })
  }
}

// DELETE — Supprimer une notification
export async function DELETE(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const body = await req.json()
    const { notif_id } = body
    if (!notif_id) return NextResponse.json({ error: 'notif_id requis' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('notifications')
      .delete()
      .eq('id', notif_id)
      .eq('user_id', session.user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, notif_id })

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur' }, { status: 500 })
  }
}