// src/app/api/admin/remboursements/route.ts  [NOUVEAU FICHIER]
// ══════════════════════════════════════════════════════════════════
// GESTION REMBOURSEMENTS — ADMIN NYME
// POST /api/admin/remboursements
// GET  /api/admin/remboursements
//
// POST — Déclenche un remboursement :
//   livraison_id  UUID  livraison à rembourser
//   motif         string  raison (optionnel)
//   montant       number  montant à rembourser (défaut = prix_final)
//
// GET — Liste les livraisons avec statut_paiement = 'rembourse'
//   page, limit, date_debut, date_fin
// ══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminRole } from '@/lib/auth-middleware'
import { sendEmail, buildPaymentEmail } from '@/lib/email'

// ── GET — Lister les remboursements ───────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRole(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const page     = Math.max(1, parseInt(searchParams.get('page')  || '1',  10))
    const limit    = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))
    const dateDeb  = searchParams.get('date_debut') || null
    const dateFin  = searchParams.get('date_fin')   || null
    const from     = (page - 1) * limit
    const to       = from + limit - 1

    let query = supabaseAdmin
      .from('livraisons')
      .select(`
        id, statut, statut_paiement, mode_paiement,
        prix_final, commission_nyme,
        depart_adresse, arrivee_adresse,
        created_at, livree_at, annulee_at, annulee_par,
        client:client_id(id, nom, telephone, email),
        coursier:coursier_id(id, nom, telephone)
      `, { count: 'exact' })
      .eq('statut_paiement', 'rembourse')

    if (dateDeb) query = query.gte('created_at', dateDeb)
    if (dateFin) query = query.lte('created_at', dateFin + 'T23:59:59.999Z')

    query = query.order('updated_at', { ascending: false }).range(from, to)

    const { data, count, error } = await query

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    // Calcul du total remboursé
    const { data: totaux } = await supabaseAdmin
      .from('livraisons')
      .select('prix_final')
      .eq('statut_paiement', 'rembourse')

    const totalRembourse = (totaux || []).reduce((s, l) => s + (l.prix_final || 0), 0)

    return NextResponse.json({
      success: true,
      data: data || [],
      pagination: {
        total:       count || 0,
        page,
        limit,
        total_pages: Math.ceil((count || 0) / limit),
      },
      total_rembourse: totalRembourse,
    })

  } catch (err: unknown) {
    console.error('[api/admin/remboursements GET]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}

// ── POST — Déclencher un remboursement ────────────────────────────
export async function POST(req: NextRequest) {
  try {
    // ── 1. Authentification admin ─────────────────────────────────
    const auth = await verifyAdminRole(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const adminId = auth.adminId!

    // ── 2. Body ───────────────────────────────────────────────────
    const { livraison_id, motif, montant: montantOverride } = await req.json()

    if (!livraison_id) {
      return NextResponse.json({ error: 'livraison_id requis' }, { status: 400 })
    }

    // ── 3. Récupérer la livraison ─────────────────────────────────
    const { data: livraison, error: livErr } = await supabaseAdmin
      .from('livraisons')
      .select(`
        id, client_id, statut, statut_paiement,
        mode_paiement, prix_final, prix_calcule,
        depart_adresse, arrivee_adresse
      `)
      .eq('id', livraison_id)
      .single()

    if (livErr || !livraison) {
      return NextResponse.json({ error: 'Livraison introuvable' }, { status: 404 })
    }

    // Empêcher double remboursement
    if (livraison.statut_paiement === 'rembourse') {
      return NextResponse.json({ error: 'Cette livraison a déjà été remboursée' }, { status: 400 })
    }

    // Seules les livraisons payées peuvent être remboursées
    if (livraison.statut_paiement !== 'paye') {
      return NextResponse.json({
        error: `Impossible de rembourser une livraison avec statut_paiement = "${livraison.statut_paiement}". Statut requis : "paye".`,
      }, { status: 400 })
    }

    // ── 4. Calcul du montant à rembourser ─────────────────────────
    const montantMax = Number(livraison.prix_final || livraison.prix_calcule || 0)
    const montant    = montantOverride && montantOverride > 0
      ? Math.min(Number(montantOverride), montantMax)
      : montantMax

    if (montant <= 0) {
      return NextResponse.json({ error: 'Montant du remboursement invalide (doit être > 0)' }, { status: 400 })
    }

    const now       = new Date().toISOString()
    const reference = `REFUND_ADMIN_${livraison_id.replace(/-/g,'').slice(0,8)}_${Date.now()}`

    // ── 5. Remboursement wallet (mode wallet ou par décision admin) ─
    let walletCredite = false

    if (livraison.mode_paiement === 'wallet') {
      const { error: rpcErr } = await supabaseAdmin.rpc('process_wallet_transaction', {
        p_user_id:   livraison.client_id,
        p_type:      'remboursement',
        p_montant:   montant,       // positif = crédit
        p_reference: reference,
        p_note:      motif
          ? `Remboursement admin — ${motif} — Livraison #${livraison_id.slice(0,8).toUpperCase()}`
          : `Remboursement admin — Livraison #${livraison_id.slice(0,8).toUpperCase()}`,
      })

      if (rpcErr) {
        console.error('[remboursements] RPC erreur:', rpcErr.message)
        return NextResponse.json({ error: `Erreur crédit wallet : ${rpcErr.message}` }, { status: 500 })
      }
      walletCredite = true
    }

    // ── 6. Mettre à jour le statut_paiement → rembourse ──────────
    const { error: updErr } = await supabaseAdmin
      .from('livraisons')
      .update({
        statut_paiement: 'rembourse',
        updated_at:      now,
      })
      .eq('id', livraison_id)

    if (updErr) {
      return NextResponse.json({ error: `Erreur mise à jour statut : ${updErr.message}` }, { status: 500 })
    }

    // ── 7. Log admin (notification admin) ─────────────────────────
    try {
      await supabaseAdmin.from('notifications').insert({
        user_id:    adminId,
        type:       'remboursement_admin',
        titre:      `💰 Remboursement effectué — ${montant.toLocaleString('fr-FR')} XOF`,
        message:    `Livraison #${livraison_id.slice(0,8).toUpperCase()} remboursée (${montant.toLocaleString('fr-FR')} XOF).${motif ? ` Motif : ${motif}` : ''}`,
        lu:         false,
        created_at: now,
      })
    } catch { /* non bloquant */ }

    // ── 8. Notification in-app au client ──────────────────────────
    try {
      await supabaseAdmin.from('notifications').insert({
        user_id:    livraison.client_id,
        type:       'remboursement',
        titre:      `🔄 Remboursement de ${montant.toLocaleString('fr-FR')} XOF`,
        message:    walletCredite
          ? `Un remboursement de ${montant.toLocaleString('fr-FR')} XOF a été crédité sur votre wallet pour la livraison #${livraison_id.slice(0,8).toUpperCase()}.${motif ? ` Motif : ${motif}` : ''}`
          : `Un remboursement de ${montant.toLocaleString('fr-FR')} XOF a été initié pour votre livraison #${livraison_id.slice(0,8).toUpperCase()}.${motif ? ` Motif : ${motif}` : ''}`,
        data:       { livraison_id, montant, reference },
        lu:         false,
        created_at: now,
      })
    } catch { /* non bloquant */ }

    // ── 9. Email au client ────────────────────────────────────────
    try {
      const { data: clientUser } = await supabaseAdmin
        .from('utilisateurs')
        .select('nom, email')
        .eq('id', livraison.client_id)
        .single()

      if (clientUser?.email) {
        await sendEmail({
          to:      clientUser.email,
          toName:  clientUser.nom || 'Client',
          subject: `🔄 Remboursement ${montant.toLocaleString('fr-FR')} XOF — NYME`,
          html:    buildPaymentEmail({
            nom:         clientUser.nom || 'Client',
            montant,
            mode:        livraison.mode_paiement || 'wallet',
            livraisonId: livraison_id,
            statut:      'rembourse',
          }),
        })
      }
    } catch (emailErr) {
      console.warn('[remboursements] Email client échoué:', emailErr)
    }

    // ── 10. Réponse ───────────────────────────────────────────────
    return NextResponse.json({
      success:        true,
      message:        `✅ Remboursement de ${montant.toLocaleString('fr-FR')} XOF effectué${walletCredite ? ' et crédité sur le wallet du client' : ''}.`,
      livraison_id,
      montant,
      reference,
      wallet_credite: walletCredite,
    })

  } catch (err: unknown) {
    console.error('[api/admin/remboursements POST]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}