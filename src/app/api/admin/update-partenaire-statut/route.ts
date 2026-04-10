// src/app/api/admin/update-partenaire-statut/route.ts
// Met à jour le statut d'un partenaire (actif / suspendu / rejete / en_attente)
// Admin seulement
// CORRECTION AUDIT : vérification inline → verifyAdminRole (middleware centralisé)
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminRole } from '@/lib/auth-middleware'

export async function POST(req: NextRequest) {
  try {
    // ── Authentification centralisée ─────────────────────────────
    const auth = await verifyAdminRole(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

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

    // Notifier le partenaire (in-app)
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
    } catch { /* notification non bloquante */ }

    return NextResponse.json({ success: true, partenaire: data })

  } catch (err: unknown) {
    console.error('[update-partenaire-statut]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}