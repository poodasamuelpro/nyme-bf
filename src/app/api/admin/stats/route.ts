// src/app/api/admin/stats/route.ts
// ══════════════════════════════════════════════════════════════════
// STATISTIQUES ADMIN — NYME
// GET /api/admin/stats
// Retourne les KPIs principaux pour le dashboard admin
// CORRECTION AUDIT : verifyAdmin inline → verifyAdminRole (middleware centralisé)
// ══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminRole } from '@/lib/auth-middleware'

export async function GET(req: NextRequest) {
  try {
    // ── Authentification centralisée ─────────────────────────────
    const auth = await verifyAdminRole(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const now  = new Date()
    const y    = now.getFullYear()
    const m    = String(now.getMonth() + 1).padStart(2, '0')
    const debutMois = `${y}-${m}-01T00:00:00.000Z`

    const [
      { count: totalUtilisateurs },
      { count: totalCoursiers },
      { count: totalLivraisons },
      { count: livraisonsMois },
      { count: livreeMois },
      { data: walletData },
      { data: livsByStatut },
      { data: revenuMois },
    ] = await Promise.all([
      supabaseAdmin.from('utilisateurs').select('*', { count: 'exact', head: true }).eq('role', 'client'),
      supabaseAdmin.from('coursiers').select('*', { count: 'exact', head: true }).eq('statut_verification', 'verifie'),
      supabaseAdmin.from('livraisons').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('livraisons').select('*', { count: 'exact', head: true }).gte('created_at', debutMois),
      supabaseAdmin.from('livraisons').select('*', { count: 'exact', head: true }).eq('statut', 'livree').gte('created_at', debutMois),
      supabaseAdmin.from('wallets').select('solde, total_gains, total_retraits'),
      supabaseAdmin.from('livraisons').select('statut').gte('created_at', debutMois),
      supabaseAdmin.from('livraisons').select('prix_final, commission_nyme').eq('statut', 'livree').gte('created_at', debutMois),
    ])

    // Calculs finances
    const totalSoldes       = (walletData || []).reduce((s, w) => s + (w.solde || 0), 0)
    const totalGains        = (walletData || []).reduce((s, w) => s + (w.total_gains || 0), 0)
    const totalRetraits     = (walletData || []).reduce((s, w) => s + (w.total_retraits || 0), 0)
    const caMois            = (revenuMois || []).reduce((s, l) => s + (l.prix_final || 0), 0)
    const commissionsMois   = (revenuMois || []).reduce((s, l) => s + (l.commission_nyme || 0), 0)

    // Distribution statuts livraisons ce mois
    const statutsDistrib: Record<string, number> = {}
    for (const l of livsByStatut || []) {
      statutsDistrib[l.statut] = (statutsDistrib[l.statut] || 0) + 1
    }

    // Taux de succès livraisons ce mois
    const tauxSucces = livraisonsMois && livraisonsMois > 0
      ? Math.round(((livreeMois || 0) / livraisonsMois) * 100)
      : 0

    return NextResponse.json({
      success: true,
      stats: {
        utilisateurs: {
          total_clients:     totalUtilisateurs || 0,
          total_coursiers:   totalCoursiers    || 0,
        },
        livraisons: {
          total:          totalLivraisons || 0,
          ce_mois:        livraisonsMois  || 0,
          livrees_mois:   livreeMois      || 0,
          taux_succes:    tauxSucces,
          par_statut:     statutsDistrib,
        },
        finances: {
          ca_mois:           caMois,
          commissions_mois:  commissionsMois,
          total_soldes:      totalSoldes,
          total_gains:       totalGains,
          total_retraits:    totalRetraits,
        },
        periode: {
          debut_mois: debutMois,
          mois:       `${y}-${m}`,
        },
      },
    })

  } catch (err: unknown) {
    console.error('[api/admin/stats]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}