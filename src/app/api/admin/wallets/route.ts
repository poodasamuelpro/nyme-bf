// src/app/api/admin/wallets/route.ts — MODIFIÉ
// ═══════════════════════════════════════════════════════════════════════════
// CORRECTIONS AUDIT :
//   1. Remplacement de verifyAdmin() dupliqué par verifyAdminRole() centralisé
//   2. Ajout de la pagination (limit + offset) sur la liste des wallets
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminRole } from '@/lib/auth-middleware'

export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRole(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const limit  = Math.min(parseInt(searchParams.get('limit')  || '50'), 200)
    const offset = parseInt(searchParams.get('offset') || '0')

    // Récupérer les wallets paginés avec infos utilisateurs
    const { data: wallets, error, count } = await supabaseAdmin
      .from('wallets')
      .select(
        '*, utilisateurs(id, nom, email, role, telephone, est_actif)',
        { count: 'exact' }
      )
      .order('solde', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Calculer les totaux globaux (sur toute la table, pas juste la page)
    const { data: totauxData } = await supabaseAdmin
      .from('wallets')
      .select('solde, total_gains, total_retraits')

    const totaux = {
      wallets:        count ?? 0,
      solde_total:    totauxData?.reduce((acc, w) => acc + Number(w.solde || 0), 0) || 0,
      gains_total:    totauxData?.reduce((acc, w) => acc + Number(w.total_gains || 0), 0) || 0,
      retraits_total: totauxData?.reduce((acc, w) => acc + Number(w.total_retraits || 0), 0) || 0,
    }

    return NextResponse.json({
      wallets:     wallets || [],
      totaux,
      page_size:   limit,
      page_offset: offset,
      has_more:    (count ?? 0) > offset + limit,
    })

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdminRole(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const { user_id, operation, montant, description } = await req.json()

    if (!user_id || !operation || !montant || Number(montant) <= 0) {
      return NextResponse.json({ error: 'user_id, operation (credit|debit) et montant (> 0) requis' }, { status: 400 })
    }
    if (!['credit', 'debit'].includes(operation)) {
      return NextResponse.json({ error: 'operation doit être "credit" ou "debit"' }, { status: 400 })
    }

    const montantNum = Number(montant)

    // Récupérer ou créer le wallet
    let wallet: { id: string; solde: number; total_gains: number; total_retraits: number } | null = null
    const { data: existingWallet } = await supabaseAdmin
      .from('wallets')
      .select('id, solde, total_gains, total_retraits')
      .eq('user_id', user_id)
      .single()

    if (!existingWallet) {
      const { data: newWallet, error: createErr } = await supabaseAdmin
        .from('wallets')
        .insert({ user_id, solde: 0, total_gains: 0, total_retraits: 0, updated_at: new Date().toISOString() })
        .select('id, solde, total_gains, total_retraits')
        .single()
      if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 })
      wallet = newWallet
    } else {
      wallet = existingWallet
    }

    const soldeAvant = Number(wallet!.solde || 0)
    const soldeApres = operation === 'credit'
      ? soldeAvant + montantNum
      : soldeAvant - montantNum

    if (soldeApres < 0) {
      return NextResponse.json({
        error: `Solde insuffisant. Solde actuel : ${soldeAvant.toLocaleString('fr-FR')} FCFA`,
      }, { status: 400 })
    }

    // Mise à jour wallet via RPC pour atomicité
    const ref = `ADMIN_${operation.toUpperCase()}_${user_id.slice(0, 8)}_${Date.now()}`
    const { error: rpcErr } = await supabaseAdmin.rpc('process_wallet_transaction', {
      p_user_id:        user_id,
      p_type:           operation === 'credit' ? 'gain' : 'retrait',
      p_montant:        operation === 'credit' ? montantNum : -montantNum,
      p_reference:      ref,
      p_note:           description || `Ajustement admin — ${operation} — ${new Date().toLocaleDateString('fr-FR')}`,
      p_payment_method: 'virement_bancaire',
    })

    if (rpcErr) {
      return NextResponse.json({ error: `Erreur transaction : ${rpcErr.message}` }, { status: 500 })
    }

    return NextResponse.json({
      success:       true,
      solde_avant:   soldeAvant,
      nouveau_solde: soldeApres,
      operation,
      montant:       montantNum,
      reference:     ref,
    })

  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}