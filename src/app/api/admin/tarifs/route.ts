// src/app/api/admin/tarifs/route.ts
// GET  → lire config_tarifs + tarifs_baremes
// PUT  → modifier un barème ou la config
// POST → ajouter un barème
// CORRECTION AUDIT : verifierAdmin inline → verifyAdminRole (middleware centralisé)
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { verifyAdminRole } from '@/lib/auth-middleware'

// GET — Lire la config et les barèmes
export async function GET(req: NextRequest) {
  try {
    const auth = await verifyAdminRole(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const [{ data: config }, { data: baremes }] = await Promise.all([
      supabaseAdmin
        .from('config_tarifs')
        .select('*')
        .eq('actif', true)
        .order('updated_at', { ascending: false })
        .limit(1)
        .single(),
      supabaseAdmin
        .from('tarifs_baremes')
        .select('*')
        .order('ordre', { ascending: true }),
    ])

    return NextResponse.json({ config, baremes })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}

// PUT — Modifier un barème ou la config
export async function PUT(req: NextRequest) {
  try {
    const auth = await verifyAdminRole(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const body = await req.json()
    const { type, id, data } = body
    // type = 'bareme' | 'config'

    if (!type || !data) {
      return NextResponse.json({ error: 'type et data requis' }, { status: 400 })
    }

    if (type === 'bareme') {
      if (!id) return NextResponse.json({ error: 'id requis pour modifier un barème' }, { status: 400 })

      const { data: updated, error } = await supabaseAdmin
        .from('tarifs_baremes')
        .update({
          km_min:      data.km_min,
          km_max:      data.km_max,
          prix_par_km: data.prix_par_km,
          label:       data.label,
          actif:       data.actif,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true, bareme: updated })
    }

    if (type === 'config') {
      // Mettre à jour la config active
      const { data: updatedConfig, error } = await supabaseAdmin
        .from('config_tarifs')
        .update({
          frais_fixe_immediate:      data.frais_fixe_immediate,
          frais_fixe_urgente:        data.frais_fixe_urgente,
          frais_fixe_programmee:     data.frais_fixe_programmee,
          prix_minimum:              data.prix_minimum,
          multiplicateur_urgente:    data.multiplicateur_urgente,
          multiplicateur_programmee: data.multiplicateur_programmee,
          multiplicateur_pluie:      data.multiplicateur_pluie,
          pluie_actif:               data.pluie_actif,
          commission_immediate:      data.commission_immediate,
          commission_urgente:        data.commission_urgente,
          commission_programmee:     data.commission_programmee,
          updated_at:                new Date().toISOString(),
        })
        .eq('actif', true)
        .select()
        .single()

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true, config: updatedConfig })
    }

    return NextResponse.json({ error: 'type invalide' }, { status: 400 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}

// POST — Ajouter un nouveau barème
export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAdminRole(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: 401 })

    const body = await req.json()
    const { km_min, km_max, prix_par_km, label, ordre } = body

    if (km_min === undefined || km_max === undefined || !prix_par_km || !label || !ordre) {
      return NextResponse.json({ error: 'km_min, km_max, prix_par_km, label, ordre requis' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('tarifs_baremes')
      .insert({ km_min, km_max, prix_par_km, label, ordre, actif: true })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, bareme: data }, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Erreur serveur' }, { status: 500 })
  }
}