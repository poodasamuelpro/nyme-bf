import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

const STATUS_MESSAGES: Record<string, string> = {
  en_route_depart:  '🛵 Le coursier est en route vers votre colis',
  colis_recupere:   '📦 Le coursier a récupéré votre colis',
  en_route_arrivee: '🚀 Votre colis est en route vers la destination',
  livree:           '🎉 Votre colis a été livré avec succès !',
  annulee:          '❌ Votre livraison a été annulée',
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const { livraison_id, statut, coursier_id } = await req.json()

    if (!livraison_id || !statut || !coursier_id) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    // Vérifier que le coursier est assigné à cette livraison
    const { data: livraison } = await supabase
      .from('livraisons')
      .select('*')
      .eq('id', livraison_id)
      .eq('coursier_id', coursier_id)
      .single()

    if (!livraison) {
      return NextResponse.json({ error: 'Livraison non trouvée' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = { statut }

    if (statut === 'livree') {
      updateData.livree_at = new Date().toISOString()

      // Créditer le wallet du coursier (85% — NYME garde 15%)
      const gainCoursier = (livraison.prix_final || livraison.prix_calcule) * 0.85
      await supabase.rpc('process_wallet_transaction', {
        p_user_id: coursier_id,
        p_type: 'gain',
        p_montant: gainCoursier,
        p_note: `Gain course #${(livraison_id as string).slice(0, 8)}`,
        p_livraison_id: livraison_id,
        p_reference: `LIVRAISON_${livraison_id}`,
      })

      // Mettre le coursier disponible + incrémenter total courses
      await supabase.from('coursiers').update({
        statut: 'disponible',
        total_courses: (livraison.total_courses ?? 0) + 1,
      }).eq('id', coursier_id)

      // Mettre à jour stats coursier (fonction optionnelle)
      await supabase.rpc('update_coursier_stats' as never, {
        p_coursier_id: coursier_id,
        p_gain: gainCoursier,
      }).catch(() => { /* ignoré si la fonction n'existe pas */ })
    }

    if (statut === 'annulee') {
      await supabase.from('coursiers').update({ statut: 'disponible' }).eq('id', coursier_id)
    }

    await supabase.from('livraisons').update(updateData).eq('id', livraison_id)

    // Notification client
    const message = STATUS_MESSAGES[statut]
    if (message) {
      await supabase.from('notifications').insert({
        user_id: livraison.client_id,
        type: 'livraison',
        titre: 'Mise à jour livraison',
        message,
        data: { livraison_id, statut },
        lu: false,
      })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[API] update statut:', err)
    return NextResponse.json({ error: 'Erreur mise à jour' }, { status: 500 })
  }
}
