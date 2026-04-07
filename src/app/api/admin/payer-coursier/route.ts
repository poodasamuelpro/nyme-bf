// src/app/api/admin/payer-coursier/route.ts
// CORRECTION : p_description → p_note (nom exact du paramètre SQL)
// Paiement d'un coursier — crédite son wallet via process_wallet_transaction
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  try {
    // 1. Vérifier l'authentification admin
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
      return NextResponse.json({ error: 'Accès refusé — rôle admin requis' }, { status: 403 })
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

    // 5. Mettre à jour total_gains dans la table coursiers
    await supabaseAdmin.rpc('process_wallet_transaction', {
      p_user_id:   coursier_id,
      p_type:      'gain',
      p_montant:   0,       // pas de crédit supplémentaire — juste pour forcer la mise à jour
      p_reference: `NOP_${Date.now()}`,
    }).then(() => {}).catch(() => {})

    // Mise à jour directe de total_gains coursiers
    const { data: wallet } = await supabaseAdmin
      .from('wallets').select('solde').eq('user_id', coursier_id).single()
    if (wallet) {
      await supabaseAdmin
        .from('coursiers')
        .update({ total_gains: Number(wallet.solde) })
        .eq('id', coursier_id)
    }

    // 6. Notifier le coursier
    const { error: notifErr } = await supabaseAdmin.from('notifications').insert({
      user_id:    coursier_id,
      type:       'paiement',
      titre:      '💰 Paiement reçu',
      message:    `Vous avez reçu ${Number(montant).toLocaleString('fr-FR')} FCFA. ${description || ''}`.trim(),
      data:       { montant, admin_id: caller.id },
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
