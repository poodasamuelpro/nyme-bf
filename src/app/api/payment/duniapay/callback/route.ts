// src/app/api/payment/duniapay/callback/route.ts
// ══════════════════════════════════════════════════════════════════
// WEBHOOK DUNIAPAY — NYME
// POST /api/payment/duniapay/callback
// ══════════════════════════════════════════════════════════════════
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { paymentService } from '@/services/payment-service'

export async function POST(req: NextRequest) {
  try {
    const rawBody   = await req.text()
    const signature = req.headers.get('x-duniapay-signature') || req.headers.get('x-signature') || ''

    // Vérifier la signature
    if (signature && !paymentService.verifyDuniaPayWebhook(rawBody, signature)) {
      console.warn('[DuniaPay Webhook] Signature invalide')
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const event = JSON.parse(rawBody) as {
      event?: string
      status?: string
      transaction_id?: string
      reference?: string
      amount?: number
      metadata?: { livraison_id?: string; client_id?: string }
    }

    const ref         = event.reference || event.transaction_id || ''
    const status      = event.status || ''
    const livraisonId = event.metadata?.livraison_id

    if (!livraisonId) {
      console.warn('[DuniaPay Webhook] Pas de livraison_id dans metadata')
      return NextResponse.json({ received: true })
    }

    if (status === 'success' || status === 'completed' || status === 'paid') {
      const amount = event.amount || 0

      await supabaseAdmin.from('livraisons').update({
        statut_paiement:    'paye',
        payment_api_status: 'success',
      }).eq('id', livraisonId)

      await supabaseAdmin.from('paiements')
        .update({ statut: 'succes', paye_le: new Date().toISOString(), metadata: event as Record<string, unknown> })
        .eq('reference', ref)

      const { data: liv } = await supabaseAdmin
        .from('livraisons').select('client_id').eq('id', livraisonId).single()

      if (liv?.client_id) {
        await supabaseAdmin.from('notifications').insert({
          user_id: liv.client_id,
          type:    'paiement',
          titre:   '✅ Paiement confirmé — DuniaPay',
          message: `Paiement de ${amount.toLocaleString('fr-FR')} FCFA confirmé.`,
          data:    { livraison_id: livraisonId, amount, provider: 'duniapay', ref },
          lu:      false,
        })
      }

      console.log(`[DuniaPay Webhook] ✅ ${ref} — ${amount} XOF`)
    } else if (['failed', 'error', 'declined', 'rejected'].includes(status)) {
      await supabaseAdmin.from('livraisons').update({ payment_api_status: 'failed' }).eq('id', livraisonId)
      await supabaseAdmin.from('paiements').update({ statut: 'echec' }).eq('reference', ref)
      console.warn(`[DuniaPay Webhook] ❌ ${ref} — statut: ${status}`)
    }

    return NextResponse.json({ received: true })

  } catch (err: unknown) {
    console.error('[DuniaPay Webhook] Erreur:', err)
    return NextResponse.json({ error: 'Webhook error' }, { status: 500 })
  }
}

// GET pour retour client après paiement DuniaPay
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ref         = searchParams.get('transaction_id') || searchParams.get('reference') || ''
  const status      = searchParams.get('status') || ''
  const livraisonId = searchParams.get('livraison_id') || ''

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://nyme.bf'

  if (livraisonId && (status === 'success' || status === 'completed')) {
    await supabaseAdmin.from('livraisons').update({
      statut_paiement:    'paye',
      payment_api_status: 'success',
    }).eq('id', livraisonId)

    return NextResponse.redirect(`${siteUrl}/client/suivi/${livraisonId}?payment=success`)
  }

  if (livraisonId) {
    return NextResponse.redirect(`${siteUrl}/client/suivi/${livraisonId}?payment=${status || 'pending'}`)
  }

  return NextResponse.redirect(`${siteUrl}/client/dashboard?payment=${status || 'unknown'}`)
}