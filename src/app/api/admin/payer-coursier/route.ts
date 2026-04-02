// src/app/api/admin/payer-coursier/route.ts
// Paiement d'un coursier — crédite son wallet
// Structure réelle Supabase :
//   wallets             : id, user_id, solde, total_gains, total_retraits, updated_at
//   transactions_wallet : id, user_id, type, montant, solde_avant, solde_apres,
//                         livraison_id, reference, note, created_at

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

    // 4. Essayer d'abord la fonction SQL process_wallet_transaction si elle existe
    try {
      const { data: txId, error: rpcErr } = await supabaseAdmin.rpc('process_wallet_transaction', {
        p_user_id:    coursier_id,
        p_type:       'gain',
        p_montant:    montant,
        p_description: description || `Paiement admin — ${new Date().toLocaleDateString('fr-FR')}`,
      })
      if (!rpcErr && txId) {
        // Notifier le coursier
        await supabaseAdmin.from('notifications').insert({
          user_id: coursier_id, type: 'paiement',
          titre: '💰 Paiement reçu',
          message: `Vous avez reçu ${Number(montant).toLocaleString('fr-FR')} FCFA. ${description || ''}`.trim(),
          lu: false, created_at: new Date().toISOString(),
        }).catch(error => {
          console.error('Erreur notification:', error)
        })
        return NextResponse.json({ success: true, message: `Paiement de ${montant} FCFA effectué pour ${utilisateur.nom}`, transaction_id: txId })
      }
    } catch {}

    // 5. Fallback manuel — récupérer ou créer le wallet (lié à user_id)
    let wallet: any
    const { data: existingWallet } = await supabaseAdmin
      .from('wallets').select('id, solde, total_gains, total_retraits').eq('user_id', coursier_id).single()

    if (!existingWallet) {
      const { data: newWallet, error: createErr } = await supabaseAdmin
        .from('wallets')
        .insert({ user_id: coursier_id, solde: 0, updated_at: new Date().toISOString() })
        .select().single()
      if (createErr) return NextResponse.json({ error: `Erreur création wallet: ${createErr.message}` }, { status: 400 })
      wallet = newWallet
    } else {
      wallet = existingWallet
    }

    const soldeAvant  = Number(wallet.solde || 0)
    const soldeApres  = soldeAvant + Number(montant)

    // 6. Mettre à jour le wallet
    const { error: updateErr } = await supabaseAdmin
      .from('wallets')
      .update({
        solde:          soldeApres,
        total_gains:    Number(wallet.total_gains || 0) + Number(montant),
        updated_at:     new Date().toISOString(),
      })
      .eq('user_id', coursier_id)

    if (updateErr) {
      return NextResponse.json({ error: `Erreur mise à jour wallet: ${updateErr.message}` }, { status: 400 })
    }

    // 7. Enregistrer la transaction (structure réelle : user_id, solde_avant, solde_apres)
    const { data: tx } = await supabaseAdmin
      .from('transactions_wallet')
      .insert({
        user_id:     coursier_id,
        type:        'gain',
        montant:     Number(montant),
        solde_avant: soldeAvant,
        solde_apres: soldeApres,
        note:        description || `Paiement admin — ${new Date().toLocaleDateString('fr-FR')}`,
        created_at:  new Date().toISOString(),
      })
      .select().single()

    // 8. Mettre à jour total_gains dans coursiers aussi
    await supabaseAdmin
      .from('coursiers')
      .update({ total_gains: soldeApres })
      .eq('id', coursier_id)
      .catch(error => {
        console.error('Erreur update coursiers:', error)
      })

    // 9. Notifier le coursier
    await supabaseAdmin.from('notifications').insert({
      user_id: coursier_id, type: 'paiement',
      titre: '💰 Paiement reçu',
      message: `Vous avez reçu ${Number(montant).toLocaleString('fr-FR')} FCFA. Nouveau solde : ${soldeApres.toLocaleString('fr-FR')} FCFA.`,
      lu: false, created_at: new Date().toISOString(),
    }).catch(error => {
      console.error('Erreur notification finale:', error)
    })

    return NextResponse.json({
      success:       true,
      message:       `Paiement de ${montant} FCFA effectué pour ${utilisateur.nom}`,
      solde_avant:   soldeAvant,
      nouveau_solde: soldeApres,
      transaction_id: tx?.id,
    })

  } catch (err: any) {
    console.error('[admin/payer-coursier]', err)
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 })
  }
}