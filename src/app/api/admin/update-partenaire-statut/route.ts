// src/app/api/admin/update-partenaire-statut/route.ts
// Met à jour le statut d'un partenaire (actif / suspendu / rejete / en_attente) 
// Admin seulement

import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    // Auth admin
    const token = (req.headers.get('authorization') || '').replace('Bearer ', '').trim()
    if (!token) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const supabaseCheck = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
    const { data: { user: caller } } = await supabaseCheck.auth.getUser(token)
    if (!caller) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { data: callerRow } = await supabaseAdmin
      .from('utilisateurs').select('role').eq('id', caller.id).single()
    if (callerRow?.role !== 'admin') {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const { partenaire_id, statut } = await req.json()

    if (!partenaire_id || !statut) {
      return NextResponse.json({ error: 'partenaire_id et statut requis' }, { status: 400 })
    }

    const statutsValides = ['actif', 'suspendu', 'en_attente', 'rejete']
    if (!statutsValides.includes(statut)) {
      return NextResponse.json({ error: `Statut invalide. Valeurs: ${statutsValides.join(', ')}` }, { status: 400 })
    }

    const { data, error: updErr } = await supabaseAdmin
      .from('partenaires')
      .update({ statut, updated_at: new Date().toISOString() })
      .eq('id', partenaire_id)
      .select()
      .single()

    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 })
    }

    // Notifier le partenaire
    try {
      const messageMap: Record<string, string> = {
        actif:      '🎉 Votre compte partenaire est maintenant actif ! Vous pouvez commencer à utiliser nos services.',
        suspendu:   '⚠️ Votre compte partenaire a été suspendu. Contactez nyme.contact@gmail.com.',
        rejete:     '❌ Votre demande de partenariat a été rejetée. Contactez nyme.contact@gmail.com.',
        en_attente: 'ℹ️ Votre compte est en cours de révision.',
      }
      await supabaseAdmin.from('notifications').insert({
        user_id:    data.user_id,
        type:       'statut_partenaire',
        titre:      'Mise à jour de votre compte',
        message:    messageMap[statut] || `Votre statut a été mis à jour : ${statut}`,
        lu:         false,
        created_at: new Date().toISOString(),
      })
    } catch {}

    return NextResponse.json({ success: true, partenaire: data })

  } catch (err: any) {
    console.error('[update-partenaire-statut]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
