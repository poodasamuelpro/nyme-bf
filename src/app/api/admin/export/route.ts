// src/app/api/admin/export/route.ts  [NOUVEAU FICHIER]
// ══════════════════════════════════════════════════════════════════
// EXPORT CSV/EXCEL ADMIN — NYME
// GET /api/admin/export?type=livraisons&format=csv
//
// Paramètres :
//   type     → livraisons | utilisateurs | gains | remboursements
//   format   → csv (seul format supporté, Excel = CSV compatible)
//   date_debut → filtre date début
//   date_fin   → filtre date fin
//   statut     → filtre statut (pour livraisons)
//
// Le CSV généré est encodé UTF-8 avec BOM pour compatibilité Excel
// ══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminRole } from '@/lib/auth-middleware'

// Helper : échapper une cellule CSV
function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return ''
  const s = String(val)
  // Si contient virgule, guillemets ou saut de ligne → encadrer
  if (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

// Helper : construire une ligne CSV
function csvRow(cells: unknown[]): string {
  return cells.map(csvEscape).join(',')
}

// ── Formatage date pour export ─────────────────────────────────────
function fmtDate(d?: string | null): string {
  if (!d) return ''
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(d))
}

export async function GET(req: NextRequest) {
  try {
    // ── 1. Authentification admin ─────────────────────────────────
    const auth = await verifyAdminRole(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const type     = searchParams.get('type')       || 'livraisons'
    const format   = searchParams.get('format')     || 'csv'
    const dateDeb  = searchParams.get('date_debut') || null
    const dateFin  = searchParams.get('date_fin')   || null
    const statut   = searchParams.get('statut')     || null

    if (format !== 'csv') {
      return NextResponse.json({ error: 'Seul le format csv est supporté' }, { status: 400 })
    }

    const typesValides = ['livraisons', 'utilisateurs', 'gains', 'remboursements']
    if (!typesValides.includes(type)) {
      return NextResponse.json({ error: `type invalide. Valeurs : ${typesValides.join(', ')}` }, { status: 400 })
    }

    let csvContent = ''
    const now = new Date()
    const dateStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    const filename = `nyme_${type}_${dateStr}.csv`

    // ── 2. Export LIVRAISONS ──────────────────────────────────────
    if (type === 'livraisons') {
      let q = supabaseAdmin
        .from('livraisons')
        .select(`
          id, statut, type,
          depart_adresse, arrivee_adresse,
          prix_calcule, prix_final, commission_nyme,
          distance_km, statut_paiement, mode_paiement,
          destinataire_nom, destinataire_tel,
          created_at, acceptee_at, livree_at, annulee_at, annulee_par,
          client:client_id(nom, telephone, email),
          coursier:coursier_id(nom, telephone)
        `)
        .order('created_at', { ascending: false })
        .limit(5000)

      if (statut)   q = q.eq('statut', statut)
      if (dateDeb)  q = q.gte('created_at', dateDeb)
      if (dateFin)  q = q.lte('created_at', dateFin + 'T23:59:59.999Z')

      const { data, error } = await q
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const headers = [
        'ID', 'Statut', 'Type',
        'Départ', 'Arrivée',
        'Prix calculé', 'Prix final', 'Commission NYME',
        'Distance (km)', 'Statut paiement', 'Mode paiement',
        'Destinataire', 'Tél destinataire',
        'Client', 'Tél client', 'Email client',
        'Coursier', 'Tél coursier',
        'Créé le', 'Accepté le', 'Livré le', 'Annulé le', 'Annulé par',
      ]

      const rows = (data || []).map(l => csvRow([
        l.id,
        l.statut,
        l.type,
        l.depart_adresse,
        l.arrivee_adresse,
        l.prix_calcule ?? '',
        l.prix_final   ?? '',
        l.commission_nyme ?? '',
        l.distance_km  ?? '',
        l.statut_paiement,
        l.mode_paiement ?? '',
        l.destinataire_nom ?? '',
        l.destinataire_tel ?? '',
        (l.client as { nom?: string })?.nom        ?? '',
        (l.client as { telephone?: string })?.telephone ?? '',
        (l.client as { email?: string })?.email     ?? '',
        (l.coursier as { nom?: string })?.nom        ?? '',
        (l.coursier as { telephone?: string })?.telephone ?? '',
        fmtDate(l.created_at),
        fmtDate(l.acceptee_at),
        fmtDate(l.livree_at),
        fmtDate(l.annulee_at),
        l.annulee_par ?? '',
      ]))

      csvContent = [csvRow(headers), ...rows].join('\n')
    }

    // ── 3. Export UTILISATEURS ────────────────────────────────────
    else if (type === 'utilisateurs') {
      let q = supabaseAdmin
        .from('utilisateurs')
        .select('id, nom, telephone, email, role, est_verifie, est_actif, note_moyenne, created_at')
        .order('created_at', { ascending: false })
        .limit(5000)

      if (dateDeb) q = q.gte('created_at', dateDeb)
      if (dateFin) q = q.lte('created_at', dateFin + 'T23:59:59.999Z')

      const { data, error } = await q
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const headers = ['ID', 'Nom', 'Téléphone', 'Email', 'Rôle', 'Vérifié', 'Actif', 'Note', 'Créé le']
      const rows = (data || []).map(u => csvRow([
        u.id, u.nom, u.telephone ?? '', u.email ?? '',
        u.role, u.est_verifie ? 'Oui' : 'Non',
        u.est_actif ? 'Oui' : 'Non',
        u.note_moyenne ?? '',
        fmtDate(u.created_at),
      ]))

      csvContent = [csvRow(headers), ...rows].join('\n')
    }

    // ── 4. Export GAINS (transactions wallet coursiers) ───────────
    else if (type === 'gains') {
      let q = supabaseAdmin
        .from('transactions_wallet')
        .select(`
          id, type, montant, reference, note, created_at,
          user:user_id(nom, telephone, email, role)
        `)
        .order('created_at', { ascending: false })
        .limit(5000)

      if (dateDeb) q = q.gte('created_at', dateDeb)
      if (dateFin) q = q.lte('created_at', dateFin + 'T23:59:59.999Z')

      const { data, error } = await q
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const headers = ['ID Transaction', 'Type', 'Montant (XOF)', 'Référence', 'Note', 'Utilisateur', 'Tél', 'Email', 'Rôle', 'Date']
      const rows = (data || []).map(t => csvRow([
        t.id, t.type, t.montant, t.reference ?? '', t.note ?? '',
        (t.user as { nom?: string })?.nom        ?? '',
        (t.user as { telephone?: string })?.telephone ?? '',
        (t.user as { email?: string })?.email     ?? '',
        (t.user as { role?: string })?.role       ?? '',
        fmtDate(t.created_at),
      ]))

      csvContent = [csvRow(headers), ...rows].join('\n')
    }

    // ── 5. Export REMBOURSEMENTS ──────────────────────────────────
    else if (type === 'remboursements') {
      let q = supabaseAdmin
        .from('livraisons')
        .select(`
          id, statut, prix_final, mode_paiement, created_at, annulee_at,
          client:client_id(nom, telephone, email),
          coursier:coursier_id(nom, telephone)
        `)
        .eq('statut_paiement', 'rembourse')
        .order('created_at', { ascending: false })
        .limit(5000)

      if (dateDeb) q = q.gte('created_at', dateDeb)
      if (dateFin) q = q.lte('created_at', dateFin + 'T23:59:59.999Z')

      const { data, error } = await q
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })

      const headers = ['ID Livraison', 'Statut livraison', 'Montant remboursé (XOF)', 'Mode paiement initial', 'Client', 'Tél', 'Email', 'Coursier', 'Tél coursier', 'Créé le', 'Annulé le']
      const rows = (data || []).map(l => csvRow([
        l.id, l.statut, l.prix_final ?? '',
        l.mode_paiement ?? '',
        (l.client as { nom?: string })?.nom        ?? '',
        (l.client as { telephone?: string })?.telephone ?? '',
        (l.client as { email?: string })?.email     ?? '',
        (l.coursier as { nom?: string })?.nom        ?? '',
        (l.coursier as { telephone?: string })?.telephone ?? '',
        fmtDate(l.created_at),
        fmtDate(l.annulee_at),
      ]))

      csvContent = [csvRow(headers), ...rows].join('\n')
    }

    // ── 6. Retourner le CSV avec BOM UTF-8 (Excel compatible) ─────
    // Le BOM (Byte Order Mark) EF BB BF permet à Excel d'ouvrir correctement les accents
    const bom = '\uFEFF'
    const blob = bom + csvContent

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control':       'no-cache, no-store, must-revalidate',
        'X-Generated-At':      now.toISOString(),
      },
    })

  } catch (err: unknown) {
    console.error('[api/admin/export]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}