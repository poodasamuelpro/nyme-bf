// src/app/api/contact/route.ts
export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import * as brevo from '@getbrevo/brevo'  // ✅ CORRECT - utilise le package 'brevo' installé

const EMAIL_TO = 'contact@nyme.app'
const EMAIL_FROM = 'NYME <noreply@nyme.app>'
const EMAIL_FROM_NAME = 'NYME'
const EMAIL_FROM_ADDRESS = 'noreply@nyme.app'

// Templates HTML (les mêmes)
const getAdminEmailHTML = (nom: string, email: string, sujet: string, message: string) => `
  <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0A0F1E;color:#F9FAFB;padding:32px;border-radius:16px">
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-block;background:linear-gradient(135deg,#F97316,#DC2626);padding:10px 20px;border-radius:12px">
        <span style="color:white;font-weight:800;font-size:20px;letter-spacing:2px">NYME</span>
      </div>
    </div>
    <h2 style="color:#F97316;margin-bottom:8px">Nouveau message de contact</h2>
    <p style="color:#9CA3AF;font-size:14px;margin-bottom:24px">Reçu via le formulaire du site web</p>

    <table style="width:100%;border-collapse:collapse">
      <tr>
        <td style="padding:12px;background:#111827;border-radius:8px 8px 0 0;color:#9CA3AF;font-size:12px;text-transform:uppercase;letter-spacing:1px">Nom</td>
        <td style="padding:12px;background:#111827;border-radius:8px 8px 0 0;color:#F9FAFB;font-weight:600">${nom}</td>
      </tr>
      <tr>
        <td style="padding:12px;background:#1F2937;color:#9CA3AF;font-size:12px;text-transform:uppercase;letter-spacing:1px">Email</td>
        <td style="padding:12px;background:#1F2937;color:#F97316">${email}</td>
      </tr>
      <tr>
        <td style="padding:12px;background:#111827;color:#9CA3AF;font-size:12px;text-transform:uppercase;letter-spacing:1px">Sujet</td>
        <td style="padding:12px;background:#111827;color:#F9FAFB">${sujet}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding:16px;background:#1F2937;border-radius:0 0 8px 8px">
          <div style="color:#9CA3AF;font-size:12px;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px">Message</div>
          <div style="color:#F9FAFB;line-height:1.6;white-space:pre-wrap">${message}</div>
        </td>
      </tr>
    </table>

    <div style="margin-top:24px;padding:16px;background:#0F3460;border-radius:12px;border-left:4px solid #F97316">
      <p style="color:#9CA3AF;font-size:12px;margin:0">
        Pour répondre, utilisez directement cet email : 
        <a href="mailto:${email}" style="color:#F97316">${email}</a>
      </p>
    </div>

    <p style="text-align:center;color:#4B5563;font-size:11px;margin-top:24px">
      © ${new Date().getFullYear()} NYME · Ouagadougou, Burkina Faso
    </p>
  </div>
`

const getUserEmailHTML = (nom: string, sujet: string, message: string) => `
  <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0A0F1E;color:#F9FAFB;padding:32px;border-radius:16px">
    <div style="text-align:center;margin-bottom:24px">
      <div style="display:inline-block;background:linear-gradient(135deg,#F97316,#DC2626);padding:10px 20px;border-radius:12px">
        <span style="color:white;font-weight:800;font-size:20px;letter-spacing:2px">NYME</span>
      </div>
    </div>
    <h2 style="color:#F9FAFB">Bonjour ${nom} 👋</h2>
    <p style="color:#9CA3AF;line-height:1.7">
      Nous avons bien reçu votre message concernant <strong style="color:#F97316">${sujet}</strong>.<br/>
      Notre équipe vous répondra dans les <strong style="color:#F9FAFB">24 heures</strong>.
    </p>
    <div style="margin:24px 0;padding:16px;background:#111827;border-radius:12px;border-left:4px solid #1A6EBF">
      <p style="color:#6B7280;font-size:12px;margin:0 0 8px">Votre message :</p>
      <p style="color:#D1D5DB;font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap">${message}</p>
    </div>
    <p style="color:#9CA3AF;font-size:14px">
      Si votre demande est urgente, vous pouvez nous appeler directement au 
      <a href="tel:+22600000000" style="color:#F97316">+226 00 00 00 00</a>
    </p>
    <hr style="border:none;border-top:1px solid #1F2937;margin:24px 0"/>
    <p style="text-align:center;color:#4B5563;font-size:11px">
      © ${new Date().getFullYear()} NYME · Livraison Rapide & Intelligente · Ouagadougou, Burkina Faso
    </p>
  </div>
`

// Fonction pour envoyer via Resend
const sendWithResend = async (to: string, subject: string, html: string, replyTo?: string) => {
  const resend = new Resend(process.env.RESEND_API_KEY!)
  return await resend.emails.send({
    from: EMAIL_FROM,
    to,
    replyTo: replyTo || undefined,
    subject,
    html,
  })
}

// Fonction pour envoyer via Brevo (avec le bon package)
const sendWithBrevo = async (to: string, subject: string, html: string, replyTo?: string) => {
  const apiInstance = new brevo.TransactionalEmailsApi()
  apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, process.env.BREVO_API_KEY!)
  
  const sendSmtpEmail = new brevo.SendSmtpEmail()
  sendSmtpEmail.subject = subject
  sendSmtpEmail.htmlContent = html
  sendSmtpEmail.sender = { name: EMAIL_FROM_NAME, email: EMAIL_FROM_ADDRESS }
  sendSmtpEmail.to = [{ email: to, name: to.split('@')[0] }]
  
  if (replyTo) {
    sendSmtpEmail.replyTo = { email: replyTo, name: replyTo.split('@')[0] }
  }
  
  return await apiInstance.sendTransacEmail(sendSmtpEmail)
}

// Fonction principale d'envoi avec fallback
const sendEmailsWithFallback = async (adminData: any, userData: any) => {
  const { adminTo, adminSubject, adminHtml, adminReplyTo, userTo, userSubject, userHtml } = adminData
  
  let lastError = null

  // ESSAYER RESEND EN PRIORITÉ
  if (process.env.RESEND_API_KEY) {
    try {
      console.log('📧 Tentative d\'envoi avec Resend...')
      await Promise.all([
        sendWithResend(adminTo, adminSubject, adminHtml, adminReplyTo),
        sendWithResend(userTo, userSubject, userHtml)
      ])
      console.log('✅ Envoi réussi avec Resend')
      return { success: true, service: 'resend' }
    } catch (error: any) {
      console.error('❌ Resend a échoué:', error.message)
      lastError = error
      
      if (error.message?.includes('quota') || error.message?.includes('credit') || error.message?.includes('rate')) {
        console.log('⚠️ Problème de crédits Resend, fallback vers Brevo...')
      } else {
        console.log('⚠️ Erreur Resend, tentative fallback vers Brevo...')
      }
    }
  }

  // FALLBACK VERS BREVO SI RESEND A ÉCHOUÉ
  if (process.env.BREVO_API_KEY) {
    try {
      console.log('📧 Fallback: Tentative d\'envoi avec Brevo...')
      await Promise.all([
        sendWithBrevo(adminTo, adminSubject, adminHtml, adminReplyTo),
        sendWithBrevo(userTo, userSubject, userHtml)
      ])
      console.log('✅ Envoi réussi avec Brevo (fallback)')
      return { success: true, service: 'brevo-fallback' }
    } catch (error: any) {
      console.error('❌ Brevo a également échoué:', error.message)
      throw new Error(`Les deux services ont échoué. Resend: ${lastError?.message}, Brevo: ${error.message}`)
    }
  }

  // AUCUN SERVICE DISPONIBLE
  if (lastError && !process.env.BREVO_API_KEY) {
    throw new Error('Resend a échoué et Brevo n\'est pas configuré')
  }
  
  throw new Error('Aucun service email configuré')
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { nom, email, sujet, message } = body

    // Validation
    if (!nom || !email || !sujet || !message) {
      return NextResponse.json(
        { error: 'Tous les champs sont requis.' },
        { status: 400 }
      )
    }

    if (!email.includes('@')) {
      return NextResponse.json(
        { error: 'Adresse email invalide.' },
        { status: 400 }
      )
    }

    // Vérifier qu'au moins un service est configuré
    if (!process.env.RESEND_API_KEY && !process.env.BREVO_API_KEY) {
      console.warn('⚠️ Aucune clé API configurée - Mode simulation')
      return NextResponse.json(
        { 
          success: true, 
          warning: 'Mode simulation - Aucun email envoyé',
          message: 'Votre message a bien été enregistré.'
        },
        { status: 200 }
      )
    }

    const adminHtml = getAdminEmailHTML(nom, email, sujet, message)
    const userHtml = getUserEmailHTML(nom, sujet, message)

    // Envoi des emails avec fallback automatique
    const result = await sendEmailsWithFallback(
      {
        adminTo: EMAIL_TO,
        adminSubject: `[NYME Contact] ${sujet} — ${nom}`,
        adminHtml: adminHtml,
        adminReplyTo: email,
        userTo: email,
        userSubject: `✅ Message reçu — NYME vous répondra sous 24h`,
        userHtml: userHtml,
      },
      {}
    )

    return NextResponse.json(
      { 
        success: true, 
        message: 'Votre message a bien été envoyé.',
        service: result.service
      },
      { status: 200 }
    )

  } catch (err: any) {
    console.error('Erreur envoi email:', err)
    
    return NextResponse.json(
      { 
        error: 'Erreur lors de l\'envoi du message', 
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      },
      { status: 500 }
    )
  }
}