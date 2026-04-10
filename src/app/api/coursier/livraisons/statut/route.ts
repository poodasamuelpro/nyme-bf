// src/app/api/coursier/livraisons/statut/route.ts — MODIFIÉ
// ═══════════════════════════════════════════════════════════════════════════
// CORRECTIONS AUDIT :
//   1. Ajout du support de la preuve de livraison (photo optionnelle)
//      lors du passage au statut 'livree'. Upload vers Supabase Storage.
//   2. Conservation intégrale de toute la logique existante (commissions,
//      transitions, notifications FCM, wallet cash).
//   3. Le champ 'preuve_livraison_url' est optionnel mais recommandé.
//   4. Limite fichier preuve : 4MB (alignée sur le bucket Supabase Storage)
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getGainCoursier } from '@/lib/tarifs'
import { firebaseNotificationService } from '@/services/firebase-notification-service'

// Valeurs exactes de la CHECK constraint SQL
// Note: 'en_rout_depart' SANS 'e' — orthographe réelle de la BDD
const STATUS_MESSAGES: Record<string, string> = {
  en_rout_depart:   '🛵 Le coursier est en route vers votre colis',
  colis_recupere:   '📦 Le coursier a récupéré votre colis',
  en_route_arrivee: '🚀 Votre colis est en route vers la destination',
  livree:           '🎉 Votre colis a été livré avec succès !',
  annulee:          '❌ Votre livraison a été annulée',
}

const NYME_ADMIN_USER_ID = process.env.NYME_ADMIN_USER_ID || null

// Limite alignée sur le bucket Supabase Storage (4MB)
const PREUVE_MAX_SIZE_BYTES = 4 * 1024 * 1024 // 4 194 304 bytes

export async function POST(req: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    // Parsing multipart/form-data pour supporter la photo de preuve
    const contentType = req.headers.get('content-type') || ''
    let livraison_id: string
    let statut: string
    let coursier_id: string
    let preuveFile: File | null = null

    if (contentType.includes('multipart/form-data')) {
      // Avec photo (preuve de livraison)
      const formData = await req.formData()
      livraison_id  = formData.get('livraison_id') as string
      statut        = formData.get('statut') as string
      coursier_id   = formData.get('coursier_id') as string
      preuveFile    = formData.get('preuve_photo') as File | null
    } else {
      // Sans photo (JSON classique)
      const body = await req.json()
      livraison_id  = body.livraison_id
      statut        = body.statut
      coursier_id   = body.coursier_id
    }

    if (!livraison_id || !statut || !coursier_id) {
      return NextResponse.json({ error: 'Paramètres manquants : livraison_id, statut, coursier_id' }, { status: 400 })
    }

    if (coursier_id !== session.user.id) {
      return NextResponse.json({ error: 'Accès refusé — identité coursier invalide' }, { status: 403 })
    }

    const { data: livraison } = await supabaseAdmin
      .from('livraisons')
      .select('id, client_id, coursier_id, prix_final, prix_calcule, statut, type, mode_paiement, statut_paiement')
      .eq('id', livraison_id)
      .eq('coursier_id', coursier_id)
      .single()

    if (!livraison) {
      return NextResponse.json({ error: 'Livraison non trouvée ou non assignée à ce coursier' }, { status: 404 })
    }

    // Transitions autorisées — 'en_rout_depart' SANS 'e' = valeur SQL réelle
    const TRANSITIONS: Record<string, string[]> = {
      acceptee:         ['en_rout_depart', 'annulee'],
      en_rout_depart:   ['colis_recupere',  'annulee'],
      colis_recupere:   ['en_route_arrivee', 'annulee'],
      en_route_arrivee: ['livree',           'annulee'],
    }

    const allowed = TRANSITIONS[livraison.statut] || []
    if (!allowed.includes(statut)) {
      return NextResponse.json({
        error: `Transition ${livraison.statut} → ${statut} non autorisée`,
        allowed,
      }, { status: 400 })
    }

    const updateData: Record<string, unknown> = { statut }
    let gainCoursierFinal   = 0
    let commissionNymeFinal = 0

    // ────────────────────────────────────────────────────────────────
    // CAS 1 : Livraison confirmée
    // ────────────────────────────────────────────────────────────────
    if (statut === 'livree') {
      updateData.livree_at       = new Date().toISOString()
      updateData.is_paid_to_courier = true

      const prixTotal  = Number(livraison.prix_final || livraison.prix_calcule)
      const typeCoarse = (livraison.type || 'immediate') as 'immediate' | 'urgente' | 'programmee'
      const modePay    = livraison.mode_paiement || 'cash'

      const { gainCoursier, commissionNyme } = await getGainCoursier(prixTotal, typeCoarse)
      gainCoursierFinal   = gainCoursier
      commissionNymeFinal = commissionNyme
      updateData.commission_nyme = commissionNyme

      console.log(`[statut] livree — prix: ${prixTotal} | type: ${typeCoarse} | mode: ${modePay} | commission: ${commissionNyme} XOF | gain: ${gainCoursier} XOF`)

      // ── Upload preuve de livraison (optionnelle) ─────────────────────
      if (preuveFile && preuveFile.size > 0) {
        try {
          if (preuveFile.size > PREUVE_MAX_SIZE_BYTES) {
            console.warn(`[statut] Preuve livraison trop grande (${preuveFile.size} bytes, max ${PREUVE_MAX_SIZE_BYTES} bytes / 4MB) — ignorée`)
          } else {
            const ext  = preuveFile.name.split('.').pop() || 'jpg'
            const path = `preuves-livraison/${livraison_id}/${coursier_id}_${Date.now()}.${ext}`

            const { error: uploadErr } = await supabaseAdmin.storage
              .from('preuves-livraison')
              .upload(path, preuveFile, { upsert: false })

            if (!uploadErr) {
              const { data: { publicUrl } } = supabaseAdmin.storage
                .from('preuves-livraison')
                .getPublicUrl(path)

              updateData.preuve_livraison_url = publicUrl
              console.log('[statut] Preuve de livraison uploadée:', publicUrl)
            } else {
              console.warn('[statut] Upload preuve échoué (non bloquant):', uploadErr.message)
            }
          }
        } catch (preuveErr) {
          console.warn('[statut] Erreur upload preuve (non bloquant):', preuveErr)
        }
      }

      // ── Gestion commission wallet (éviter double commission) ────────
      // Règle :
      //   - Mode CASH/WALLET : statut_paiement reste 'en_attente' → créditer maintenant
      //   - Mode mobile_money : trigger SQL calculate_and_add_commission se déclenche
      //     quand statut='livree' ET statut_paiement='paye' → NE PAS créditer ici

      const isCash     = modePay === 'cash' || modePay === 'wallet'
      const isAlreadyPaid = livraison.statut_paiement === 'paye'

      if (isCash && !isAlreadyPaid) {
        // 1. Créditer gain net au coursier
        const { data: txIdGain, error: gainErr } = await supabaseAdmin.rpc('process_wallet_transaction', {
          p_user_id:        coursier_id,
          p_type:           'gain',
          p_montant:        gainCoursier,
          p_note:           `Gain livraison #${livraison_id.slice(0, 8).toUpperCase()} — ${gainCoursier.toLocaleString('fr-FR')} XOF`,
          p_livraison_id:   livraison_id,
          p_reference:      `GAIN_CASH_${livraison_id}`,
          p_payment_method: 'cash',
        })
        if (gainErr) {
          console.error('[statut] gain coursier ECHEC:', gainErr.message, gainErr.code)
        } else {
          console.log('[statut] gain cash crédité, tx_id:', txIdGain)
        }

        // 2. Commission NYME (wallet admin)
        if (NYME_ADMIN_USER_ID && commissionNyme > 0) {
          const { error: commErr } = await supabaseAdmin.rpc('process_wallet_transaction', {
            p_user_id:        NYME_ADMIN_USER_ID,
            p_type:           'commission',
            p_montant:        commissionNyme,
            p_note:           `Commission fixe ${typeCoarse} — livraison #${livraison_id.slice(0, 8).toUpperCase()}`,
            p_livraison_id:   livraison_id,
            p_reference:      `COMMISSION_CASH_${livraison_id}`,
            p_payment_method: 'cash',
          })
          if (commErr) console.error('[statut] commission NYME ECHEC:', commErr.message)
        }

        // 3. Marquer livraison payée
        updateData.statut_paiement = 'paye'

        // 4. Enregistrer dans paiements
        await supabaseAdmin.from('paiements').insert({
          livraison_id,
          montant:   prixTotal,
          mode:      'cash',
          reference: `PAY_CASH_${livraison_id}`,
          statut:    'succes',
          paye_le:   new Date().toISOString(),
          metadata:  {
            gain_coursier:    gainCoursier,
            commission_nyme:  commissionNyme,
            type_commission:  'fixe',
            type_course:      typeCoarse,
            credite_par:      'route_statut_cash',
          },
        })

      } else if (!isCash && isAlreadyPaid) {
        console.log('[statut] Livraison mobile money déjà payée — commission gérée par trigger SQL')
      } else {
        console.log('[statut] Livraison mobile money en attente de paiement — pas de crédit wallet maintenant')
      }

      // 5. Mettre à jour stats coursier
      const { data: coursierActuel } = await supabaseAdmin
        .from('coursiers')
        .select('total_courses, total_gains')
        .eq('id', coursier_id)
        .single()

      await supabaseAdmin.from('coursiers').update({
        statut:            'disponible',
        total_courses:     (coursierActuel?.total_courses || 0) + 1,
        total_gains:       (Number(coursierActuel?.total_gains) || 0) + (isCash ? gainCoursier : 0),
        derniere_activite: new Date().toISOString(),
      }).eq('id', coursier_id)
    }

    // ── CAS 2 : Annulation ─────────────────────────────────────────────
    if (statut === 'annulee') {
      updateData.annulee_at  = new Date().toISOString()
      updateData.annulee_par = 'coursier'
      await supabaseAdmin.from('coursiers').update({
        statut:            'disponible',
        derniere_activite: new Date().toISOString(),
      }).eq('id', coursier_id)
    }

    // ── Mise à jour de la livraison ──────────────────────────────────────
    const { error: updateErr } = await supabaseAdmin
      .from('livraisons')
      .update(updateData)
      .eq('id', livraison_id)

    if (updateErr) {
      console.error('[statut] update livraison ECHEC:', updateErr.message)
      return NextResponse.json({ error: 'Erreur mise à jour livraison' }, { status: 500 })
    }

    // ── Historique statuts ────────────────────────────────────────────────
    await supabaseAdmin.from('statuts_livraison').insert({
      livraison_id,
      statut,
      note: `Statut mis à jour par coursier ${coursier_id.slice(0, 8)} — ${new Date().toLocaleString('fr-FR')}`,
    })

    // ── Notification in-app au client ────────────────────────────────────
    const message = STATUS_MESSAGES[statut]
    if (message && livraison.client_id) {
      await supabaseAdmin.from('notifications').insert({
        user_id: livraison.client_id,
        type:    'statut_livraison',
        titre:   `Livraison #${livraison_id.slice(0, 8).toUpperCase()}`,
        message,
        data:    {
          livraison_id,
          statut,
          preuve_url: updateData.preuve_livraison_url || null,
        },
        lu: false,
      })

      // ── Notification push FCM ────────────────────────────────────────
      if (firebaseNotificationService.isConfigured()) {
        try {
          await firebaseNotificationService.sendToUser(
            livraison.client_id,
            {
              title: `Livraison #${livraison_id.slice(0, 8).toUpperCase()}`,
              body:  message,
              data:  {
                livraison_id,
                statut,
                type: 'statut_livraison',
              },
            },
            'statut_livraison'
          )
        } catch (fcmErr) {
          console.warn('[statut] Notification FCM client échouée (non bloquant):', fcmErr)
        }
      }
    }

    return NextResponse.json({
      success: true,
      statut,
      preuve_uploadee: !!updateData.preuve_livraison_url,
      ...(statut === 'livree' ? {
        gain_coursier:   gainCoursierFinal,
        commission_nyme: commissionNymeFinal,
        type_commission: 'fixe',
      } : {}),
    })

  } catch (err: unknown) {
    console.error('[api/coursier/statut]', err)
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'Erreur serveur',
    }, { status: 500 })
  }
}
