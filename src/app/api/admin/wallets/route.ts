// src/app/api/admin/wallets/route.ts
// Gestion des wallets — liste tous les wallets avec infos utilisateurs 
// Structure réelle Supabase :
//   wallets : id, user_id, solde, total_gains(?), total_retraits(?), updated_at, created_at(?)
//   transactions_wallet : id, user_id, type, montant, solde_avant, solde_apres,
//                         livraison_id, reference, note, created_at

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

    // Récupérer les wallets avec les infos utilisateurs
    const { data: wallets, error } = await supabaseAdmin
      .from('wallets')
      .select('*, utilisateurs(id, nom, email, role, telephone, est_actif)')
      .order('solde', { ascending: false })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Calculer les totaux
    const totaux = {
      wallets:        wallets?.length || 0,
      solde_total:    wallets?.reduce((acc, w) => acc + Number(w.solde || 0), 0) || 0,
      gains_total:    wallets?.reduce((acc, w) => acc + Number(w.total_gains || 0), 0) || 0,
      retraits_total: wallets?.reduce((acc, w) => acc + Number(w.total_retraits || 0), 0) || 0,
    }

    return NextResponse.json({ wallets, totaux })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await verifyAdmin(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const { user_id, operation, montant, description } = await req.json()

    if (!user_id || !operation || !montant || montant <= 0) {
      return NextResponse.json({ error: 'user_id, operation (credit|debit) et montant requis' }, { status: 400 })
    }
    if (!['credit', 'debit'].includes(operation)) {
      return NextResponse.json({ error: 'operation doit être "credit" ou "debit"' }, { status: 400 })
    }

    // Récupérer ou créer le wallet
    let wallet: any
    const { data: existingWallet } = await supabaseAdmin
      .from('wallets').select('*').eq('user_id', user_id).single()

    if (!existingWallet) {
      const { data: newWallet, error: createErr } = await supabaseAdmin
        .from('wallets')
        .insert({ user_id, solde: 0, updated_at: new Date().toISOString() })
        .select().single()
      if (createErr) return NextResponse.json({ error: createErr.message }, { status: 400 })
      wallet = newWallet
    } else {
      wallet = existingWallet
    }

    const soldeAvant = Number(wallet.solde || 0)
    const soldeApres = operation === 'credit' ? soldeAvant + Number(montant) : soldeAvant - Number(montant)

    if (soldeApres < 0) {
      return NextResponse.json({ error: `Solde insuffisant. Solde actuel: ${soldeAvant.toLocaleString('fr-FR')} FCFA` }, { status: 400 })
    }

    // Mettre à jour le wallet
    const updateData: Record<string, any> = { solde: soldeApres, updated_at: new Date().toISOString() }
    if (operation === 'credit') updateData.total_gains = Number(wallet.total_gains || 0) + Number(montant)
    if (operation === 'debit')  updateData.total_retraits = Number(wallet.total_retraits || 0) + Number(montant)

    await supabaseAdmin.from('wallets').update(updateData).eq('user_id', user_id)

    // Enregistrer la transaction avec la structure réelle (user_id, solde_avant, solde_apres)
    await supabaseAdmin.from('transactions_wallet').insert({
      user_id,
      type:        operation === 'credit' ? 'gain' : 'retrait',
      montant:     Number(montant),
      solde_avant: soldeAvant,
      solde_apres: soldeApres,
      note:        description || `Ajustement admin — ${operation} — ${new Date().toLocaleDateString('fr-FR')}`,
      created_at:  new Date().toISOString(),
    })

    return NextResponse.json({
      success: true,
      solde_avant: soldeAvant,
      nouveau_solde: soldeApres,
      operation,
      montant,
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
