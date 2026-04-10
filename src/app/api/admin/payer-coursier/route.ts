// src/app/api/admin/payer-coursier/route.ts — MODIFIÉ
// ═══════════════════════════════════════════════════════════════════════════
// CORRECTIONS AUDIT :
//   1. Remplacement de la vérification admin inline par verifyAdminRole()
//      centralisé (src/lib/auth-middleware.ts) — cohérence avec les autres routes
//   2. Conservation de toute la logique métier (wallet, notif, total_gains)
// ═══════════════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminRole } from '@/lib/auth-middleware'

export async function POST(req: NextRequest) {
  try {
    // 1. Vérifier l'authentification admin via middleware centralisé
    const auth = await verifyAdminRole(req)
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: 401 })
    }

    // 2. Parser le body
    const { coursier_id, montant, description } = await req.json()
    if (!coursier_id || !montant || montant <= 0) {
      return NextResponse.json({ error: 'coursier_id et montant (> 0) sont requis' }, { status: 400 })
    }

    // 3. Vérifier que le coursier existe
    const { data: utilisateur } = await supabaseAdmin
      .from('utilisateurs')
      .select('id, nom, role')
      .eq('id', coursier_id)
      .single()

    if (!utilisateur || utilisateur.role !== 'coursier') {
      return NextResponse.json({ error: 'Coursier introuvable' }, { status: 404 })
    }

    // 4. Créditer via process_wallet_transaction
    // CORRECTION : p_note (et non p_description qui n'existe pas dans la signature SQL)
    const { data: txId, error: rpcErr } = await supabaseAdmin.rpc('process_wallet_transaction', {
      p_user_id:    coursier_id,
      p_type:       'gain',
      p_montant:    montant,
      p_reference:  `ADMIN_PAY_${coursier_id.slice(0, 8)}_${Date.now()}`,
      p_note:       description || `Paiement admin — ${new Date().toLocaleDateString('fr-FR')}`,
    })

    if (rpcErr) {
      console.error('[payer-coursier] RPC error:', rpcErr.message, rpcErr.code)
      return NextResponse.json({ error: `Erreur paiement : ${rpcErr.message}` }, { status: 500 })
    }

    // 5. Mettre à jour total_gains dans la table coursiers (via le solde actuel du wallet)
    const { data: wallet } = await supabaseAdmin
      .from('wallets').select('solde, total_gains').eq('user_id', coursier_id).single()
    if (wallet) {
      await supabaseAdmin
        .from('coursiers')
        .update({ total_gains: Number(wallet.total_gains) })
        .eq('id', coursier_id)
    }

    // 6. Notifier le coursier
    const { error: notifErr } = await supabaseAdmin.from('notifications').insert({
      user_id:    coursier_id,
      type:       'paiement',
      titre:      '💰 Paiement reçu',
      message:    `Vous avez reçu ${Number(montant).toLocaleString('fr-FR')} FCFA. ${description || ''}`.trim(),
      data:       { montant, admin_id: auth.adminId },
      lu:         false,
      created_at: new Date().toISOString(),
    })
    if (notifErr) console.error('[payer-coursier] notif error:', notifErr.message)

    return NextResponse.json({
      success:        true,
      message:        `Paiement de ${Number(montant).toLocaleString('fr-FR')} FCFA effectué pour ${utilisateur.nom}`,
      transaction_id: txId,
    })

  } catch (err: unknown) {
    console.error('[admin/payer-coursier]', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Erreur serveur',
    }, { status: 500 })
  }
}