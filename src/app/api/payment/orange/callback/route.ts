// src/app/api/payment/orange/callback/route.ts
// ══════════════════════════════════════════════════════════════════
// WEBHOOK ORANGE MONEY — NYME
// POST /api/payment/orange/callback
// ══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      status?: string
      txnid?: string
      order_id?: string
      amount?: number
      notif_token?: string
      pay_token?: string
    }

    const { status, order_id, amount } = body
    const ref = order_id || body.txnid || ''

    if (!ref) {
      console.warn('[Orange Webhook] Pas de référence')
      return NextResponse.json({ received: true })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nyme.bf'

    if (status === 'SUCCESS' || status === 'SUCCESSFULL' || status === '00') {
      // Chercher la livraison via la référence
      const { data: paiement } = await supabaseAdmin
        .from('paiements')
        .select('livraison_id')
        .eq('reference', ref)
        .single()

      const livraisonId = paiement?.livraison_id

      if (livraisonId) {
        await supabaseAdmin.from('livraisons').update({
          statut_paiement:    'paye',
          payment_api_status: 'success',
        }).eq('id', livraisonId)

        await supabaseAdmin.from('paiements').update({
          statut:  'succes',
          paye_le: new Date().toISOString(),
          metadata: body as Record<string, unknown>,
        }).eq('reference', ref)

        const { data: liv } = await supabaseAdmin
          .from('livraisons').select('client_id').eq('id', livraisonId).single()

        if (liv?.client_id) {
          await supabaseAdmin.from('notifications').insert({
            user_id: liv.client_id,
            type:    'paiement',
            titre:   '✅ Paiement Orange Money confirmé',
            message: `Paiement de ${(amount || 0).toLocaleString('fr-FR')} FCFA confirmé via Orange Money.`,
            data:    { livraison_id: livraisonId, amount, provider: 'orange', ref },
            lu:      false,
          })
        }

        console.log(`[Orange Webhook] ✅ ${ref} — ${amount} XOF`)
      }
    } else {
      console.warn(`[Orange Webhook] Statut non-success: ${status}`)
    }

    return NextResponse.json({ received: true })

  } catch (err: unknown) {
    console.error('[Orange Webhook] Erreur:', err)
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const status      = searchParams.get('status') || ''
  const orderId     = searchParams.get('order_id') || ''
  const siteUrl     = process.env.NEXT_PUBLIC_SITE_URL || 'https://nyme.bf'

  const { data: paiement } = await supabaseAdmin
    .from('paiements').select('livraison_id').eq('reference', orderId).single()

  const livraisonId = paiement?.livraison_id

  if (livraisonId) {
    const isSuccess = status === 'SUCCESS' || status === '00'
    return NextResponse.redirect(`${siteUrl}/client/suivi/${livraisonId}?payment=${isSuccess ? 'success' : status}`)
  }

  return NextResponse.redirect(`${siteUrl}/client/dashboard?payment=${status || 'unknown'}`)
}